import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requirePageUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { MarkAllRead } from "@/components/nav/mark-all-read";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requirePageUser();
  const items = await db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(100);
  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" urdu="اطلاعات" subtitle="Bids, escrow, shipments, inspections and payouts" actions={<MarkAllRead />} />
      <div className="card overflow-hidden">
        {items.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">No notifications yet.</p> : (
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {items.map((n) => (
              <li key={n.notificationId} className={`flex gap-4 px-5 py-4 ${n.isRead ? "" : "bg-brand-50/50 dark:bg-brand-500/5"}`}>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.isRead ? "bg-transparent" : "bg-brand-600"}`} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{n.title}</p>
                  {n.body && <p className="text-sm text-slate-600 dark:text-slate-300">{n.body}</p>}
                  <p className="mt-1 text-xs text-slate-400">{new Date(n.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} · via {n.channels.replace(/in_app/, "app").replace(/:logged/g, " (outbox)").replace(/,/g, ", ")}</p>
                </div>
                {n.link && <Link href={n.link} className="self-center text-sm font-semibold text-brand-700 hover:underline dark:text-brand-400">Open →</Link>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
