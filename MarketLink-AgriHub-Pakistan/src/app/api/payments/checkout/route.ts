import { handle, num, oneOf, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createCheckout, providerStatus } from "@/lib/services/payments";

export const dynamic = "force-dynamic";

/** GET: which gateways are enabled on this server */
export async function GET() {
  return handle(async () => {
    await requireUser(["buyer", "farmer"]);
    return providerStatus();
  });
}

/** POST { provider, amount }: creates a payment intent and returns the gateway redirect URL / auto-submit form */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser(["buyer"]);
    const b = await readJson(req);
    return createCheckout(user, oneOf(b, "provider", ["stripe", "jazzcash", "easypaisa", "sandbox"] as const, true)!, num(b, "amount", { required: true, min: 1000, max: 50_000_000 })!, req);
  }, 201);
}
