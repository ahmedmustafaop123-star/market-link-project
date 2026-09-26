import { handle } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getIntent } from "@/lib/services/payments";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ reference: string }> };

/** GET /api/payments/:reference: poll payment status after returning from the gateway */
export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => getIntent(await requireUser(), (await params).reference));
}
