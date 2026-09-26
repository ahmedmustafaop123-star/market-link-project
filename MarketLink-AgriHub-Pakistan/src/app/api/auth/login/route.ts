import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ApiError, handle, readJson, str } from "@/lib/api";
import { hashPassword, homeFor, startSession, verifyPassword } from "@/lib/auth";
import { isLegacyHash } from "@/lib/password";
import { issueOtp } from "@/lib/otp";
import { ensureSeeded } from "@/lib/seed";

// Brute-force protection: 10 failed attempts / 15 min per email.
const failures = new Map<string, number[]>();

export async function POST(req: Request) {
  return handle(async () => {
    await ensureSeeded();
    const body = await readJson(req);
    const email = str(body, "email", { required: true })!.toLowerCase();
    const password = str(body, "password", { required: true })!;
    const recent = (failures.get(email) ?? []).filter((t) => Date.now() - t < 15 * 60_000);
    if (recent.length >= 10) throw new ApiError(429, "Too many failed attempts. Try again in 15 minutes or reset your password.");

    const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!u || !verifyPassword(password, u.passwordHash)) {
      failures.set(email, [...recent, Date.now()]);
      throw new ApiError(401, "Invalid email or password");
    }
    failures.delete(email);
    if (isLegacyHash(u.passwordHash)) await db.update(users).set({ passwordHash: hashPassword(password) }).where(eq(users.id, u.id)); // upgrade to bcrypt

    if (!u.emailVerified) {
      let devCode: string | undefined;
      try {
        devCode = (await issueOtp(u, "verify_email")).devCode;
      } catch {
        /* cooldown: an earlier code is still valid */
      }
      throw new ApiError(403, "Please verify your email address first. We sent you a code.", { code: "EMAIL_NOT_VERIFIED", email: u.email, devCode });
    }
    await startSession(u.id, u.role);
    return { id: u.id, fullName: u.fullName, role: u.role, redirectTo: homeFor(u.role) };
  });
}
