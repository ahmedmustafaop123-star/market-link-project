import { createHash, randomInt } from "crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { authTokens } from "@/db/schema";
import { ApiError } from "@/lib/api";
import { emailConfigured, sendEmail, sendSms } from "@/lib/notify";

export type OtpPurpose = "verify_email" | "reset_password";
const TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_S = 45;
const SECRET = process.env.SESSION_SECRET || "marketlink-agri-hub-dev-secret-change-me";

const hash = (code: string) => createHash("sha256").update(`${code}:${SECRET}`).digest("hex");

/**
 * Issues a 6-digit code, invalidating older ones. Sends it by email (+ SMS copy if phone given).
 * Returns `devCode` only when no email provider is configured, so local/dev installs remain usable.
 */
export async function issueOtp(user: { id: number; email: string; phone?: string | null }, purpose: OtpPurpose) {
  const [last] = await db
    .select({ createdAt: authTokens.createdAt })
    .from(authTokens)
    .where(and(eq(authTokens.userId, user.id), eq(authTokens.purpose, purpose)))
    .orderBy(desc(authTokens.createdAt))
    .limit(1);
  if (last && Date.now() - new Date(last.createdAt).getTime() < RESEND_COOLDOWN_S * 1000) {
    throw new ApiError(429, `Please wait ${RESEND_COOLDOWN_S} seconds before requesting another code`);
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.update(authTokens).set({ usedAt: new Date() }).where(and(eq(authTokens.userId, user.id), eq(authTokens.purpose, purpose), isNull(authTokens.usedAt)));
  await db.insert(authTokens).values({ userId: user.id, purpose, codeHash: hash(code), expiresAt: new Date(Date.now() + TTL_MIN * 60_000) });

  const subject = purpose === "verify_email" ? "Verify your MarketLink account" : "Reset your MarketLink password";
  const text = `Your MarketLink ${purpose === "verify_email" ? "verification" : "password reset"} code is ${code}.\nIt expires in ${TTL_MIN} minutes. If you didn't request this, ignore this message.`;
  await sendEmail(user.email, subject, text);
  if (user.phone && purpose === "reset_password") await sendSms(user.phone, `MarketLink code: ${code} (valid ${TTL_MIN} min)`);
  return { sent: true, expiresInMinutes: TTL_MIN, ...(emailConfigured() ? {} : { devCode: code }) };
}

export async function consumeOtp(userId: number, purpose: OtpPurpose, code: string) {
  const [tok] = await db
    .select()
    .from(authTokens)
    .where(and(eq(authTokens.userId, userId), eq(authTokens.purpose, purpose), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date())))
    .orderBy(desc(authTokens.createdAt))
    .limit(1);
  if (!tok) throw new ApiError(400, "Code expired or not found. Request a new one.");
  if (tok.attempts >= MAX_ATTEMPTS) throw new ApiError(429, "Too many wrong attempts. Request a new code.");
  if (tok.codeHash !== hash(code.trim())) {
    await db.update(authTokens).set({ attempts: tok.attempts + 1 }).where(eq(authTokens.tokenId, tok.tokenId));
    throw new ApiError(400, `Incorrect code (${MAX_ATTEMPTS - tok.attempts - 1} attempts left)`);
  }
  await db.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.tokenId, tok.tokenId));
}
