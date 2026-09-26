import { handle } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listDisputes } from "@/lib/services/orders";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    await requireUser(["admin"]);
    return listDisputes();
  });
}
