import { handle, oneOf, readJson, str } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { resolveDispute } from "@/lib/services/orders";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/admin/disputes/:id { outcome: 'investigating'|'release'|'refund', resolution } */
export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const admin = await requireUser(["admin"]);
    const b = await readJson(req);
    return resolveDispute(admin, Number((await params).id), oneOf(b, "outcome", ["investigating", "release", "refund"] as const, true)!, str(b, "resolution", { max: 1000 }));
  });
}
