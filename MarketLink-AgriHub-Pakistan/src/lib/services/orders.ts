import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { ordersLogistics, orderEvents, cropsInventory, users, walletTransactions, disputes, qualityInspections } from "@/db/schema";
import { ApiError } from "@/lib/api";
import type { SessionUser } from "@/lib/auth";
import { DELIVERY_STAGES, PLATFORM_FEE_RATE, nextStage, type DeliveryStage } from "@/lib/constants";
import { notify } from "@/lib/notify";
import { geocode } from "@/lib/services/tracking";
import { recomputeTrust } from "@/lib/services/reviews";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const farmer = alias(users, "farmer");
const buyer = alias(users, "buyer");
const r2 = (n: number) => Math.round(n * 100) / 100;

export async function listOrders(user: SessionUser, opts: { active?: boolean; limit?: number } = {}) {
  const conds = [];
  if (user.role === "farmer") conds.push(eq(ordersLogistics.farmerId, user.id));
  if (user.role === "buyer") conds.push(eq(ordersLogistics.buyerId, user.id));
  if (opts.active) conds.push(or(inArray(ordersLogistics.deliveryStage, ["confirmed", "quality_checked", "dispatched", "in_transit"]), eq(ordersLogistics.paymentStatus, "disputed"))!);
  const rows = await db
    .select({
      order: ordersLogistics,
      cropName: cropsInventory.cropName,
      category: cropsInventory.category,
      qualityGrade: cropsInventory.qualityGrade,
      farmLocation: cropsInventory.farmLocation,
      imagesJson: cropsInventory.imagesJson,
      farmerName: farmer.fullName,
      farmName: farmer.businessName,
      buyerName: buyer.fullName,
      buyerBusiness: buyer.businessName,
      buyerCity: buyer.city,
    })
    .from(ordersLogistics)
    .innerJoin(cropsInventory, eq(cropsInventory.cropId, ordersLogistics.cropId))
    .innerJoin(farmer, eq(farmer.id, ordersLogistics.farmerId))
    .innerJoin(buyer, eq(buyer.id, ordersLogistics.buyerId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(ordersLogistics.createdAt))
    .limit(opts.limit ?? 200);

  const ids = rows.map((r) => r.order.orderId);
  const events = ids.length
    ? await db.select().from(orderEvents).where(inArray(orderEvents.orderId, ids)).orderBy(asc(orderEvents.createdAt))
    : [];
  const openDisputes = ids.length
    ? await db.select().from(disputes).where(inArray(disputes.orderId, ids)).orderBy(desc(disputes.createdAt))
    : [];
  return rows.map(({ order, ...rest }) => ({
    ...order,
    ...rest,
    events: events.filter((e) => e.orderId === order.orderId),
    disputes: openDisputes.filter((d) => d.orderId === order.orderId),
  }));
}

export type OrderView = Awaited<ReturnType<typeof listOrders>>[number];

async function lockOrder(tx: Tx, orderId: number) {
  const [o] = await tx.select().from(ordersLogistics).where(eq(ordersLogistics.orderId, orderId)).for("update").limit(1);
  if (!o) throw new ApiError(404, "Order not found");
  return o;
}

function assertParty(user: SessionUser, o: typeof ordersLogistics.$inferSelect) {
  if (user.role === "admin" || user.role === "inspector") return;
  if (user.id !== o.farmerId && user.id !== o.buyerId) throw new ApiError(403, "Not a party to this order");
}

/** Buyer locks the order amount from wallet into escrow. */
async function lockEscrowTx(user: SessionUser, orderId: number) {
  return db.transaction(async (tx) => {
    const o = await lockOrder(tx, orderId);
    if (user.role !== "buyer" || o.buyerId !== user.id) throw new ApiError(403, "Only the buyer can fund escrow");
    if (o.paymentStatus !== "awaiting_escrow") throw new ApiError(409, `Escrow already ${o.paymentStatus.replace("_", " ")}`);
    const [b] = await tx.select().from(users).where(eq(users.id, user.id)).for("update").limit(1);
    if (b.walletBalance < o.totalAmount) throw new ApiError(402, `Insufficient wallet balance. Need Rs. ${o.totalAmount.toLocaleString()}, have Rs. ${b.walletBalance.toLocaleString()}`);
    await tx.update(users).set({ walletBalance: r2(b.walletBalance - o.totalAmount), escrowBalance: r2(b.escrowBalance + o.totalAmount) }).where(eq(users.id, b.id));
    await tx.insert(walletTransactions).values({ userId: b.id, orderId, type: "escrow_lock", amount: o.totalAmount, description: `Escrow locked for ${o.trackingNumber}` });
    const [updated] = await tx.update(ordersLogistics).set({ paymentStatus: "escrow_locked", updatedAt: new Date() }).where(eq(ordersLogistics.orderId, orderId)).returning();
    await tx.insert(orderEvents).values({ orderId, stage: "escrow_locked", note: "Buyer funds secured in MarketLink escrow", actorId: user.id });
    return updated;
  });
}

async function releaseEscrow(tx: Tx, o: typeof ordersLogistics.$inferSelect, actorId: number, note: string) {
  const [b] = await tx.select().from(users).where(eq(users.id, o.buyerId)).for("update").limit(1);
  const [f] = await tx.select().from(users).where(eq(users.id, o.farmerId)).for("update").limit(1);
  const fee = r2(o.totalAmount * PLATFORM_FEE_RATE);
  const payout = r2(o.totalAmount - fee);
  await tx.update(users).set({ escrowBalance: r2(Math.max(0, b.escrowBalance - o.totalAmount)) }).where(eq(users.id, b.id));
  await tx.update(users).set({ walletBalance: r2(f.walletBalance + payout) }).where(eq(users.id, f.id));
  await tx.insert(walletTransactions).values([
    { userId: b.id, orderId: o.orderId, type: "escrow_release", amount: o.totalAmount, description: `Escrow released for ${o.trackingNumber}` },
    { userId: f.id, orderId: o.orderId, type: "payout", amount: payout, description: `Payout for ${o.trackingNumber}` },
    { userId: f.id, orderId: o.orderId, type: "platform_fee", amount: fee, description: "1.5% platform fee" },
  ]);
  await tx.insert(orderEvents).values({ orderId: o.orderId, stage: "escrow_released", note, actorId });
}

async function refundEscrow(tx: Tx, o: typeof ordersLogistics.$inferSelect, actorId: number, note: string) {
  const [b] = await tx.select().from(users).where(eq(users.id, o.buyerId)).for("update").limit(1);
  await tx.update(users).set({ escrowBalance: r2(Math.max(0, b.escrowBalance - o.totalAmount)), walletBalance: r2(b.walletBalance + o.totalAmount) }).where(eq(users.id, b.id));
  await tx.insert(walletTransactions).values({ userId: b.id, orderId: o.orderId, type: "refund", amount: o.totalAmount, description: `Refund for ${o.trackingNumber}` });
  await tx.insert(orderEvents).values({ orderId: o.orderId, stage: "escrow_refunded", note, actorId });
}

/**
 * Order status progression:
 *  confirmed -> quality_checked   (admin / quality inspector; requires escrow_locked)
 *  quality_checked -> dispatched  (farmer or admin)
 *  dispatched -> in_transit       (farmer or admin, with transit location)
 *  in_transit -> delivered        (buyer confirms receipt -> escrow auto-released to farmer)
 */
async function advanceOrderTx(
  user: SessionUser,
  orderId: number,
  input: { location?: string; note?: string; moisture?: number; grade?: "A" | "B" | "C" },
) {
  return db.transaction(async (tx) => {
    const o = await lockOrder(tx, orderId);
    assertParty(user, o);
    if (o.paymentStatus === "disputed") throw new ApiError(409, "Order is under dispute; progression is frozen");
    if (o.paymentStatus === "refunded") throw new ApiError(409, "Order was refunded");
    const next = nextStage(o.deliveryStage as DeliveryStage);
    if (!next) throw new ApiError(409, "Order already delivered");
    if (o.paymentStatus !== "escrow_locked") throw new ApiError(409, "Buyer must lock funds in escrow before the order can progress");

    const allowed: Record<DeliveryStage, SessionUser["role"][]> = {
      confirmed: [],
      quality_checked: ["inspector", "admin"],
      dispatched: ["farmer", "admin"],
      in_transit: ["farmer", "admin"],
      delivered: ["buyer", "admin"],
    };
    if (!allowed[next].includes(user.role)) {
      const label = DELIVERY_STAGES.find((s) => s.key === next)!.label;
      throw new ApiError(403, `'${label}' must be performed by: ${allowed[next].join(" / ")}`);
    }
    if (user.role === "farmer" && o.farmerId !== user.id) throw new ApiError(403, "Not your order");
    if (user.role === "buyer" && o.buyerId !== user.id) throw new ApiError(403, "Not your order");

    const location = input.location || (next === "delivered" ? "Buyer warehouse" : o.transitLocation) || null;
    const now = new Date();

    if (next === "quality_checked") {
      await tx.insert(qualityInspections).values({
        cropId: o.cropId,
        inspectorId: user.id,
        gradeAssigned: input.grade ?? "A",
        moistureLevelPercentage: input.moisture ?? 12,
        inspectionNotes: input.note ?? `Pre-dispatch inspection for ${o.trackingNumber}`,
        status: "passed",
        verifiedAt: now,
      });
    }

    const [updated] = await tx
      .update(ordersLogistics)
      .set({ deliveryStage: next, transitLocation: location, updatedAt: now, ...(next === "delivered" ? { paymentStatus: "released" as const } : {}) })
      .where(eq(ordersLogistics.orderId, orderId))
      .returning();
    const pt = geocode(location);
    if (pt) await tx.update(ordersLogistics).set({ currentLat: pt.lat, currentLng: pt.lng }).where(eq(ordersLogistics.orderId, orderId));
    await tx.insert(orderEvents).values({
      orderId,
      stage: next,
      location,
      lat: pt?.lat ?? null,
      lng: pt?.lng ?? null,
      note: input.note || DELIVERY_STAGES.find((s) => s.key === next)!.label,
      actorId: user.id,
    });
    if (next === "delivered") {
      await releaseEscrow(tx, o, user.id, "Delivery verified by buyer. Escrow released to farmer (1.5% platform fee deducted).");
    }
    return updated;
  });
}

export async function updateTransitLocation(user: SessionUser, orderId: number, location: string) {
  return db.transaction(async (tx) => {
    const o = await lockOrder(tx, orderId);
    if (!(user.role === "admin" || user.id === o.farmerId)) throw new ApiError(403, "Only the farmer or admin can update location");
    if (!["dispatched", "in_transit"].includes(o.deliveryStage)) throw new ApiError(409, "Location updates are only available while shipment is moving");
    const [u] = await tx.update(ordersLogistics).set({ transitLocation: location, updatedAt: new Date() }).where(eq(ordersLogistics.orderId, orderId)).returning();
    await tx.insert(orderEvents).values({ orderId, stage: "location_update", location, note: `Shipment checkpoint: ${location}`, actorId: user.id });
    return u;
  });
}

async function raiseDisputeTx(user: SessionUser, orderId: number, reason: string) {
  return db.transaction(async (tx) => {
    const o = await lockOrder(tx, orderId);
    if (user.id !== o.buyerId && user.id !== o.farmerId) throw new ApiError(403, "Only order parties can raise disputes");
    if (o.paymentStatus !== "escrow_locked") throw new ApiError(409, "Disputes can only be raised while funds are held in escrow");
    await tx.update(ordersLogistics).set({ paymentStatus: "disputed", updatedAt: new Date() }).where(eq(ordersLogistics.orderId, orderId));
    const [d] = await tx.insert(disputes).values({ orderId, raisedBy: user.id, reason, status: "open" }).returning();
    await tx.insert(orderEvents).values({ orderId, stage: "dispute_opened", note: reason, actorId: user.id });
    return d;
  });
}

export async function listDisputes() {
  const raiser = alias(users, "raiser");
  return db
    .select({
      dispute: disputes,
      trackingNumber: ordersLogistics.trackingNumber,
      totalAmount: ordersLogistics.totalAmount,
      paymentStatus: ordersLogistics.paymentStatus,
      deliveryStage: ordersLogistics.deliveryStage,
      raisedByName: raiser.fullName,
      raisedByRole: raiser.role,
      cropName: cropsInventory.cropName,
    })
    .from(disputes)
    .innerJoin(ordersLogistics, eq(ordersLogistics.orderId, disputes.orderId))
    .innerJoin(raiser, eq(raiser.id, disputes.raisedBy))
    .innerJoin(cropsInventory, eq(cropsInventory.cropId, ordersLogistics.cropId))
    .orderBy(sql`case when ${disputes.status} in ('open','investigating') then 0 else 1 end`, desc(disputes.createdAt))
    .then((rows) => rows.map(({ dispute, ...rest }) => ({ ...dispute, ...rest })));
}

async function resolveDisputeTx(admin: SessionUser, disputeId: number, outcome: "investigating" | "release" | "refund", resolution?: string) {
  return db.transaction(async (tx) => {
    const [d] = await tx.select().from(disputes).where(eq(disputes.disputeId, disputeId)).for("update").limit(1);
    if (!d) throw new ApiError(404, "Dispute not found");
    if (d.status === "resolved_release" || d.status === "resolved_refund") throw new ApiError(409, "Dispute already resolved");
    if (outcome === "investigating") {
      const [u] = await tx.update(disputes).set({ status: "investigating", resolution: resolution ?? d.resolution }).where(eq(disputes.disputeId, disputeId)).returning();
      return u;
    }
    const o = await lockOrder(tx, d.orderId);
    if (!resolution) throw new ApiError(422, "Resolution notes are required");
    if (o.paymentStatus === "disputed") {
      if (outcome === "release") {
        await releaseEscrow(tx, o, admin.id, `Dispute resolved in farmer's favour: ${resolution}`);
        await tx.update(ordersLogistics).set({ paymentStatus: "released", deliveryStage: "delivered", updatedAt: new Date() }).where(eq(ordersLogistics.orderId, o.orderId));
      } else {
        await refundEscrow(tx, o, admin.id, `Dispute resolved in buyer's favour: ${resolution}`);
        await tx.update(ordersLogistics).set({ paymentStatus: "refunded", updatedAt: new Date() }).where(eq(ordersLogistics.orderId, o.orderId));
      }
    }
    const [u] = await tx
      .update(disputes)
      .set({ status: outcome === "release" ? "resolved_release" : "resolved_refund", resolution, resolvedAt: new Date() })
      .where(eq(disputes.disputeId, disputeId))
      .returning();
    return u;
  });
}

export async function getWallet(user: SessionUser) {
  const [u] = await db.select({ walletBalance: users.walletBalance, escrowBalance: users.escrowBalance }).from(users).where(eq(users.id, user.id));
  const txns = await db.select().from(walletTransactions).where(eq(walletTransactions.userId, user.id)).orderBy(desc(walletTransactions.createdAt)).limit(100);
  const pending = await db
    .select({ total: sql<number>`coalesce(sum(${ordersLogistics.totalAmount}),0)`.mapWith(Number) })
    .from(ordersLogistics)
    .where(and(user.role === "farmer" ? eq(ordersLogistics.farmerId, user.id) : eq(ordersLogistics.buyerId, user.id), inArray(ordersLogistics.paymentStatus, ["escrow_locked", "disputed"])));
  return { ...u, pendingInEscrow: pending[0].total, transactions: txns };
}

export async function deposit(user: SessionUser, amount: number) {
  return db.transaction(async (tx) => {
    const [u] = await tx.select().from(users).where(eq(users.id, user.id)).for("update");
    await tx.update(users).set({ walletBalance: r2(u.walletBalance + amount) }).where(eq(users.id, user.id));
    await tx.insert(walletTransactions).values({ userId: user.id, type: "deposit", amount, description: "Wallet top-up via IBFT / JazzCash / Easypaisa (simulated)" });
    return { walletBalance: r2(u.walletBalance + amount) };
  });
}

/* ------------------------------------------------------------------ */
/* Public API with automated milestone notifications                   */
/* ------------------------------------------------------------------ */
const rs = (n: number) => "Rs. " + Math.round(n).toLocaleString("en-US");

async function orderInfo(orderId: number) {
  const [r] = await db
    .select({ o: ordersLogistics, cropName: cropsInventory.cropName })
    .from(ordersLogistics)
    .innerJoin(cropsInventory, eq(cropsInventory.cropId, ordersLogistics.cropId))
    .where(eq(ordersLogistics.orderId, orderId))
    .limit(1);
  return r;
}

export async function lockEscrow(user: SessionUser, orderId: number) {
  const res = await lockEscrowTx(user, orderId);
  const i = await orderInfo(orderId);
  if (i) {
    await notify(i.o.farmerId, { type: "escrow_locked", title: "Escrow funded: prepare for inspection", body: `The buyer secured ${rs(i.o.totalAmount)} in escrow for ${i.cropName} (${i.o.trackingNumber}). A quality inspector will verify the lot before dispatch.`, link: "/farmer/orders", email: true, sms: true });
    const inspectors = await db.select({ id: users.id }).from(users).where(eq(users.role, "inspector"));
    await Promise.all(inspectors.map((x) => notify(x.id, { type: "inspection", title: "Pre-dispatch inspection needed", body: `${i.cropName}, ${i.o.quantityKg.toLocaleString("en-US")} kg (${i.o.trackingNumber}) is ready for quality inspection.`, link: "/inspector/dashboard" })));
  }
  return res;
}

export async function advanceOrder(user: SessionUser, orderId: number, input: { location?: string; note?: string; moisture?: number; grade?: "A" | "B" | "C" }) {
  const res = await advanceOrderTx(user, orderId, input);
  const i = await orderInfo(orderId);
  if (i) {
    const { o, cropName } = i;
    const track = `/tracking?no=${o.trackingNumber}`;
    if (o.deliveryStage === "quality_checked") {
      await notify(o.farmerId, { type: "inspection", title: "Quality inspection passed", body: `${cropName} (${o.trackingNumber}) passed inspection. You can dispatch now.`, link: "/farmer/orders" });
      await notify(o.buyerId, { type: "inspection", title: "Your order passed quality inspection", body: `${cropName} (${o.trackingNumber}) was graded ${input.grade ?? "A"} by a MarketLink inspector.`, link: track });
    } else if (o.deliveryStage === "dispatched") {
      await notify(o.buyerId, { type: "shipment", title: "Shipment dispatched", body: `${cropName} (${o.trackingNumber}) left ${o.transitLocation ?? "the farm"}.${input.note ? ` ${input.note}` : ""}`, link: track, email: true, sms: true });
    } else if (o.deliveryStage === "in_transit") {
      await notify(o.buyerId, { type: "shipment", title: "Shipment on the road", body: `${cropName} (${o.trackingNumber}) is in transit. Follow it live on the map.`, link: track });
    } else if (o.deliveryStage === "delivered") {
      await notify(o.farmerId, { type: "delivered", title: "Delivered: payment released", body: `${cropName} (${o.trackingNumber}) was delivered. ${rs(o.totalAmount * (1 - PLATFORM_FEE_RATE))} has been credited to your wallet.`, link: "/wallet", email: true, sms: true });
      await notify(o.buyerId, { type: "delivered", title: "Order delivered: rate your seller", body: `Thanks for confirming delivery of ${o.trackingNumber}. Tell other buyers how it went.`, link: "/buyer/dashboard", email: true });
      await recomputeTrust(o.farmerId);
    }
  }
  return res;
}

export async function raiseDispute(user: SessionUser, orderId: number, reason: string) {
  const res = await raiseDisputeTx(user, orderId, reason);
  const i = await orderInfo(orderId);
  if (i) {
    const other = user.id === i.o.buyerId ? i.o.farmerId : i.o.buyerId;
    await notify(other, { type: "dispute", title: "A dispute was opened on your order", body: `${i.o.trackingNumber}: "${reason.slice(0, 140)}". Escrow is frozen until an admin resolves it.`, link: user.id === i.o.buyerId ? "/farmer/orders" : "/buyer/orders", email: true });
    const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
    await Promise.all(admins.map((a) => notify(a.id, { type: "dispute", title: "New dispute", body: `${i.o.trackingNumber} (${rs(i.o.totalAmount)}): ${reason.slice(0, 140)}`, link: "/admin/orders" })));
  }
  return res;
}

export async function resolveDispute(admin: SessionUser, disputeId: number, outcome: "investigating" | "release" | "refund", resolution?: string) {
  const res = await resolveDisputeTx(admin, disputeId, outcome, resolution);
  if (outcome !== "investigating") {
    const [d] = await db.select({ orderId: disputes.orderId }).from(disputes).where(eq(disputes.disputeId, disputeId)).limit(1);
    const i = d && (await orderInfo(d.orderId));
    if (i) {
      const msg = outcome === "release" ? "resolved in the farmer's favour. Payment released." : "resolved in the buyer's favour. The buyer was refunded.";
      await notify(i.o.farmerId, { type: "dispute", title: "Dispute resolved", body: `${i.o.trackingNumber} ${msg}`, link: "/farmer/orders", email: true });
      await notify(i.o.buyerId, { type: "dispute", title: "Dispute resolved", body: `${i.o.trackingNumber} ${msg}`, link: "/buyer/orders", email: true });
      await recomputeTrust(i.o.farmerId);
    }
  }
  return res;
}
