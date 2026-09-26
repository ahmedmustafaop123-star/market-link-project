import { handle } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { trackShipment } from "@/lib/services/tracking";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ trackingNumber: string }> };

/** Public shipment tracking (party names & notes only for order parties / staff). */
export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const viewer = await getCurrentUser();
    return trackShipment(decodeURIComponent((await params).trackingNumber), viewer ? { id: viewer.id, role: viewer.role } : null);
  });
}
