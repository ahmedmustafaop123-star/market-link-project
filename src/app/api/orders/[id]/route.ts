import { ApiError, handle, num, oneOf, readJson, str } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { advanceOrder, listOrders, lockEscrow, updateTransitLocation } from "@/lib/services/orders";

type Ctx = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const id = Number((await params).id);
    const order = (await listOrders(user, { limit: 1000 })).find((o) => o.orderId === id);
    if (!order) throw new ApiError(404, "Order not found");
    return order;
  });
}

/** PATCH /api/orders/:id  { action: 'lock_escrow' | 'advance' | 'update_location', location?, note?, grade?, moisture? } */
export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const id = Number((await params).id);
    const b = await readJson(req);
    const action = oneOf(b, "action", ["lock_escrow", "advance", "update_location"] as const, true)!;
    if (action === "lock_escrow") return lockEscrow(user, id);
    if (action === "update_location") return updateTransitLocation(user, id, str(b, "location", { required: true, max: 120 })!);
    return advanceOrder(user, id, {
      location: str(b, "location", { max: 120 }),
      note: str(b, "note", { max: 500 }),
      grade: oneOf(b, "grade", ["A", "B", "C"] as const),
      moisture: num(b, "moisture", { min: 0, max: 100 }),
    });
  });
}
