import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { buyerStats } from "@/lib/services/analytics";
import { listOrders } from "@/lib/services/orders";
import { listBids } from "@/lib/services/bids";
import { pendingReviews } from "@/lib/services/reviews";
import { Badge, PageHeader, StatCard } from "@/components/ui";
import { VolumeAreaChart } from "@/components/charts";
import { LogisticsStepper } from "@/components/stepper";
import { ReviewPrompts } from "@/components/reviews/review-prompts";
import { WorkflowTrail } from "@/components/dashboard/workflow-trail";
import { formatKg, formatPKR, formatPKRShort, type DeliveryStage } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Buyer dashboard" };

export default async function BuyerDashboard() {
  const user = await requirePageUser(["buyer"]);
  const [s, orders, bids, toReview] = await Promise.all([buyerStats(user.id), listOrders(user, { active: true, limit: 6 }), listBids(user), pendingReviews(user.id)]);
  const countered = bids.filter((b) => b.status === "countered").slice(0, 4);
  const awaiting = orders.filter((o) => o.paymentStatus === "awaiting_escrow");

  return (
    <div className="space-y-6">
      <PageHeader title="Buyer Dashboard" urdu="خریدار ڈیش بورڈ" subtitle={user.businessName ?? user.fullName}
        actions={<><Link href="/marketplace" className="btn-primary">🛒 Browse marketplace</Link><Link href="/wallet" className="btn-secondary">💰 Add funds</Link></>} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Wallet balance" value={formatPKRShort(s.walletBalance)} sub={`${formatPKRShort(s.escrowBalance)} in escrow`} icon="💰" tone="sky" />
        <StatCard label="Active orders" value={s.activeOrders} sub={s.awaitingEscrow ? `${s.awaitingEscrow} need escrow funding` : "All funded"} icon="🚚" />
        <StatCard label="Open bids" value={s.pendingBids + s.counteredBids} sub={s.counteredBids ? `${s.counteredBids} counter-offer(s)` : "No counter-offers"} icon="📝" tone="amber" />
        <StatCard label="Total procured" value={formatKg(s.totalKg)} sub={`${formatPKRShort(s.totalSpend)} lifetime`} icon="📦" tone="violet" />
      </div>

      <WorkflowTrail title="Buyer / Customer workflow" steps={[
        { label: "Browse produce", detail: "Search graded crops", href: "/marketplace" },
        { label: "Submit bids", detail: "Make or revise offers", href: "/buyer/bids", pending: s.counteredBids },
        { label: "Fund escrow", detail: "Secure accepted deals", href: "/buyer/orders", pending: s.awaitingEscrow },
        { label: "Track delivery", detail: "Follow your shipments", href: "/buyer/orders", pending: s.activeOrders },
        { label: "Rate the farmer", detail: "Review delivered orders", href: "/buyer/dashboard", pending: toReview.length },
      ]} />

      {(awaiting.length > 0 || countered.length > 0 || toReview.length > 0) && (
        <section className="card border-amber-200 p-5 dark:border-amber-900">
          <h2 className="font-bold">Needs your attention</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {awaiting.map((o) => (
              <li key={o.orderId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2 dark:bg-amber-500/10">
                <span>🔐 Fund escrow for <b>{o.cropName}</b> ({o.trackingNumber}): {formatPKR(o.totalAmount)}</span>
                <Link href="/buyer/orders" className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-400">Pay now →</Link>
              </li>
            ))}
            {countered.map((b) => (
              <li key={b.bidId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sky-50 px-3 py-2 dark:bg-sky-500/10">
                <span>💬 Counter-offer on <b>{b.cropName}</b>: {formatPKR(b.counterPrice ?? 0, 2)}/kg (you bid {formatPKR(b.bidPricePerKg, 2)})</span>
                <Link href="/buyer/bids" className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-400">Respond →</Link>
              </li>
            ))}
          </ul>
          {toReview.length > 0 && <div className="mt-4"><ReviewPrompts items={toReview} /></div>}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="card overflow-hidden lg:col-span-3">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-white/5">
            <h2 className="font-bold">Active shipments</h2>
            <Link href="/buyer/orders" className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-400">All orders →</Link>
          </div>
          {orders.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">No active shipments. <Link href="/marketplace" className="font-semibold text-brand-700">Find produce →</Link></p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-white/5">
              {orders.map((o) => (
                <li key={o.orderId} className="px-5 py-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-semibold">{o.cropName} · {formatKg(o.quantityKg)} <span className="font-mono text-xs font-normal text-slate-500">{o.trackingNumber}</span></span>
                    <span className="flex items-center gap-2"><Badge status={o.paymentStatus} /><Link href={`/tracking?no=${o.trackingNumber}`} className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-400">📍 Track</Link></span>
                  </div>
                  <LogisticsStepper stage={o.deliveryStage as DeliveryStage} compact disputed={o.paymentStatus === "disputed"} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-3 font-bold">Monthly procurement</h2>
          <VolumeAreaChart data={s.monthly} height={240} />
        </section>
      </div>
    </div>
  );
}
