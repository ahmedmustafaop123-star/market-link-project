import { handle, oneOf, readJson, str } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { processPayout } from "@/lib/services/payments";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH { status: "paid" | "rejected", note? }: admin settles a payout */
export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const admin = await requireUser(["admin"]);
    const b = await readJson(req);
    return processPayout(admin, Number((await params).id), oneOf(b, "status", ["paid", "rejected"] as const, true)!, str(b, "note", { max: 500 }));
  });
}
