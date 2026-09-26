import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { handle, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET: latest 30 notifications + unread count */
export async function GET() {
  return handle(async () => {
    const u = await requireUser();
    const items = await db.select().from(notifications).where(eq(notifications.userId, u.id)).orderBy(desc(notifications.createdAt)).limit(30);
    const [{ n }] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(notifications).where(and(eq(notifications.userId, u.id), eq(notifications.isRead, false)));
    return { unread: n, items };
  });
}

/** PATCH { ids?: number[] }: mark given (or all) notifications as read */
export async function PATCH(req: Request) {
  return handle(async () => {
    const u = await requireUser();
    const b = await readJson(req).catch(() => ({}) as Record<string, unknown>);
    const ids = Array.isArray(b.ids) ? (b.ids as unknown[]).map(Number).filter(Number.isFinite) : null;
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(ids && ids.length ? and(eq(notifications.userId, u.id), sql`${notifications.notificationId} in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`) : eq(notifications.userId, u.id));
    return { ok: true };
  });
}
