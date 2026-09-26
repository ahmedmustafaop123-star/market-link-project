import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAdminPage, verifyPassword } from "@/lib/auth";
import { adminStats } from "@/lib/services/analytics";
import { listDisputes } from "@/lib/services/orders";
import { PayoutsPanel } from "@/components/admin/payouts-panel";
import { WorkflowTrail } from "@/components/dashboard/workflow-trail";
import { Badge, PageHeader, StatCard } from "@/components/ui";
import { DonutChart, SimpleBarChart, VolumeAreaChart } from "@/components/charts";
import { DELIVERY_STAGES, categoryLabel, formatKg, formatPKR, formatPKRShort } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin overview" };

export default async function AdminDashboard() {
  const me = await requireAdminPage();
  const [s, disputes] = await Promise.all([adminStats(), listDisputes()]);
  const [pw] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, me.id)).limit(1);
  const usingDefaultPassword = !!pw && verifyPassword("password123", pw.hash);
  const stageCounts = DELIVERY_STAGES.map((st) => ({ ...st, count: s.stages.find((x) => x.stage === st.key)?.count ?? 0 }));
  const maxStage = Math.max(1, ...stageCounts.map((x) => x.count));

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Analytics" urdu="تجزیات"
        subtitle={`Welcome back, ${me.fullName} · ${me.title ?? "Administrator"}`}
        actions={
          <>
            <Link href="/admin/users" className="btn-secondary">👥 Users</Link>
            <Link href="/admin/db-explorer" className="btn-secondary">🗄️ Database</Link>
            <Link href="/admin/verification" className="btn-secondary">🛡️ Verify ({s.unverifiedFarmers + s.pendingInspections})</Link>
            <Link href="/admin/mandi" className="btn-primary">💹 Update mandi rates</Link>
            <a href="/api/reports/summary" className="btn-secondary">↓ Platform report</a>
          </>
        }
      />
      {usingDefaultPassword && (
        <div className="card flex flex-wrap items-center gap-3 border-rose-300 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-950/30">
          <span className="text-2xl">🔓</span>
          <div className="flex-1 text-sm">
            <p className="font-bold text-rose-900 dark:text-rose-200">You are using the default admin password (password123)</p>
            <p className="text-rose-800/80 dark:text-rose-300/80">Anyone who has read the demo instructions can sign in as admin. Change it now to secure your admin panel.</p>
          </div>
          <Link href="/account" className="btn-danger">Change password</Link>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Transaction volume" value={formatPKRShort(s.totalVolume)} sub={`${s.totalOrders} orders · ${formatKg(s.totalKg)}`} icon="💹" />
        <StatCard label="Active bids" value={s.activeBids} sub={`${s.activeShipments} shipments in progress`} icon="🤝" tone="amber" />
        <StatCard label="Escrow held" value={formatPKRShort(s.escrowHeld)} sub={`Fees earned ${formatPKR(s.platformFees)}`} icon="🔐" tone="sky" />
        <StatCard label="Open disputes" value={s.openDisputes} sub={`${s.farmers} farmers · ${s.buyers} buyers`} icon="⚖️" tone="rose" />
      </div>

      <WorkflowTrail title="Admin / System Controller workflow" steps={[
        { label: "Manage access", detail: "Users and role approvals", href: "/admin/users", pending: s.unverifiedFarmers },
        { label: "Monitor trading", detail: "Orders, escrow and reports", href: "/admin/dashboard", pending: s.activeBids },
        { label: "Certify quality", detail: "Inspection workflow", href: "/inspector/dashboard", pending: s.pendingInspections },
        { label: "Control rates", detail: "Daily mandi prices", href: "/admin/mandi" },
        { label: "Resolve cases", detail: "Shipments and disputes", href: "/admin/orders", pending: s.openDisputes },
      ]} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-3 font-semibold">Monthly transaction volume</h2>
          <VolumeAreaChart data={s.monthly} />
        </div>
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Volume by category</h2>
          <DonutChart data={s.categories.map((c) => ({ name: categoryLabel(c.name), value: c.value }))} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Top trading regions</h2>
          <SimpleBarChart data={s.topRegions} xKey="region" yKey="volume" horizontal height={280} />
        </div>
        <div className="card p-5">
          <h2 className="mb-4 font-semibold">Logistics pipeline</h2>
          <div className="space-y-3">
            {stageCounts.map((st) => (
              <div key={st.key}>
                <div className="mb-1 flex justify-between text-sm"><span>{st.label}</span><span className="font-semibold">{st.count}</span></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700" style={{ width: `${(st.count / maxStage) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/30"><p className="text-xs text-amber-700 dark:text-amber-300">Farmers awaiting verification</p><p className="text-xl font-bold">{s.unverifiedFarmers}</p></div>
            <div className="rounded-xl bg-sky-50 p-3 dark:bg-sky-950/30"><p className="text-xs text-sky-700 dark:text-sky-300">Listings pending inspection</p><p className="text-xl font-bold">{s.pendingInspections}</p></div>
          </div>
        </div>
      </div>

      <PayoutsPanel />

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <h2 className="font-semibold">Dispute resolution log</h2>
          <Link href="/admin/orders" className="text-sm font-semibold text-brand-600 hover:underline">Resolve disputes →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head"><tr><th className="px-5 py-2.5">Order</th><th className="px-5 py-2.5">Raised by</th><th className="px-5 py-2.5">Reason</th><th className="px-5 py-2.5">Amount</th><th className="px-5 py-2.5">Status</th><th className="px-5 py-2.5">Resolution</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {disputes.map((d) => (
                <tr key={d.disputeId}>
                  <td className="px-5 py-3 font-mono text-xs">{d.trackingNumber}<br /><span className="font-sans text-slate-500">{d.cropName}</span></td>
                  <td className="px-5 py-3">{d.raisedByName} <span className="text-xs text-slate-500">({d.raisedByRole})</span></td>
                  <td className="max-w-xs px-5 py-3 text-slate-600 dark:text-slate-300">{d.reason}</td>
                  <td className="px-5 py-3 font-semibold">{formatPKR(d.totalAmount)}</td>
                  <td className="px-5 py-3"><Badge status={d.status} /></td>
                  <td className="max-w-xs px-5 py-3 text-xs text-slate-500">{d.resolution ?? "—"}</td>
                </tr>
              ))}
              {disputes.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">No disputes logged</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
