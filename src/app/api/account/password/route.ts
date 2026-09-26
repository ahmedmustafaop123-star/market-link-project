import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ApiError, handle, readJson, str } from "@/lib/api";
import { hashPassword, requireUser, verifyPassword } from "@/lib/auth";

/** PATCH /api/account/password { currentPassword, newPassword }: any signed-in user */
export async function PATCH(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const b = await readJson(req);
    const current = str(b, "currentPassword", { required: true, max: 200 })!;
    const next = str(b, "newPassword", { required: true, max: 200 })!;
    if (next.length < 8) throw new ApiError(422, "New password must be at least 8 characters");
    if (next === current) throw new ApiError(422, "New password must be different from the current one");
    const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, me.id)).limit(1);
    if (!row || !verifyPassword(current, row.hash)) throw new ApiError(401, "Current password is incorrect");
    await db.update(users).set({ passwordHash: hashPassword(next) }).where(eq(users.id, me.id));
    return { changed: true };
  });
}
