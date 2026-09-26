import { createHash, randomBytes } from "crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { authTokens, users } from "@/db/schema";
import { ApiError } from "@/lib/api";
import { emailConfigured, notify, sendEmail } from "@/lib/notify";
import { hashPassword } from "@/lib/password";

const PURPOSE = "reset_link";
export const RESET_TTL_MIN = 15;
const COOLDOWN_S = 30;
const sha = (t: string) => createHash("sha256").update(t).digest("hex");

/**
 * On-screen "simulated email" links are a development aid used ONLY when no email provider is configured.
 * They are never shown for staff accounts (admin / inspector), and can be switched off with AUTH_DEV_LINKS=false.
 */
function devLinksAllowed(role: string) {
  return !emailConfigured() && process.env.AUTH_DEV_LINKS !== "false" && role !== "admin" && role !== "inspector";
}

function baseUrl(req: Request) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return host ? `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}` : new URL(req.url).origin;
}

/** POST /api/auth/forgot-password: always returns the same message so account existence isn't revealed. */
export async function requestPasswordReset(emailRaw: string, req: Request) {
  const email = emailRaw.trim().toLowerCase();
  const generic = { sent: true, message: `If an account exists for ${email}, a reset link valid for ${RESET_TTL_MIN} minutes has been sent.` };
  const [u] = await db.select({ id: users.id, email: users.email, role: users.role }).from(users).where(eq(users.email, email)).limit(1);
  if (!u) return generic;

  const [last] = await db.select({ createdAt: authTokens.createdAt }).from(authTokens)
    .where(and(eq(authTokens.userId, u.id), eq(authTokens.purpose, PURPOSE))).orderBy(desc(authTokens.createdAt)).limit(1);
  if (last && Date.now() - new Date(last.createdAt).getTime() < COOLDOWN_S * 1000) {
    throw new ApiError(429, `A reset link was just sent. Please wait ${COOLDOWN_S} seconds before requesting another.`);
  }

  const token = randomBytes(32).toString("base64url");
  await db.delete(authTokens).where(and(eq(authTokens.userId, u.id), eq(authTokens.purpose, PURPOSE)));
  await db.insert(authTokens).values({ userId: u.id, purpose: PURPOSE, codeHash: sha(token), expiresAt: new Date(Date.now() + RESET_TTL_MIN * 60_000) });

  const path = `/reset-password?token=${token}`;
  const link = `${baseUrl(req)}${path}`;
  await sendEmail(
    u.email,
    "Reset your MarketLink password",
    `We received a request to reset your MarketLink password.\n\nOpen this link to choose a new password (valid for ${RESET_TTL_MIN} minutes, single use):\n${link}\n\nIf you didn't request this, you can ignore this email. Your password won't change.`,
  );
  return devLinksAllowed(u.role) ? { ...generic, devResetUrl: path } : generic;
}

async function findValid(token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const [row] = await db
    .select({ tokenId: authTokens.tokenId, userId: authTokens.userId, expiresAt: authTokens.expiresAt, email: users.email })
    .from(authTokens)
    .innerJoin(users, eq(users.id, authTokens.userId))
    .where(and(eq(authTokens.codeHash, sha(token)), eq(authTokens.purpose, PURPOSE), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

/** GET /api/auth/reset-password?token=… : lets the page show "link expired" before the user types anything. */
export async function inspectResetToken(token: string) {
  const row = await findValid(token);
  if (!row) throw new ApiError(400, "This reset link is invalid or has expired. Please request a new one.");
  const [name, domain] = row.email.split("@");
  return { valid: true, email: `${name.slice(0, 2)}${"•".repeat(Math.max(1, name.length - 2))}@${domain}`, expiresAt: row.expiresAt };
}

/** POST /api/auth/reset-password: validates the token, stores a bcrypt hash, and clears the token (single use). */
export async function resetPassword(token: string, newPassword: string) {
  if (newPassword.length < 8) throw new ApiError(422, "Password must be at least 8 characters");
  if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) throw new ApiError(422, "Use at least one letter and one number");
  const row = await findValid(token);
  if (!row) throw new ApiError(400, "This reset link is invalid or has expired. Please request a new one.");
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: hashPassword(newPassword), emailVerified: true }).where(eq(users.id, row.userId));
    await tx.delete(authTokens).where(and(eq(authTokens.userId, row.userId), eq(authTokens.purpose, PURPOSE)));
  });
  await notify(row.userId, { type: "security", title: "Your password was changed", body: "If this wasn't you, reset your password immediately and contact MarketLink support.", email: true });
  return { reset: true, email: row.email };
}
