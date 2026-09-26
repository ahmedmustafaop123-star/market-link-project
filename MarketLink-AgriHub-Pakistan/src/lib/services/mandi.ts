import { and, asc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { mandiRates } from "@/db/schema";
import { ApiError } from "@/lib/api";
import { CROP_CATALOGUE, MANDI_MARKETS, todayISO } from "@/lib/constants";

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const r2 = (x: number) => Math.round(x * 100) / 100;

export type LatestRate = {
  rateId: number;
  cropName: string;
  marketLocation: string;
  minPricePerKg: number;
  maxPricePerKg: number;
  avgPricePerKg: number;
  prevAvg: number | null;
  changePct: number | null;
  source: string;
  dateUpdated: string;
};

export async function latestRates(filters: { crop?: string; market?: string } = {}): Promise<LatestRate[]> {
  const res = await db.execute(sql`
    with ranked as (
      select *, row_number() over (partition by crop_name, market_location order by date_updated desc) as rn
      from mandi_rates
    )
    select a.rate_id, a.crop_name, a.market_location, a.min_price_per_kg, a.max_price_per_kg, a.avg_price_per_kg,
           a.source, a.date_updated::text as date_updated, b.avg_price_per_kg as prev_avg
    from ranked a
    left join ranked b on b.crop_name = a.crop_name and b.market_location = a.market_location and b.rn = 2
    where a.rn = 1
      ${filters.crop ? sql`and a.crop_name = ${filters.crop}` : sql``}
      ${filters.market ? sql`and a.market_location = ${filters.market}` : sql``}
    order by a.crop_name, a.market_location`);
  return (res.rows as Record<string, unknown>[]).map((r) => {
    const avg = Number(r.avg_price_per_kg);
    const prev = n(r.prev_avg);
    return {
      rateId: Number(r.rate_id),
      cropName: String(r.crop_name),
      marketLocation: String(r.market_location),
      minPricePerKg: Number(r.min_price_per_kg),
      maxPricePerKg: Number(r.max_price_per_kg),
      avgPricePerKg: avg,
      prevAvg: prev,
      changePct: prev ? r2(((avg - prev) / prev) * 100) : null,
      source: String(r.source),
      dateUpdated: String(r.date_updated),
    };
  });
}

/** Daily avg price per market for a crop – pivoted for charting. */
export async function rateTrend(cropName: string, days = 14) {
  const since = todayISO(-days + 1);
  const rows = await db
    .select()
    .from(mandiRates)
    .where(and(eq(mandiRates.cropName, cropName), gte(mandiRates.dateUpdated, since)))
    .orderBy(asc(mandiRates.dateUpdated));
  const byDate = new Map<string, Record<string, number | string>>();
  for (const r of rows) {
    const d = byDate.get(r.dateUpdated) ?? { date: r.dateUpdated };
    d[r.marketLocation] = r.avgPricePerKg;
    byDate.set(r.dateUpdated, d);
  }
  return { cropName, markets: MANDI_MARKETS, series: [...byDate.values()] };
}

/** Mandi (market) rate vs. MarketLink platform rates per crop. */
export async function platformComparison() {
  const res = await db.execute(sql`
    with latest as (
      select distinct on (crop_name, market_location) crop_name, avg_price_per_kg
      from mandi_rates order by crop_name, market_location, date_updated desc
    ),
    mandi as (select crop_name, avg(avg_price_per_kg) as mandi_avg from latest group by crop_name),
    ask as (select crop_name, avg(base_price_per_kg) as ask_avg, sum(total_quantity_kg) as supply_kg from crops_inventory where status = 'active' group by crop_name),
    deal as (
      select c.crop_name, sum(o.total_amount) / nullif(sum(o.quantity_kg), 0) as deal_avg
      from orders_logistics o join crops_inventory c on c.crop_id = o.crop_id
      where o.created_at > now() - interval '90 days' and o.payment_status <> 'refunded'
      group by c.crop_name
    )
    select m.crop_name, m.mandi_avg, a.ask_avg, a.supply_kg, d.deal_avg
    from mandi m left join ask a on a.crop_name = m.crop_name left join deal d on d.crop_name = m.crop_name
    order by m.crop_name`);
  return (res.rows as Record<string, unknown>[]).map((r) => {
    const mandi = r2(Number(r.mandi_avg));
    const ask = n(r.ask_avg);
    const deal = n(r.deal_avg);
    return {
      cropName: String(r.crop_name),
      mandiAvg: mandi,
      platformAsk: ask === null ? null : r2(ask),
      platformDeal: deal === null ? null : r2(deal),
      supplyKg: n(r.supply_kg) ?? 0,
      farmerGainPct: deal ? r2(((deal - mandi) / mandi) * 100) : null,
    };
  });
}

export type RateInput = { cropName: string; marketLocation: string; minPricePerKg: number; maxPricePerKg: number; avgPricePerKg?: number; dateUpdated?: string; source?: string };

export async function upsertRate(input: RateInput) {
  if (input.minPricePerKg > input.maxPricePerKg) throw new ApiError(422, "Min price cannot exceed max price");
  const avg = input.avgPricePerKg ?? r2((input.minPricePerKg + input.maxPricePerKg) / 2);
  if (avg < input.minPricePerKg || avg > input.maxPricePerKg) throw new ApiError(422, "Average must be between min and max");
  const values = {
    cropName: input.cropName,
    marketLocation: input.marketLocation,
    minPricePerKg: input.minPricePerKg,
    maxPricePerKg: input.maxPricePerKg,
    avgPricePerKg: avg,
    source: input.source ?? "manual",
    dateUpdated: input.dateUpdated ?? todayISO(),
  };
  const [row] = await db
    .insert(mandiRates)
    .values(values)
    .onConflictDoUpdate({
      target: [mandiRates.cropName, mandiRates.marketLocation, mandiRates.dateUpdated],
      set: { minPricePerKg: values.minPricePerKg, maxPricePerKg: values.maxPricePerKg, avgPricePerKg: values.avgPricePerKg, source: values.source },
    })
    .returning();
  return row;
}

/**
 * Mock external feed (e.g. AMIS / Bureau of Statistics) sync:
 * takes each crop x market latest rate and applies a bounded random walk (±3%)
 * then upserts today's rate with source = 'feed'.
 */
export async function syncMockFeed() {
  const latest = await latestRates();
  const today = todayISO();
  const known = new Set(latest.map((l) => `${l.cropName}|${l.marketLocation}`));
  let updated = 0;
  await db.transaction(async (tx) => {
    const rows: (typeof mandiRates.$inferInsert)[] = [];
    for (const l of latest) {
      const drift = 1 + (Math.random() - 0.5) * 0.06;
      const avg = r2(l.avgPricePerKg * drift);
      const spread = r2(avg * (0.05 + Math.random() * 0.05));
      rows.push({ cropName: l.cropName, marketLocation: l.marketLocation, minPricePerKg: r2(avg - spread), maxPricePerKg: r2(avg + spread), avgPricePerKg: avg, source: "feed", dateUpdated: today });
    }
    // Seed any catalogue crop/market combination missing from history
    for (const c of CROP_CATALOGUE)
      for (const m of MANDI_MARKETS)
        if (!known.has(`${c.name}|${m}`)) {
          const avg = c.mandiBase;
          rows.push({ cropName: c.name, marketLocation: m, minPricePerKg: r2(avg * 0.93), maxPricePerKg: r2(avg * 1.07), avgPricePerKg: avg, source: "feed", dateUpdated: today });
        }
    if (rows.length) {
      await tx
        .insert(mandiRates)
        .values(rows)
        .onConflictDoUpdate({
          target: [mandiRates.cropName, mandiRates.marketLocation, mandiRates.dateUpdated],
          set: {
            minPricePerKg: sql`excluded.min_price_per_kg`,
            maxPricePerKg: sql`excluded.max_price_per_kg`,
            avgPricePerKg: sql`excluded.avg_price_per_kg`,
            source: sql`excluded.source`,
          },
        });
      updated = rows.length;
    }
  });
  return { updated, date: today, syncedAt: new Date().toISOString() };
}
