import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ApiError } from "@/lib/api";
import { homeFor, startSession } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { unusablePasswordHash } from "@/lib/password";

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */
export const googleConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
/** Test mode (no Google credentials): enabled unless GOOGLE_OAUTH_MOCK=false. Can only create/sign into its own test accounts. */
export const googleMockEnabled = () => !googleConfigured() && process.env.GOOGLE_OAUTH_MOCK !== "false";

// Endpoint overrides exist only for automated tests.
const AUTH_URL = () => process.env.GOOGLE_AUTH_URL || "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = () => process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";
const USERINFO_URL = () => process.env.GOOGLE_USERINFO_URL || "https://openidconnect.googleapis.com/v1/userinfo";

const SECRET = process.env.SESSION_SECRET || "marketlink-agri-hub-dev-secret-change-me";
export const OAUTH_COOKIE = "ml_oauth";

export function publicOrigin(req: Request) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return new URL(req.url).origin;
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
export const callbackUrl = (req: Request) => process.env.GOOGLE_CALLBACK_URL || `${publicOrigin(req)}/api/auth/google/callback`;

export type SignupRole = "buyer" | "farmer";
export const safeNext = (n: string | null | undefined) => (n && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/api/") ? n : null);

/* ------------------------------------------------------------------ */
/* Signed, short-lived state cookie (CSRF state + PKCE verifier)       */
/* ------------------------------------------------------------------ */
type OAuthState = { state: string; verifier: string; role: SignupRole; next: string | null; ts: number };

export function sealState(s: OAuthState) {
  const body = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${body}.${createHmac("sha256", SECRET).update(body).digest("base64url")}`;
}
export function openState(cookie: string | undefined): OAuthState | null {
  if (!cookie) return null;
  const [body, sig] = cookie.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", SECRET).update(body).digest("base64url");
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  const s = JSON.parse(Buffer.from(body, "base64url").toString()) as OAuthState;
  return Date.now() - s.ts < 10 * 60_000 ? s : null;
}

/** Step 1: build the Google consent-screen URL (Authorization Code flow + PKCE S256). */
export function buildAuthRequest(req: Request, role: SignupRole, next: string | null) {
  const state = randomBytes(16).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = new URL(AUTH_URL());
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: callbackUrl(req),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
    access_type: "online",
  }).toString();
  return { url: url.toString(), cookie: sealState({ state, verifier, role, next, ts: Date.now() }) };
}

export type GoogleProfile = { sub: string; email: string; email_verified: boolean; name?: string; picture?: string };

/** Step 2: exchange the authorization code for tokens and fetch the verified profile. */
export async function exchangeCode(req: Request, code: string, verifier: string): Promise<GoogleProfile> {
  const tokenRes = await fetch(TOKEN_URL(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: callbackUrl(req),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  const tokens = (await tokenRes.json().catch(() => ({}))) as { access_token?: string; error?: string; error_description?: string };
  if (!tokenRes.ok || !tokens.access_token) throw new ApiError(502, `Google token exchange failed: ${tokens.error_description ?? tokens.error ?? tokenRes.status}`);
  const infoRes = await fetch(USERINFO_URL(), { headers: { Authorization: `Bearer ${tokens.access_token}` } });
  const p = (await infoRes.json().catch(() => ({}))) as Partial<GoogleProfile>;
  if (!infoRes.ok || !p.sub || !p.email) throw new ApiError(502, "Could not read your Google profile");
  if (p.email_verified !== true) throw new ApiError(403, "Your Google email address is not verified");
  return { sub: p.sub, email: p.email.toLowerCase(), email_verified: true, name: p.name, picture: p.picture };
}

/* ------------------------------------------------------------------ */
/* User provisioning                                                   */
/* ------------------------------------------------------------------ */
/**
 * Existing Google ID → sign in. Existing email → link Google to that account and sign in.
 * New email → create an account (role buyer/farmer, auto-verified email, Google profile picture).
 * In test mode (`mock`), only accounts created by test mode can be accessed.
 */
export async function provisionGoogleUser(p: GoogleProfile, role: SignupRole, mock = false) {
  let [u] = await db.select().from(users).where(eq(users.googleId, p.sub)).limit(1);
  let created = false;
  if (!u) {
    const [byEmail] = await db.select().from(users).where(eq(users.email, p.email)).limit(1);
    if (byEmail) {
      if (mock) throw new ApiError(409, "This email already has a MarketLink account. Sign in with your password (Google test mode can't access existing accounts).");
      [u] = await db
        .update(users)
        .set({ googleId: p.sub, avatarUrl: byEmail.avatarUrl ?? p.picture ?? null, emailVerified: true })
        .where(eq(users.id, byEmail.id))
        .returning();
    } else {
      [u] = await db
        .insert(users)
        .values({
          fullName: (p.name || p.email.split("@")[0]).slice(0, 120),
          email: p.email,
          passwordHash: unusablePasswordHash(),
          phone: "",
          city: "",
          role,
          isVerified: role === "buyer",
          emailVerified: true,
          walletBalance: 0,
          avatarUrl: p.picture ?? null,
          googleId: p.sub,
          authProvider: mock ? "google_test" : "google",
        })
        .returning();
      created = true;
      await notify(u.id, {
        type: "welcome",
        title: "Welcome to MarketLink",
        body: role === "farmer" ? "Your account was created with Google. Add your phone and farm location to start listing crops." : "Your account was created with Google. Add your phone and city, then fund your wallet to start buying.",
        link: "/account?complete=1",
        email: true,
      });
    }
  } else if (mock && u.authProvider !== "google_test") {
    throw new ApiError(409, "This account requires real Google sign-in.");
  }
  await startSession(u.id, u.role);
  const incomplete = !u.phone || !u.city;
  return { user: u, created, redirectTo: incomplete ? "/account?complete=1" : homeFor(u.role) };
}

/** Relative redirect that keeps cookies set via next/headers (Location may be relative per RFC 7231). */
export const redirectTo = (location: string, status = 302) => new Response(null, { status, headers: { Location: location, "Cache-Control": "no-store" } });

export const mockSub = (email: string) => `test-${createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 24)}`;
