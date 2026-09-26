import { ApiError, handle, oneOf, readJson, str } from "@/lib/api";
import { googleMockEnabled, mockSub, provisionGoogleUser, safeNext } from "@/lib/google";

/**
 * POST /api/auth/google/test { email, name, role, next }
 * Google test mode (only when Google credentials are NOT configured and GOOGLE_OAUTH_MOCK≠false).
 * Runs the same provisioning code; can only create/sign into accounts created by test mode.
 */
export async function POST(req: Request) {
  return handle(async () => {
    if (!googleMockEnabled()) throw new ApiError(404, "Not available");
    const b = await readJson(req);
    const email = str(b, "email", { required: true, max: 160 })!.toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ApiError(422, "Enter a valid email address");
    const name = str(b, "name", { max: 120 }) || email.split("@")[0];
    const role = oneOf(b, "role", ["buyer", "farmer"] as const) ?? "buyer";
    const r = await provisionGoogleUser({ sub: mockSub(email), email, email_verified: true, name }, role, true);
    const next = safeNext(str(b, "next", { max: 300 }));
    return { created: r.created, redirectTo: r.redirectTo.startsWith("/account") ? r.redirectTo : (next ?? r.redirectTo) };
  });
}
