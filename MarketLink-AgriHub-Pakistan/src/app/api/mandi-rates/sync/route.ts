import { handle } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { syncMockFeed } from "@/lib/services/mandi";

/** POST /api/mandi-rates/sync – pull today's rates from the (mock) government mandi feed */
export async function POST() {
  return handle(async () => {
    await requireUser(["admin"]);
    return syncMockFeed();
  });
}
