import { handle } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listOrders } from "@/lib/services/orders";

export const dynamic = "force-dynamic";

/** GET /api/orders?active=1 – orders with logistics events, scoped by role */
export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const active = new URL(req.url).searchParams.get("active") === "1";
    return listOrders(user, { active });
  });
}
