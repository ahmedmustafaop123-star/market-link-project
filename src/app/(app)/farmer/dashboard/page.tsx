import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { farmerStats } from "@/lib/services/analytics";
import { listBids } from "@/lib/services/bids";
import { listOrders } from "@/lib/services/orders";
import { listCrops } from "@/lib/services/crops";
import { platformComparison } from "@/lib/services/mandi";
import { listReviews } from "@/lib/services/reviews";
import { Badge, PageHeader, StatCard } from "@/components/ui";
import { DonutChart, VolumeAreaChart } from "@/components/charts";
import { LogisticsStepper } from "@/components/stepper";
import { WorkflowTrail } from "@/components/dashboard/workflow-trail";
import { formatKg, formatPKR, formatPKRShort, type DeliveryStage } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Farmer dashboard" };

export default async function FarmerDashboard() {
  const user = await requirePageUser(["farmer"]);
  const [stats, bids, orders, crops, compare] = await Promise.all([
    farmerStats(user.id),
    listBids(user),
    listOrders(user, { active: true }),
    listCrops({ farmerId: user.id, status: "all" }),
    platformComparison(),
  ]);
  const reviews = await listReviews(user.id, 100);
  const unansweredReviews = reviews.filter((review) => !review.farmerReply).length;
  const openBids = bids.filter((b) => b.status === "pending" || b.status === "countered").slice(0, 5);
  const myCropNames = [...new Set(crops.map((c) => c.cropName))];
  const insights = compare.filter((c) => myCropNames.includes(c.cropName));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kisan Dashboard" urdu="کسان ڈیش بورڈ"
        subtitle={`${user.businessName ?? user.fullName} · inventory, bids & earnings at a glance`}
        actions={
          <>
            <Link href="/farmer/listings?new=1" className="btn-primary">＋ New Listing</Link>
            <Link href="/mandi-rates" className="btn-secondary">📈 Mandi Rates</Link>
            <a href="/api/reports/summary" className="btn-secondary">↓ Sales report</a>
          </>
        }
      />

      {!user.isVerified && (
        <div className="card flex items-start gap-3 border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
          <span className="text-2xl">⏳</span>
          <div className="text-sm">
            <p className="font-semibold text-amber-900 dark:text-amber-200">Account verification pending</p>
            <p className="text-amber-800 dark:text-amber-300/80">New listings are held as &ldquo;pending inspection&rdquo; until a MarketLink quality inspector verifies your CNIC and farm. This usually takes 24 hours.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-5">
        <StatCard label="Active listings" value={stats.activeListings} sub={`${formatKg(stats.inventoryKg)} · ${formatPKR(stats.inventoryValue)} value`} icon="🌾" />
        <StatCard label="Incoming bids" value={stats.pendingBids} sub={`${stats.counteredBids} awaiting buyer reply`} icon="🤝" tone="amber" />
        <StatCard label="Total earnings" value={formatPKRShort(stats.totalEarned)} sub={`${formatPKR(stats.earnedThisMonth)} this month`} icon="💰" tone="violet" />
        <StatCard label="Trust score" value={user.trustScore ? `${Number(user.trustScore).toFixed(2)} / 5` : "New"} sub={user.ratingCount ? `★ ${Number(user.ratingAvg).toFixed(1)} from ${user.ratingCount} reviews` : "No reviews yet"} icon="⭐" tone="amber" />
        <StatCard label="Held in escrow" value={formatPKRShort(stats.inEscrow)} sub={`${stats.activeOrders} active orders`} icon="🔐" tone="sky" />
      </div>

      <WorkflowTrail title="Farmer / Vendor workflow" steps={[
        { label: "List produce", detail: "Manage crops and grades", href: "/farmer/listings", pending: stats.pendingInspection },
        { label: "Negotiate bids", detail: "Review buyer offers", href: "/farmer/bids", pending: stats.pendingBids },
        { label: "Fulfil orders", detail: "Dispatch and track", href: "/farmer/orders", pending: stats.activeOrders },
        { label: "Receive payment", detail: "Escrow and payouts", href: "/wallet" },
        { label: "Reply to reviews", detail: "Verified buyer feedback", href: "/farmer/reviews", pending: unansweredReviews },
        { label: "Manage profile", detail: "Farm and account details", href: "/account" },
      ]} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Monthly sales trend</h2>
            <span className="text-xs text-slate-500">Last 6 months · order value</span>
          </div>
          <VolumeAreaChart data={stats.monthly} />
        </div>
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Sales by crop</h2>
          {stats.byCrop.length ? <DonutChart data={stats.byCrop} /> : <p className="py-16 text-center text-sm text-slate-500">No sales yet</p>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <h2 className="font-semibold">Incoming buyer bids</h2>
            <Link href="/farmer/bids" className="text-sm font-semibold text-brand-600 hover:underline">Negotiation hub →</Link>
          </div>
          {openBids.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">No open bids right now.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {openBids.map((b) => {
                const diff = ((b.bidPricePerKg - b.basePricePerKg) / b.basePricePerKg) * 100;
                return (
                  <li key={b.bidId} className="flex items-center gap-3 px-5 py-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-lg dark:bg-brand-500/10">🏢</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{b.buyerBusiness ?? b.buyerName}</p>
                      <p className="text-xs text-slate-500">{b.cropName} · {formatKg(b.bidQuantityKg)} · {b.buyerCity}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{formatPKR(b.bidPricePerKg, 2)}/kg</p>
                      <p className={`text-xs font-semibold ${diff >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{diff >= 0 ? "+" : ""}{diff.toFixed(1)}% vs ask</p>
                    </div>
                    <Badge status={b.status} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <h2 className="font-semibold">Active shipments</h2>
            <Link href="/farmer/orders" className="text-sm font-semibold text-brand-600 hover:underline">All orders →</Link>
          </div>
          {orders.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">No active shipments.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {orders.slice(0, 4).map((o) => (
                <li key={o.orderId} className="px-5 py-4">
                  <div className="mb-3 flex items-center justify-between gap-2 text-sm">
                    <span className="font-semibold">{o.cropName} → {o.buyerBusiness ?? o.buyerName}</span>
                    <Badge status={o.paymentStatus} />
                  </div>
                  <LogisticsStepper stage={o.deliveryStage as DeliveryStage} compact disputed={o.paymentStatus === "disputed"} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {reviews.length > 0 && (
        <section className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Latest buyer reviews</h2>
            <Link href="/farmer/reviews" className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-400">
              {unansweredReviews > 0 ? `Respond to ${unansweredReviews} →` : "All reviews →"}
            </Link>
          </div>
          <ul className="mt-3 grid gap-3 md:grid-cols-3">
            {reviews.slice(0, 3).map((r) => (
              <li key={r.reviewId} className="rounded-2xl border border-slate-200 p-4 text-sm dark:border-white/10">
                <p className="text-gold-500">{"★".repeat(r.rating)}<span className="text-slate-300 dark:text-slate-600">{"★".repeat(5 - r.rating)}</span></p>
                {r.comment && <p className="mt-1">&ldquo;{r.comment}&rdquo;</p>}
                <p className="mt-1 text-xs text-slate-500">{r.buyerName ?? r.buyerFullName} · {r.cropName}</p>
                <p className={`mt-2 text-xs font-semibold ${r.farmerReply ? "text-brand-700 dark:text-brand-400" : "text-amber-700 dark:text-amber-400"}`}>
                  {r.farmerReply ? "✓ Responded" : "Reply pending"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <h2 className="font-semibold">Mandi price insight for your crops</h2>
          <Link href="/mandi-rates" className="text-sm font-semibold text-brand-600 hover:underline">Full insights →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr><th className="px-5 py-2.5">Crop</th><th className="px-5 py-2.5">Mandi avg</th><th className="px-5 py-2.5">Your ask</th><th className="px-5 py-2.5">Platform deals</th><th className="px-5 py-2.5">Signal</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {insights.map((i) => {
                const mine = crops.filter((c) => c.cropName === i.cropName && c.status === "active");
                const ask = mine.length ? mine.reduce((s, c) => s + c.basePricePerKg, 0) / mine.length : null;
                const gap = ask ? ((ask - i.mandiAvg) / i.mandiAvg) * 100 : null;
                return (
                  <tr key={i.cropName}>
                    <td className="px-5 py-3 font-medium">{i.cropName}</td>
                    <td className="px-5 py-3">{formatPKR(i.mandiAvg, 2)}</td>
                    <td className="px-5 py-3">{ask ? formatPKR(ask, 2) : "—"}</td>
                    <td className="px-5 py-3">{i.platformDeal ? formatPKR(i.platformDeal, 2) : "—"}</td>
                    <td className="px-5 py-3">
                      {gap === null ? (
                        <span className="text-slate-400">No active listing</span>
                      ) : gap > 8 ? (
                        <span className="font-semibold text-amber-600">▲ {gap.toFixed(1)}% above mandi — may slow bids</span>
                      ) : gap < -5 ? (
                        <span className="font-semibold text-rose-600">▼ {Math.abs(gap).toFixed(1)}% below mandi — consider raising</span>
                      ) : (
                        <span className="font-semibold text-emerald-600">● Competitive ({gap >= 0 ? "+" : ""}{gap.toFixed(1)}%)</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
