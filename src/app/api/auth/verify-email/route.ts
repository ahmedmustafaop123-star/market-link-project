import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ApiError, handle, readJson, str } from "@/lib/api";
import { homeFor, startSession } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { consumeOtp, issueOtp } from "@/lib/otp";

/**
 * POST /api/auth/verify-email { email, code }   → verifies, signs the user in
 * POST /api/auth/verify-email { email, resend: true } → sends a new code
 */
export async function POST(req: Request) {
  return handle(async () => {
    const b = await readJson(req);
    const email = str(b, "email", { required: true, max: 160 })!.toLowerCase();
    const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!u) throw new ApiError(400, "Code expired or not found. Request a new one.");
    if (b.resend === true) {
      if (u.emailVerified) return { alreadyVerified: true };
      return issueOtp(u, "verify_email");
    }
    const code = str(b, "code", { required: true, max: 10 })!;
    if (!u.emailVerified) {
      await consumeOtp(u.id, "verify_email", code);
      await db.update(users).set({ emailVerified: true }).where(eq(users.id, u.id));
      await notify(u.id, {
        type: "welcome",
        title: "Welcome to MarketLink",
        body: u.role === "farmer" ? "Your email is verified. List your first crop. It goes live after a quick identity check." : "Your email is verified. Add funds to your wallet and start sourcing directly from farms.",
        link: homeFor(u.role),
        email: true,
      });
    }
    await startSession(u.id, u.role);
    return { verified: true, redirectTo: homeFor(u.role) };
  });
}
