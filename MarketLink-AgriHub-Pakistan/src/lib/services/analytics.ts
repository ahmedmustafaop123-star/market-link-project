import { sql } from "drizzle-orm";
import { db } from "@/db";

const num = (v: unknown) => Number(v ?? 0);

function lastMonths(k = 6) {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = k - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}
const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
};

function fillMonths(rows: { month: string; volume: number; orders: number }[]) {
  return lastMonths(6).map((m) => {
    const r = rows.find((x) => x.month === m);
    return { month: monthLabel(m), volume: r ? Math.round(r.volume) : 0, orders: r?.orders ?? 0 };
  });
}

async function rows<T = Record<string, unknown>>(q: ReturnType<typeof sql>) {
  return (await db.execute(q)).rows as T[];
}

export async function farmerStats(farmerId: number) {
  const [inv] = await rows(sql`
    select count(*) filter (where status = 'active') as active_listings,
           count(*) filter (where status = 'pending_inspection') as pending_inspection,
           coalesce(sum(total_quantity_kg) filter (where status = 'active'), 0) as inventory_kg,
           coalesce(sum(total_quantity_kg * base_price_per_kg) filter (where status = 'active'), 0) as inventory_value
    from crops_inventory where farmer_id = ${farmerId}`);
  const [bids] = await rows(sql`
    select count(*) filter (where b.status = 'pending') as pending, count(*) filter (where b.status = 'countered') as countered
    from bids_negotiations b join crops_inventory c on c.crop_id = b.crop_id where c.farmer_id = ${farmerId}`);
  const [earn] = await rows(sql`
    select coalesce(sum(amount) filter (where type = 'payout'), 0) as earned,
           coalesce(sum(amount) filter (where type = 'payout' and created_at > date_trunc('month', now())), 0) as earned_month
    from wallet_transactions where user_id = ${farmerId}`);
  const [esc] = await rows(sql`
    select coalesce(sum(total_amount) filter (where payment_status in ('escrow_locked','disputed')), 0) as in_escrow,
           count(*) filter (where delivery_stage <> 'delivered' and payment_status not in ('refunded')) as active_orders
    from orders_logistics where farmer_id = ${farmerId}`);
  const monthly = await rows<{ month: string; volume: string; orders: string }>(sql`
    select to_char(date_trunc('month', created_at), 'YYYY-MM') as month, sum(total_amount) as volume, count(*) as orders
    from orders_logistics where farmer_id = ${farmerId} and payment_status <> 'refunded' and created_at > now() - interval '7 months'
    group by 1`);
  const byCrop = await rows<{ crop_name: string; volume: string }>(sql`
    select c.crop_name, sum(o.total_amount) as volume from orders_logistics o join crops_inventory c on c.crop_id = o.crop_id
    where o.farmer_id = ${farmerId} and o.payment_status <> 'refunded' group by 1 order by 2 desc limit 6`);
  return {
    activeListings: num(inv.active_listings),
    pendingInspection: num(inv.pending_inspection),
    inventoryKg: num(inv.inventory_kg),
    inventoryValue: num(inv.inventory_value),
    pendingBids: num(bids.pending),
    counteredBids: num(bids.countered),
    totalEarned: num(earn.earned),
    earnedThisMonth: num(earn.earned_month),
    inEscrow: num(esc.in_escrow),
    activeOrders: num(esc.active_orders),
    monthly: fillMonths(monthly.map((m) => ({ month: m.month, volume: num(m.volume), orders: num(m.orders) }))),
    byCrop: byCrop.map((c) => ({ name: c.crop_name, value: Math.round(num(c.volume)) })),
  };
}

export async function buyerStats(buyerId: number) {
  const [b] = await rows(sql`
    select count(*) filter (where status = 'pending') as pending, count(*) filter (where status = 'countered') as countered
    from bids_negotiations where buyer_id = ${buyerId}`);
  const [o] = await rows(sql`
    select count(*) filter (where delivery_stage <> 'delivered' and payment_status <> 'refunded') as active_orders,
           count(*) filter (where payment_status = 'awaiting_escrow') as awaiting_escrow,
           coalesce(sum(total_amount) filter (where payment_status <> 'refunded'), 0) as spend,
           coalesce(sum(quantity_kg) filter (where payment_status <> 'refunded'), 0) as kg
    from orders_logistics where buyer_id = ${buyerId}`);
  const [w] = await rows(sql`select wallet_balance, escrow_balance from users where id = ${buyerId}`);
  const monthly = await rows<{ month: string; volume: string; orders: string }>(sql`
    select to_char(date_trunc('month', created_at), 'YYYY-MM') as month, sum(total_amount) as volume, count(*) as orders
    from orders_logistics where buyer_id = ${buyerId} and payment_status <> 'refunded' and created_at > now() - interval '7 months'
    group by 1`);
  return {
    pendingBids: num(b.pending),
    counteredBids: num(b.countered),
    activeOrders: num(o.active_orders),
    awaitingEscrow: num(o.awaiting_escrow),
    totalSpend: num(o.spend),
    totalKg: num(o.kg),
    walletBalance: num(w.wallet_balance),
    escrowBalance: num(w.escrow_balance),
    monthly: fillMonths(monthly.map((m) => ({ month: m.month, volume: num(m.volume), orders: num(m.orders) }))),
  };
}

export async function adminStats() {
  const [tot] = await rows(sql`
    select coalesce(sum(total_amount) filter (where payment_status <> 'refunded'), 0) as volume,
           count(*) as orders,
           coalesce(sum(total_amount) filter (where payment_status in ('escrow_locked','disputed')), 0) as escrow_held,
           coalesce(sum(quantity_kg) filter (where payment_status <> 'refunded'), 0) as kg,
           count(*) filter (where delivery_stage <> 'delivered' and payment_status <> 'refunded') as active_shipments
    from orders_logistics`);
  const [bids] = await rows(sql`select count(*) filter (where status in ('pending','countered')) as active from bids_negotiations`);
  const [usr] = await rows(sql`
    select count(*) filter (where role = 'farmer') as farmers, count(*) filter (where role = 'buyer') as buyers,
           count(*) filter (where role = 'farmer' and not is_verified) as unverified
    from users`);
  const [fees] = await rows(sql`select coalesce(sum(amount), 0) as fees from wallet_transactions where type = 'platform_fee'`);
  const [disp] = await rows(sql`select count(*) filter (where status in ('open','investigating')) as open from disputes`);
  const [insp] = await rows(sql`select count(*) as pending from crops_inventory where status = 'pending_inspection'`);
  const regions = await rows<{ region: string; volume: string; orders: string }>(sql`
    select c.farm_location as region, sum(o.total_amount) as volume, count(*) as orders
    from orders_logistics o join crops_inventory c on c.crop_id = o.crop_id
    where o.payment_status <> 'refunded' group by 1 order by 2 desc limit 8`);
  const categories = await rows<{ category: string; volume: string }>(sql`
    select c.category, sum(o.total_amount) as volume from orders_logistics o join crops_inventory c on c.crop_id = o.crop_id
    where o.payment_status <> 'refunded' group by 1 order by 2 desc`);
  const monthly = await rows<{ month: string; volume: string; orders: string }>(sql`
    select to_char(date_trunc('month', created_at), 'YYYY-MM') as month, sum(total_amount) as volume, count(*) as orders
    from orders_logistics where payment_status <> 'refunded' and created_at > now() - interval '7 months' group by 1`);
  const stages = await rows<{ stage: string; n: string }>(sql`select delivery_stage as stage, count(*) as n from orders_logistics group by 1`);
  return {
    totalVolume: num(tot.volume),
    totalOrders: num(tot.orders),
    escrowHeld: num(tot.escrow_held),
    totalKg: num(tot.kg),
    activeShipments: num(tot.active_shipments),
    activeBids: num(bids.active),
    farmers: num(usr.farmers),
    buyers: num(usr.buyers),
    unverifiedFarmers: num(usr.unverified),
    platformFees: num(fees.fees),
    openDisputes: num(disp.open),
    pendingInspections: num(insp.pending),
    topRegions: regions.map((r) => ({ region: r.region, volume: Math.round(num(r.volume)), orders: num(r.orders) })),
    categories: categories.map((c) => ({ name: c.category, value: Math.round(num(c.volume)) })),
    monthly: fillMonths(monthly.map((m) => ({ month: m.month, volume: num(m.volume), orders: num(m.orders) }))),
    stages: stages.map((s) => ({ stage: s.stage, count: num(s.n) })),
  };
}
