import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getCurrentUser, homeFor, type SessionUser } from "@/lib/auth";
import type { NavViewer } from "@/components/nav/nav-actions";

/** Data for the auth-aware navigation (wallet balance, unread notifications, dashboard link). */
export async function getViewer(existing?: SessionUser | null): Promise<NavViewer> {
  const u = existing === undefined ? await getCurrentUser() : existing;
  if (!u) return null;
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(notifications)
    .where(and(eq(notifications.userId, u.id), eq(notifications.isRead, false)));
  return { fullName: u.fullName, role: u.role, walletBalance: u.walletBalance, escrowBalance: u.escrowBalance, unread: n, dashboard: homeFor(u.role), title: u.title, avatarUrl: u.avatarUrl };
}
