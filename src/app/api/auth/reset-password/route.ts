import { handle, readJson, str } from "@/lib/api";
import { inspectResetToken, resetPassword } from "@/lib/reset";

export const dynamic = "force-dynamic";

/** GET /api/auth/reset-password?token=… → { valid, email (masked), expiresAt } */
export async function GET(req: Request) {
  return handle(async () => inspectResetToken(new URL(req.url).searchParams.get("token") ?? ""));
}

/** POST /api/auth/reset-password { token, newPassword } → bcrypt-hashes the new password and clears the token */
export async function POST(req: Request) {
  return handle(async () => {
    const b = await readJson(req);
    return resetPassword(str(b, "token", { required: true, max: 200 })!, str(b, "newPassword", { required: true, max: 200 })!);
  });
}
