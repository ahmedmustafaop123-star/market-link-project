import { handle } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { adminStats, buyerStats, farmerStats } from "@/lib/services/analytics";

export const dynamic = "force-dynamic";

/** GET /api/analytics – role-aware dashboard KPIs */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    if (user.role === "farmer") return farmerStats(user.id);
    if (user.role === "buyer") return buyerStats(user.id);
    return adminStats();
  });
}
