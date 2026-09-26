import { handle, readJson, str } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { raiseDispute } from "@/lib/services/orders";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/orders/:id/dispute { reason } – freezes escrow pending admin review */
export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireUser(["buyer", "farmer"]);
    const b = await readJson(req);
    return raiseDispute(user, Number((await params).id), str(b, "reason", { required: true, max: 1000 })!);
  }, 201);
}
