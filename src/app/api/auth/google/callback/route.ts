import { cookies } from "next/headers";
import { OAUTH_COOKIE, exchangeCode, openState, provisionGoogleUser, redirectTo } from "@/lib/google";

export const dynamic = "force-dynamic";

const fail = (msg: string) => redirectTo(`/login?error=google_failed&msg=${encodeURIComponent(msg)}`);

/** GET /api/auth/google/callback?code&state → verifies state, exchanges the code, provisions the user, starts a session */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const store = await cookies();
  const saved = openState(store.get(OAUTH_COOKIE)?.value);
  store.delete({ name: OAUTH_COOKIE, path: "/api/auth/google" });

  if (sp.get("error")) return fail(sp.get("error") === "access_denied" ? "Google sign-in was cancelled" : `Google returned: ${sp.get("error")}`);
  const code = sp.get("code");
  if (!saved || !code || sp.get("state") !== saved.state) return fail("Your sign-in session expired or was tampered with. Please try again.");
  try {
    const profile = await exchangeCode(req, code, saved.verifier);
    const r = await provisionGoogleUser(profile, saved.role);
    return redirectTo(r.redirectTo.startsWith("/account") ? r.redirectTo : (saved.next ?? r.redirectTo));
  } catch (e) {
    console.error("[google oauth]", e);
    return fail((e as Error).message || "Google sign-in failed");
  }
}
