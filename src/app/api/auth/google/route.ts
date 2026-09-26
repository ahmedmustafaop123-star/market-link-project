import { cookies } from "next/headers";
import { OAUTH_COOKIE, buildAuthRequest, googleConfigured, googleMockEnabled, redirectTo, safeNext } from "@/lib/google";

export const dynamic = "force-dynamic";

/** GET /api/auth/google?role=buyer|farmer&next=/path → redirects to Google's consent screen */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const role = sp.get("role") === "farmer" ? "farmer" : "buyer";
  const next = safeNext(sp.get("next"));
  if (!googleConfigured()) {
    if (googleMockEnabled()) return redirectTo(`/auth/google-test?role=${role}${next ? `&next=${encodeURIComponent(next)}` : ""}`);
    return redirectTo("/login?error=google_not_configured");
  }
  const { url, cookie } = buildAuthRequest(req, role, next);
  (await cookies()).set(OAUTH_COOKIE, cookie, { httpOnly: true, sameSite: "lax", secure: process.env.COOKIE_SECURE === "true", path: "/api/auth/google", maxAge: 600 });
  return redirectTo(url);
}
