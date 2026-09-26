import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { ordersLogistics, reviews, users, cropsInventory } from "@/db/schema";
import { ApiError } from "@/lib/api";
import type { SessionUser } from "@/lib/auth";
import { notify } from "@/lib/notify";

/**
 * Seller trust score (1.00–5.00):
 *   Bayesian average of verified reviews (prior 4.0 weighted as 3 reviews)
 *   + up to 0.20 for completed deliveries, + 0.10 if identity-verified
 *   − 1.5 × dispute rate.  Recomputed on every new review / delivery / dispute resolution.
 */
export async function recomputeTrust(farmerId: number) {
  const res = await db.execute(sql`
    select
      (select count(*) from reviews r where r.farmer_id = ${farmerId})::int as n,
      (select coalesce(sum(rating),0) from reviews r where r.farmer_id = ${farmerId})::int as total,
      (select count(*) from orders_logistics o where o.farmer_id = ${farmerId} and o.payment_status = 'released')::int as delivered,
      (select count(*) from disputes d join orders_logistics o on o.order_id = d.order_id where o.farmer_id = ${farmerId})::int as disputes,
      (select is_verified from users where id = ${farmerId}) as verified`);
  const r = res.rows[0] as { n: number; total: number; delivered: number; disputes: number; verified: boolean };
  const n = Number(r.n), total = Number(r.total), delivered = Number(r.delivered), disputes = Number(r.disputes);
  const avg = n ? total / n : 0;
  const bayes = (3 * 4.0 + total) / (3 + n);
  const score = Math.max(1, Math.min(5, bayes + Math.min(0.2, delivered * 0.02) + (r.verified ? 0.1 : 0) - (delivered ? (disputes / delivered) * 1.5 : 0)));
  await db.update(users).set({ trustScore: Math.round(score * 100) / 100, ratingAvg: Math.round(avg * 100) / 100, ratingCount: n }).where(eq(users.id, farmerId));
  return { trustScore: score, ratingAvg: avg, ratingCount: n };
}

export async function recomputeAllTrust() {
  const farmers = await db.select({ id: users.id }).from(users).where(eq(users.role, "farmer"));
  for (const f of farmers) await recomputeTrust(f.id);
}

export async function createReview(buyer: SessionUser, orderId: number, rating: number, comment?: string) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ApiError(422, "Rating must be 1 to 5 stars");
  const [o] = await db.select().from(ordersLogistics).where(eq(ordersLogistics.orderId, orderId)).limit(1);
  if (!o) throw new ApiError(404, "Order not found");
  if (o.buyerId !== buyer.id) throw new ApiError(403, "Only the buyer of this order can review it");
  if (o.deliveryStage !== "delivered" || o.paymentStatus !== "released") throw new ApiError(409, "You can review a seller after the order is delivered and paid");
  const [existing] = await db.select({ id: reviews.reviewId }).from(reviews).where(eq(reviews.orderId, orderId)).limit(1);
  if (existing) throw new ApiError(409, "You already reviewed this order");
  const [row] = await db.insert(reviews).values({ orderId, buyerId: buyer.id, farmerId: o.farmerId, rating, comment: comment?.trim() || null }).returning();
  const trust = await recomputeTrust(o.farmerId);
  await notify(o.farmerId, { type: "review", title: `New ${rating}★ review`, body: `${buyer.businessName ?? buyer.fullName} rated order ${o.trackingNumber}${comment ? `: "${comment.slice(0, 120)}"` : "."}`, link: "/farmer/dashboard" });
  return { review: row, trust };
}

export async function listReviews(farmerId: number, limit = 20) {
  return db
    .select({
      reviewId: reviews.reviewId,
      orderId: reviews.orderId,
      rating: reviews.rating,
      comment: reviews.comment,
      farmerReply: reviews.farmerReply,
      repliedAt: reviews.repliedAt,
      createdAt: reviews.createdAt,
      buyerName: users.businessName,
      buyerFullName: users.fullName,
      cropId: cropsInventory.cropId,
      cropName: cropsInventory.cropName,
    })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.buyerId))
    .innerJoin(ordersLogistics, eq(ordersLogistics.orderId, reviews.orderId))
    .innerJoin(cropsInventory, eq(cropsInventory.cropId, ordersLogistics.cropId))
    .where(eq(reviews.farmerId, farmerId))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
}

/** Delivered orders of this buyer that don't have a review yet. */
export async function pendingReviews(buyerId: number) {
  const rows = await db.execute(sql`
    select o.order_id, o.tracking_number, c.crop_name, coalesce(u.business_name, u.full_name) as farmer, o.updated_at
    from orders_logistics o
    join crops_inventory c on c.crop_id = o.crop_id
    join users u on u.id = o.farmer_id
    where o.buyer_id = ${buyerId} and o.delivery_stage = 'delivered' and o.payment_status = 'released'
      and not exists (select 1 from reviews r where r.order_id = o.order_id)
    order by o.updated_at desc limit 10`);
  return (rows.rows as { order_id: number; tracking_number: string; crop_name: string; farmer: string; updated_at: string }[]).map((r) => ({
    orderId: Number(r.order_id), trackingNumber: r.tracking_number, cropName: r.crop_name, farmer: r.farmer, deliveredAt: r.updated_at,
  }));
}

export async function respondToReview(farmer: SessionUser, reviewId: number, message: string) {
  const reply = message.trim();
  if (reply.length < 2 || reply.length > 600) throw new ApiError(422, "Reply must be between 2 and 600 characters");

  const saved = await db.transaction(async (tx) => {
    const [review] = await tx.select().from(reviews).where(eq(reviews.reviewId, reviewId)).for("update").limit(1);
    if (!review) throw new ApiError(404, "Review not found");
    if (review.farmerId !== farmer.id) throw new ApiError(403, "You may respond only to reviews of your own sales");
    if (review.farmerReply !== null) throw new ApiError(409, "You have already responded to this review");
    const [updated] = await tx
      .update(reviews)
      .set({ farmerReply: reply, repliedAt: new Date() })
      .where(eq(reviews.reviewId, reviewId))
      .returning();
    return updated;
  });

  const [order] = await db.select({ cropId: ordersLogistics.cropId }).from(ordersLogistics).where(eq(ordersLogistics.orderId, saved.orderId)).limit(1);
  await notify(saved.buyerId, {
    type: "review_reply",
    title: "Farmer replied to your review",
    body: `${farmer.businessName ?? farmer.fullName}: “${reply.slice(0, 180)}”`,
    link: order ? `/crop/${order.cropId}` : "/buyer/dashboard",
  });
  return saved;
}

export async function hasReviewed(orderIds: number[]) {
  if (!orderIds.length) return new Set<number>();
  const rows = await db.select({ orderId: reviews.orderId }).from(reviews).where(and(sql`${reviews.orderId} in (${sql.join(orderIds.map((i) => sql`${i}`), sql`, `)})`));
  return new Set(rows.map((r) => r.orderId));
}
