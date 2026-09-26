import { and, desc, eq, gt, inArray, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { bidsNegotiations, cropsInventory, users, ordersLogistics, orderEvents } from "@/db/schema";
import { ApiError } from "@/lib/api";
import type { SessionUser } from "@/lib/auth";
import { notify } from "@/lib/notify";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const farmer = alias(users, "farmer");
const buyer = alias(users, "buyer");

export async function listBids(user: SessionUser, opts: { status?: string; cropId?: number } = {}) {
  const conds = [];
  if (user.role === "farmer") conds.push(eq(cropsInventory.farmerId, user.id));
  if (user.role === "buyer") conds.push(eq(bidsNegotiations.buyerId, user.id));
  if (opts.status) conds.push(eq(bidsNegotiations.status, opts.status as "pending"));
  if (opts.cropId) conds.push(eq(bidsNegotiations.cropId, opts.cropId));
  const rows = await db
    .select({
      bid: bidsNegotiations,
      cropName: cropsInventory.cropName,
      category: cropsInventory.category,
      qualityGrade: cropsInventory.qualityGrade,
      basePricePerKg: cropsInventory.basePricePerKg,
      availableKg: cropsInventory.totalQuantityKg,
      farmLocation: cropsInventory.farmLocation,
      imagesJson: cropsInventory.imagesJson,
      farmerId: cropsInventory.farmerId,
      farmerName: farmer.fullName,
      buyerName: buyer.fullName,
      buyerBusiness: buyer.businessName,
      buyerCity: buyer.city,
      orderId: ordersLogistics.orderId,
    })
    .from(bidsNegotiations)
    .innerJoin(cropsInventory, eq(cropsInventory.cropId, bidsNegotiations.cropId))
    .innerJoin(farmer, eq(farmer.id, cropsInventory.farmerId))
    .innerJoin(buyer, eq(buyer.id, bidsNegotiations.buyerId))
    .leftJoin(ordersLogistics, eq(ordersLogistics.bidId, bidsNegotiations.bidId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(bidsNegotiations.updatedAt))
    .limit(300);
  return rows.map(({ bid, ...rest }) => ({ ...bid, ...rest }));
}

export type BidInput = { cropId: number; bidPricePerKg: number; bidQuantityKg: number; targetDeliveryDate?: string; message?: string };

async function createBidTx(buyerUser: SessionUser, input: BidInput) {
  const [crop] = await db.select().from(cropsInventory).where(eq(cropsInventory.cropId, input.cropId)).limit(1);
  if (!crop) throw new ApiError(404, "Crop listing not found");
  if (crop.status !== "active") throw new ApiError(409, "This listing is not accepting bids");
  if (input.bidQuantityKg > crop.totalQuantityKg) throw new ApiError(422, `Only ${crop.totalQuantityKg} kg available`);
  if (input.bidPricePerKg < crop.basePricePerKg * 0.5) throw new ApiError(422, "Bid is below 50% of the asking price and was blocked as a lowball offer");
  if (input.targetDeliveryDate && new Date(input.targetDeliveryDate) < new Date(new Date().toISOString().slice(0, 10)))
    throw new ApiError(422, "Target delivery date must be in the future");
  const [dupe] = await db
    .select({ id: bidsNegotiations.bidId })
    .from(bidsNegotiations)
    .where(and(eq(bidsNegotiations.cropId, input.cropId), eq(bidsNegotiations.buyerId, buyerUser.id), inArray(bidsNegotiations.status, ["pending", "countered"])))
    .limit(1);
  if (dupe) throw new ApiError(409, "You already have an open bid on this listing. Revise or withdraw it first.");
  const [row] = await db
    .insert(bidsNegotiations)
    .values({ ...input, buyerId: buyerUser.id, status: "pending" })
    .returning();
  return row;
}

export type BidAction = "accept" | "reject" | "counter" | "accept_counter" | "reject_counter" | "revise" | "withdraw";

/**
 * Negotiation state machine
 *  pending   --farmer:accept-->    accepted (order created @ bid price)
 *  pending   --farmer:reject-->    rejected
 *  pending   --farmer:counter-->   countered (counter_price set)
 *  countered --buyer:accept_counter--> accepted (order created @ counter price)
 *  countered --buyer:reject_counter--> rejected
 *  countered --buyer:revise-->     pending (new bid price, counter cleared)
 *  pending|countered --buyer:withdraw--> withdrawn
 */
async function actOnBidTx(user: SessionUser, bidId: number, action: BidAction, payload: { counterPrice?: number; note?: string; bidPricePerKg?: number }) {
  return db.transaction(async (tx) => {
    const [bid] = await tx.select().from(bidsNegotiations).where(eq(bidsNegotiations.bidId, bidId)).for("update").limit(1);
    if (!bid) throw new ApiError(404, "Bid not found");
    const [crop] = await tx.select().from(cropsInventory).where(eq(cropsInventory.cropId, bid.cropId)).for("update").limit(1);
    const isFarmer = user.role === "farmer" && crop.farmerId === user.id;
    const isBuyer = user.role === "buyer" && bid.buyerId === user.id;
    const now = new Date();

    const need = (cond: boolean, msg: string, status = 409) => {
      if (!cond) throw new ApiError(status, msg);
    };

    switch (action) {
      case "accept": {
        need(isFarmer, "Only the listing owner can accept bids", 403);
        need(bid.status === "pending", `Cannot accept a bid that is ${bid.status}`);
        const order = await convertToOrder(tx, bid, crop, bid.bidPricePerKg, user.id);
        return { bid: { ...bid, status: "accepted" }, order };
      }
      case "reject": {
        need(isFarmer, "Only the listing owner can reject bids", 403);
        need(bid.status === "pending" || bid.status === "countered", `Cannot reject a bid that is ${bid.status}`);
        const [b] = await tx.update(bidsNegotiations).set({ status: "rejected", counterNote: payload.note ?? bid.counterNote, updatedAt: now }).where(eq(bidsNegotiations.bidId, bidId)).returning();
        return { bid: b };
      }
      case "counter": {
        need(isFarmer, "Only the listing owner can counter bids", 403);
        need(bid.status === "pending", `Cannot counter a bid that is ${bid.status}`);
        need(payload.counterPrice !== undefined && payload.counterPrice > 0, "counterPrice is required", 422);
        need(payload.counterPrice! > bid.bidPricePerKg, "Counter price should be higher than the buyer's bid", 422);
        const [b] = await tx.update(bidsNegotiations).set({ status: "countered", counterPrice: payload.counterPrice!, counterNote: payload.note ?? null, updatedAt: now }).where(eq(bidsNegotiations.bidId, bidId)).returning();
        return { bid: b };
      }
      case "accept_counter": {
        need(isBuyer, "Only the bidder can accept a counter-offer", 403);
        need(bid.status === "countered" && bid.counterPrice !== null, "No counter-offer to accept");
        const order = await convertToOrder(tx, bid, crop, bid.counterPrice!, user.id);
        return { bid: { ...bid, status: "accepted" }, order };
      }
      case "reject_counter": {
        need(isBuyer, "Only the bidder can reject a counter-offer", 403);
        need(bid.status === "countered", "No counter-offer to reject");
        const [b] = await tx.update(bidsNegotiations).set({ status: "rejected", updatedAt: now }).where(eq(bidsNegotiations.bidId, bidId)).returning();
        return { bid: b };
      }
      case "revise": {
        need(isBuyer, "Only the bidder can revise a bid", 403);
        need(bid.status === "countered" || bid.status === "pending", `Cannot revise a bid that is ${bid.status}`);
        need(payload.bidPricePerKg !== undefined && payload.bidPricePerKg > 0, "bidPricePerKg is required", 422);
        const [b] = await tx
          .update(bidsNegotiations)
          .set({ status: "pending", bidPricePerKg: payload.bidPricePerKg!, message: payload.note ?? bid.message, updatedAt: now })
          .where(eq(bidsNegotiations.bidId, bidId))
          .returning();
        return { bid: b };
      }
      case "withdraw": {
        need(isBuyer, "Only the bidder can withdraw", 403);
        need(bid.status === "pending" || bid.status === "countered", `Cannot withdraw a bid that is ${bid.status}`);
        const [b] = await tx.update(bidsNegotiations).set({ status: "withdrawn", updatedAt: now }).where(eq(bidsNegotiations.bidId, bidId)).returning();
        return { bid: b };
      }
      default:
        throw new ApiError(422, "Unknown action");
    }
  });
}

async function convertToOrder(tx: Tx, bid: typeof bidsNegotiations.$inferSelect, crop: typeof cropsInventory.$inferSelect, price: number, actorId: number) {
  if (crop.status !== "active") throw new ApiError(409, "Listing is no longer active");
  if (bid.bidQuantityKg > crop.totalQuantityKg) throw new ApiError(409, `Insufficient stock: only ${crop.totalQuantityKg} kg left`);
  const remaining = Math.round((crop.totalQuantityKg - bid.bidQuantityKg) * 100) / 100;
  const now = new Date();

  await tx.update(bidsNegotiations).set({ status: "accepted", bidPricePerKg: price, updatedAt: now }).where(eq(bidsNegotiations.bidId, bid.bidId));
  await tx
    .update(cropsInventory)
    .set({ totalQuantityKg: remaining, status: remaining <= 0 ? "sold_out" : "active" })
    .where(eq(cropsInventory.cropId, crop.cropId));

  // Auto-reject other open bids that can no longer be fulfilled
  await tx
    .update(bidsNegotiations)
    .set({ status: "rejected", counterNote: "Auto-rejected: insufficient remaining stock", updatedAt: now })
    .where(
      and(
        eq(bidsNegotiations.cropId, crop.cropId),
        ne(bidsNegotiations.bidId, bid.bidId),
        inArray(bidsNegotiations.status, ["pending", "countered"]),
        gt(bidsNegotiations.bidQuantityKg, remaining),
      ),
    );

  const total = Math.round(bid.bidQuantityKg * price * 100) / 100;
  const seqRes = await tx.execute(sql`select coalesce(max(order_id), 0) + 1001 as n from orders_logistics`);
  const n = Number((seqRes.rows[0] as { n: number | string }).n);
  const [order] = await tx
    .insert(ordersLogistics)
    .values({
      bidId: bid.bidId,
      cropId: crop.cropId,
      farmerId: crop.farmerId,
      buyerId: bid.buyerId,
      quantityKg: bid.bidQuantityKg,
      pricePerKg: price,
      totalAmount: total,
      paymentStatus: "awaiting_escrow",
      deliveryStage: "confirmed",
      transitLocation: crop.farmLocation,
      trackingNumber: `ML-${now.getFullYear()}-${n}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
      expectedDeliveryDate: bid.targetDeliveryDate,
    })
    .returning();
  await tx.insert(orderEvents).values({ orderId: order.orderId, stage: "confirmed", location: crop.farmLocation, note: `Deal closed at Rs. ${price}/kg for ${bid.bidQuantityKg} kg. Awaiting buyer escrow deposit.`, actorId });
  return order;
}

/* ------------------------------------------------------------------ */
/* Public API with automated notifications                             */
/* ------------------------------------------------------------------ */
const rs = (n: number) => "Rs. " + Math.round(n).toLocaleString("en-US");

export async function createBid(buyerUser: SessionUser, input: BidInput) {
  const bid = await createBidTx(buyerUser, input);
  const [crop] = await db.select({ farmerId: cropsInventory.farmerId, cropName: cropsInventory.cropName }).from(cropsInventory).where(eq(cropsInventory.cropId, input.cropId)).limit(1);
  if (crop) {
    await notify(crop.farmerId, {
      type: "bid",
      title: `New bid on your ${crop.cropName}`,
      body: `${buyerUser.businessName ?? buyerUser.fullName} offered ${rs(input.bidPricePerKg)}/kg for ${input.bidQuantityKg.toLocaleString("en-US")} kg.`,
      link: "/farmer/bids",
      sms: true,
    });
  }
  return bid;
}

export async function actOnBid(user: SessionUser, bidId: number, action: BidAction, payload: { counterPrice?: number; note?: string; bidPricePerKg?: number }) {
  const result = await actOnBidTx(user, bidId, action, payload);
  const [info] = await db
    .select({ buyerId: bidsNegotiations.buyerId, farmerId: cropsInventory.farmerId, cropName: cropsInventory.cropName, qty: bidsNegotiations.bidQuantityKg })
    .from(bidsNegotiations)
    .innerJoin(cropsInventory, eq(cropsInventory.cropId, bidsNegotiations.cropId))
    .where(eq(bidsNegotiations.bidId, bidId))
    .limit(1);
  if (info) {
    const order = (result as { order?: { trackingNumber: string; totalAmount: number } }).order;
    if (order) {
      await notify(info.buyerId, { type: "bid_accepted", title: "Bid accepted: fund escrow to start", body: `Your ${info.cropName} deal (${order.trackingNumber}) is confirmed at ${rs(order.totalAmount)}. Lock the amount in escrow to begin fulfilment.`, link: "/buyer/orders", email: true, sms: true });
      await notify(info.farmerId, { type: "bid_accepted", title: "Deal closed", body: `Order ${order.trackingNumber} for ${info.qty.toLocaleString("en-US")} kg ${info.cropName} created. Waiting for the buyer's escrow deposit.`, link: "/farmer/orders" });
    } else if (action === "counter") {
      await notify(info.buyerId, { type: "bid", title: "Counter-offer received", body: `The farmer countered your ${info.cropName} bid at ${rs(payload.counterPrice ?? 0)}/kg.`, link: "/buyer/bids", sms: true });
    } else if (action === "reject") {
      await notify(info.buyerId, { type: "bid", title: "Bid declined", body: `Your bid on ${info.cropName} was declined.`, link: "/buyer/bids" });
    } else if (action === "revise") {
      await notify(info.farmerId, { type: "bid", title: "Revised bid received", body: `A buyer revised their ${info.cropName} offer to ${rs(payload.bidPricePerKg ?? 0)}/kg.`, link: "/farmer/bids" });
    } else if (action === "reject_counter" || action === "withdraw") {
      await notify(info.farmerId, { type: "bid", title: action === "withdraw" ? "Bid withdrawn" : "Counter-offer declined", body: `The buyer ${action === "withdraw" ? "withdrew their bid" : "declined your counter-offer"} on ${info.cropName}.`, link: "/farmer/bids" });
    }
  }
  return result;
}
