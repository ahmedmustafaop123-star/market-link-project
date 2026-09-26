import { handle, num, oneOf, readJson, str } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { actOnBid } from "@/lib/services/bids";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/bids/:id  { action, counterPrice?, bidPricePerKg?, note? } */
export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireUser(["farmer", "buyer"]);
    const b = await readJson(req);
    const action = oneOf(b, "action", ["accept", "reject", "counter", "accept_counter", "reject_counter", "revise", "withdraw"] as const, true)!;
    return actOnBid(user, Number((await params).id), action, {
      counterPrice: num(b, "counterPrice", { min: 0.5 }),
      bidPricePerKg: num(b, "bidPricePerKg", { min: 0.5 }),
      note: str(b, "note", { max: 500 }),
    });
  });
}
