import { handle, num, readJson, str } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createBid, listBids } from "@/lib/services/bids";

export const dynamic = "force-dynamic";

/** GET /api/bids?status=&cropId= – scoped to the caller's role */
export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const sp = new URL(req.url).searchParams;
    return listBids(user, { status: sp.get("status") || undefined, cropId: sp.get("cropId") ? Number(sp.get("cropId")) : undefined });
  });
}

/** POST /api/bids – buyer submits a bulk purchase offer / RFQ */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser(["buyer"]);
    const b = await readJson(req);
    return createBid(user, {
      cropId: num(b, "cropId", { required: true, min: 1 })!,
      bidPricePerKg: num(b, "bidPricePerKg", { required: true, min: 0.5 })!,
      bidQuantityKg: num(b, "bidQuantityKg", { required: true, min: 1 })!,
      targetDeliveryDate: str(b, "targetDeliveryDate"),
      message: str(b, "message", { max: 500 }),
    });
  }, 201);
}
