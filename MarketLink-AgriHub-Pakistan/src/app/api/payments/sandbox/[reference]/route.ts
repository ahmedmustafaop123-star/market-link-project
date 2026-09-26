import { ApiError, handle, oneOf, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { completeIntent, getIntent, providerStatus, sandboxSignature } from "@/lib/services/payments";

type Ctx = { params: Promise<{ reference: string }> };

/**
 * Test gateway: simulates the provider calling our callback.
 * The callback is HMAC-signed server-side and goes through the same completeIntent() path as real gateways.
 * Disable in production with PAYMENTS_SANDBOX=false.
 */
export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    if (!providerStatus().sandbox.enabled) throw new ApiError(403, "Test gateway is disabled on this server");
    const user = await requireUser(["buyer"]);
    const { reference } = await params;
    const intent = await getIntent(user, reference);
    if (intent.provider !== "sandbox") throw new ApiError(400, "Not a test-gateway payment");
    const outcome = oneOf(await readJson(req), "outcome", ["success", "failed"] as const, true)!;
    const done = await completeIntent(reference, outcome === "success", `SBX-${Date.now()}`, { outcome, signature: sandboxSignature(reference, outcome) });
    return { reference, status: done.status };
  });
}
