import { getCurrentUser } from "@/lib/auth";
import { listOrders } from "@/lib/services/orders";
import { TrackingClient } from "@/components/tracking/tracking-client";

export const metadata = { title: "Shipment tracking" };
export const dynamic = "force-dynamic";

export default async function TrackingPage({ searchParams }: { searchParams: Promise<{ no?: string }> }) {
  const [{ no }, user] = await Promise.all([searchParams, getCurrentUser()]);
  const mine = user && user.role !== "inspector"
    ? (await listOrders(user, { active: true, limit: 12 })).map((o) => ({ trackingNumber: o.trackingNumber, cropName: o.cropName, stage: o.deliveryStage }))
    : [];
  return <TrackingClient initial={no ?? mine[0]?.trackingNumber ?? ""} mine={mine} />;
}
