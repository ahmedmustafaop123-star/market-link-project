import { asc, eq, and } from "drizzle-orm";
import { db } from "@/db";
import { ordersLogistics, orderEvents, cropsInventory, users } from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { ApiError } from "@/lib/api";
import { CITIES, DELIVERY_STAGES, distanceKm, type DeliveryStage } from "@/lib/constants";
import { notify } from "@/lib/notify";

type Pt = { lat: number; lng: number };
const AVG_SPEED_KMH = 45; // loaded truck on Pakistani highways incl. stops

/** Resolve "Multan", "Multan, Punjab" or "Khanewal Bypass, N-5" to coordinates when possible. */
export function geocode(label: string | null | undefined): Pt | null {
  if (!label) return null;
  const hit = Object.keys(CITIES).find((c) => label.toLowerCase().includes(c.toLowerCase()));
  return hit ? { lat: CITIES[hit].lat, lng: CITIES[hit].lng } : null;
}

/** Gently curved road-like path (quadratic Bézier) between two points. */
export function routePath(a: Pt, b: Pt, steps = 40): Pt[] {
  const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
  const dx = b.lng - a.lng, dy = b.lat - a.lat;
  const ctrl = { lat: mid.lat - dx * 0.12, lng: mid.lng + dy * 0.12 };
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    return { lat: (1 - t) ** 2 * a.lat + 2 * (1 - t) * t * ctrl.lat + t ** 2 * b.lat, lng: (1 - t) ** 2 * a.lng + 2 * (1 - t) * t * ctrl.lng + t ** 2 * b.lng };
  });
}

const pointAt = (path: Pt[], t: number) => path[Math.round(Math.max(0, Math.min(1, t)) * (path.length - 1))];

const EVENT_LABEL: Record<string, string> = {
  confirmed: "Order placed", escrow_locked: "Payment secured in escrow", quality_checked: "Quality inspected", dispatched: "Dispatched from farm",
  in_transit: "In transit", location_update: "Checkpoint", gps_ping: "GPS update", arriving: "Arriving soon", delivered: "Delivered",
  escrow_released: "Payment released to farmer", escrow_refunded: "Buyer refunded", dispute_opened: "Dispute opened",
};

/**
 * Shipment snapshot for the tracking page.
 * Position source: latest driver GPS ping if present, otherwise a time-based simulation along the route
 * (progress = time since "in transit" / expected travel time at 45 km/h).
 * Crossing 85% of the route fires a one-time "Arriving soon" milestone + buyer notification.
 */
export async function trackShipment(trackingNumber: string, viewer?: { id: number; role: string } | null) {
  const farmer = alias(users, "farmer");
  const buyer = alias(users, "buyer");
  const [row] = await db
    .select({ o: ordersLogistics, cropName: cropsInventory.cropName, farmLocation: cropsInventory.farmLocation, buyerCity: buyer.city, farmerName: farmer.businessName, buyerName: buyer.businessName })
    .from(ordersLogistics)
    .innerJoin(cropsInventory, eq(cropsInventory.cropId, ordersLogistics.cropId))
    .innerJoin(farmer, eq(farmer.id, ordersLogistics.farmerId))
    .innerJoin(buyer, eq(buyer.id, ordersLogistics.buyerId))
    .where(eq(ordersLogistics.trackingNumber, trackingNumber.trim().toUpperCase()))
    .limit(1);
  if (!row) throw new ApiError(404, "No shipment found with this tracking number");
  const o = row.o;
  const events = await db.select().from(orderEvents).where(eq(orderEvents.orderId, o.orderId)).orderBy(asc(orderEvents.createdAt));

  const origin = geocode(row.farmLocation) ?? { lat: 30.37, lng: 69.34 };
  const dest = geocode(row.buyerCity) ?? origin;
  const path = routePath(origin, dest);
  const km = Math.round(distanceKm(origin, dest) * 1.25); // road factor
  const travelMs = Math.max(2, km / AVG_SPEED_KMH) * 3600_000;
  const stage = o.deliveryStage as DeliveryStage;
  const transitEvt = [...events].reverse().find((e) => e.stage === "in_transit");
  const lastPing = [...events].reverse().find((e) => e.stage === "gps_ping" && e.lat !== null && e.lng !== null);

  let progress = 0;
  let source: "gps" | "simulated" | "fixed" = "fixed";
  let current: Pt = origin;
  if (stage === "delivered") { progress = 1; current = dest; }
  else if (stage === "in_transit" && o.paymentStatus !== "disputed") {
    if (lastPing && (!transitEvt || lastPing.createdAt >= transitEvt.createdAt)) {
      current = { lat: lastPing.lat!, lng: lastPing.lng! };
      const total = distanceKm(origin, dest) || 1;
      progress = Math.max(0, Math.min(0.99, 1 - distanceKm(current, dest) / total));
      source = "gps";
    } else {
      const since = transitEvt ? Date.now() - new Date(transitEvt.createdAt).getTime() : 0;
      progress = Math.min(0.97, since / travelMs);
      current = pointAt(path, progress);
      source = "simulated";
    }
  }
  const eta = stage === "delivered" ? null : stage === "in_transit" ? new Date(Date.now() + (1 - progress) * travelMs) : o.expectedDeliveryDate ? new Date(o.expectedDeliveryDate) : null;

  // Automated milestone: arriving soon
  if (stage === "in_transit" && progress >= 0.85 && !events.some((e) => e.stage === "arriving")) {
    const [ev] = await db.insert(orderEvents).values({ orderId: o.orderId, stage: "arriving", location: `~${Math.max(1, Math.round((1 - progress) * km))} km from ${row.buyerCity}`, lat: current.lat, lng: current.lng, note: "Shipment is close to the destination" }).returning();
    events.push(ev);
    await notify(o.buyerId, { type: "shipment", title: "Your shipment is arriving soon", body: `${row.cropName} (${o.trackingNumber}) is about ${Math.round((1 - progress) * km)} km from ${row.buyerCity}.`, link: `/tracking?no=${o.trackingNumber}`, sms: true });
  }
  if (source !== "fixed") await db.update(ordersLogistics).set({ currentLat: current.lat, currentLng: current.lng }).where(eq(ordersLogistics.orderId, o.orderId));

  const isParty = !!viewer && (viewer.id === o.farmerId || viewer.id === o.buyerId || viewer.role === "admin" || viewer.role === "inspector");
  return {
    trackingNumber: o.trackingNumber,
    cropName: row.cropName,
    quantityKg: o.quantityKg,
    stage,
    stageLabel: DELIVERY_STAGES.find((s) => s.key === stage)?.label ?? stage,
    payment: o.paymentStatus === "escrow_locked" ? "Secured in escrow" : o.paymentStatus === "released" ? "Paid" : o.paymentStatus === "disputed" ? "On hold (dispute)" : o.paymentStatus === "refunded" ? "Refunded" : "Awaiting escrow",
    disputed: o.paymentStatus === "disputed",
    origin: { city: row.farmLocation, ...origin },
    destination: { city: row.buyerCity, ...dest },
    current: { ...current, progress: Math.round(progress * 1000) / 10, source },
    route: path,
    distanceKm: km,
    eta: eta?.toISOString() ?? null,
    lastUpdate: events.at(-1)?.createdAt ?? o.updatedAt,
    events: events.map((e) => ({ id: e.eventId, stage: e.stage, label: EVENT_LABEL[e.stage] ?? e.stage.replace(/_/g, " "), location: e.location, lat: e.lat, lng: e.lng, note: isParty ? e.note : null, at: e.createdAt })),
    parties: isParty ? { farmer: row.farmerName, buyer: row.buyerName } : undefined,
  };
}

/** Driver/farmer GPS ping while the truck is moving. */
export async function recordGpsPing(user: { id: number; role: string }, orderId: number, lat: number, lng: number, label?: string) {
  if (lat < 23 || lat > 37.5 || lng < 60 || lng > 78) throw new ApiError(422, "Coordinates must be inside Pakistan");
  const [o] = await db.select().from(ordersLogistics).where(eq(ordersLogistics.orderId, orderId)).limit(1);
  if (!o) throw new ApiError(404, "Order not found");
  if (!(user.role === "admin" || user.id === o.farmerId)) throw new ApiError(403, "Only the shipping farmer or an admin can send GPS updates");
  if (!["dispatched", "in_transit"].includes(o.deliveryStage)) throw new ApiError(409, "GPS updates are accepted only while the shipment is moving");
  await db.update(ordersLogistics).set({ currentLat: lat, currentLng: lng, transitLocation: label ?? o.transitLocation, updatedAt: new Date() }).where(eq(ordersLogistics.orderId, orderId));
  const [ev] = await db.insert(orderEvents).values({ orderId, stage: "gps_ping", lat, lng, location: label ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`, actorId: user.id }).returning();
  return ev;
}

export async function orderIdByTracking(trackingNumber: string) {
  const [o] = await db.select({ id: ordersLogistics.orderId }).from(ordersLogistics).where(and(eq(ordersLogistics.trackingNumber, trackingNumber))).limit(1);
  return o?.id ?? null;
}
