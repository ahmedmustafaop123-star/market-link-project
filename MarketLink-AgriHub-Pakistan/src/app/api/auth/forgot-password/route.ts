import { ApiError, handle, readJson, str } from "@/lib/api";
import { requestPasswordReset } from "@/lib/reset";

// Per-IP throttle: 8 requests / 10 minutes
const hits = new Map<string, number[]>();

/**
 * POST /api/auth/forgot-password { email }
 * Generates a secure single-use reset token (15-minute expiry) and emails a /reset-password?token=… link.
 * Always responds with the same message (no account enumeration).
 */
export async function POST(req: Request) {
  return handle(async () => {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
    const recent = (hits.get(ip) ?? []).filter((t) => Date.now() - t < 10 * 60_000);
    if (recent.length >= 8) throw new ApiError(429, "Too many reset requests. Try again in a few minutes.");
    hits.set(ip, [...recent, Date.now()]);
    const b = await readJson(req);
    const email = str(b, "email", { required: true, max: 160 })!;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ApiError(422, "Enter a valid email address");
    return requestPasswordReset(email, req);
  });
}
