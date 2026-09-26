import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { getCrop } from "@/lib/services/crops";
import { rateTrend } from "@/lib/services/mandi";
import { listReviews } from "@/lib/services/reviews";
import { Badge, GradeBadge } from "@/components/ui";
import { CropPriceChart } from "@/components/crop/price-chart";
import { BidPanel } from "@/components/crop/bid-panel";
import { CITIES, categoryLabel, cropImage, cropUrdu, formatDate, formatKg, formatPKR, perMaund } from "@/lib/constants";

export const dynamic = "force-dynamic";

function Stars({ value, size = "text-sm" }: { value: number; size?: string }) {
  return (
    <span className={`${size} tracking-tight text-gold-500`} aria-label={`${value.toFixed(1)} out of 5`}>
      {"★★★★★".slice(0, Math.round(value))}
      <span className="text-slate-300 dark:text-slate-600">{"★★★★★".slice(Math.round(value))}</span>
    </span>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  try {
    const c = await getCrop(id);
    return { title: `${c.cropName} · Grade ${c.qualityGrade} · ${c.farmLocation}` };
  } catch {
    return { title: "Crop not found" };
  }
}

export default async function CropDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isFinite(id)) notFound();
  let crop: Awaited<ReturnType<typeof getCrop>>;
  try {
    crop = await getCrop(id);
  } catch {
    notFound();
  }
  const [user, trend, reviews, dealRows, bidStats] = await Promise.all([
    getCurrentUser(),
    rateTrend(crop.cropName, 30),
    listReviews(crop.farmerId, 6),
    db.execute(sql`
      select to_char(o.created_at, 'YYYY-MM-DD') as d, round(sum(o.total_amount) / nullif(sum(o.quantity_kg), 0), 2) as p
      from orders_logistics o join crops_inventory c on c.crop_id = o.crop_id
      where c.crop_name = ${crop.cropName} and o.created_at > now() - interval '30 days' and o.payment_status <> 'refunded'
      group by 1 order by 1`),
    db.execute(sql`select count(*)::int as n, max(bid_price_per_kg) as hi from bids_negotiations where crop_id = ${id} and status in ('pending','countered')`),
  ]);

  // Chart series: mandi average across markets vs platform deals vs this listing's ask
  const deals = new Map((dealRows.rows as { d: string; p: string }[]).map((r) => [r.d, Number(r.p)]));
  const series = trend.series.map((row) => {
    const vals = trend.markets.map((m) => Number(row[m])).filter((v) => Number.isFinite(v) && v > 0);
    const date = String(row.date);
    return { date, mandi: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : null, platform: deals.get(date) ?? null, ask: crop.basePricePerKg };
  });
  const lastMandi = [...series].reverse().find((s) => s.mandi)?.mandi ?? null;
  const vsMandi = lastMandi ? ((crop.basePricePerKg - lastMandi) / lastMandi) * 100 : null;
  const passed = crop.inspections.filter((i) => i.status === "passed");
  const latest = passed[0];
  const bids = bidStats.rows[0] as { n: number; hi: string | null };
  const province = CITIES[crop.farmLocation]?.province;
  const available = crop.status === "active";

  return (
    <div className="space-y-8">
      <nav className="text-sm text-slate-500" aria-label="Breadcrumb">
        <Link href="/marketplace" className="hover:text-brand-700">Marketplace</Link> <span className="mx-1">/</span>
        <Link href={`/marketplace?category=${crop.category}`} className="hover:text-brand-700">{categoryLabel(crop.category)}</Link> <span className="mx-1">/</span>
        <span className="text-slate-800 dark:text-slate-200">{crop.cropName}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        {/* Gallery */}
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-3xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cropImage(crop.imagesJson, crop.cropName, crop.category)} alt={crop.cropName} className="aspect-[4/3] w-full object-cover" />
            <div className="absolute top-4 left-4 flex gap-2">
              <GradeBadge grade={crop.qualityGrade} />
              {latest && <span className="badge bg-white/95 text-emerald-700 shadow">🔬 Lab certified</span>}
            </div>
            {!available && <div className="absolute inset-0 grid place-items-center bg-black/50 text-lg font-bold text-white">{crop.status === "sold_out" ? "Sold out" : "Not available"}</div>}
          </div>
          {crop.imagesJson.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {crop.imagesJson.slice(1, 5).map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt="" className="aspect-square w-full rounded-xl object-cover" />
              ))}
            </div>
          )}
        </div>

        {/* Summary + CTA */}
        <div className="space-y-5">
          <div>
            <p className="text-sm font-semibold text-brand-700 dark:text-brand-400">{categoryLabel(crop.category)} · 📍 {crop.farmLocation}{province ? `, ${province}` : ""}</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">{crop.cropName} <span className="text-xl font-semibold text-slate-400">{cropUrdu(crop.cropName)}</span></h1>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <p className="text-3xl font-extrabold text-brand-700 dark:text-brand-400">{formatPKR(crop.basePricePerKg, 2)}<span className="text-base font-medium text-slate-500">/kg</span></p>
              <p className="text-slate-500">{perMaund(crop.basePricePerKg)}</p>
              {vsMandi !== null && <span className={`badge ${vsMandi <= 0 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"}`}>{vsMandi <= 0 ? "▼" : "▲"} {Math.abs(vsMandi).toFixed(1)}% vs mandi avg</span>}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Available", formatKg(crop.totalQuantityKg)],
              ["Harvested", formatDate(crop.harvestDate)],
              ["Open bids", String(bids.n)],
              ["Top bid", bids.hi ? `${formatPKR(Number(bids.hi), 2)}/kg` : "—"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl border border-slate-200 p-3 dark:border-white/10">
                <dt className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">{k}</dt>
                <dd className="mt-1 text-sm font-bold">{v}</dd>
              </div>
            ))}
          </dl>

          <BidPanel
            crop={{ cropId: crop.cropId, cropName: crop.cropName, basePricePerKg: crop.basePricePerKg, totalQuantityKg: crop.totalQuantityKg, available }}
            viewerRole={user?.role ?? null}
            isOwner={user?.id === crop.farmerId}
          />

          {crop.description && <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{crop.description}</p>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Specifications */}
        <section className="card p-6">
          <h2 className="font-bold">Specifications</h2>
          <dl className="mt-4 divide-y divide-slate-100 text-sm dark:divide-white/5">
            {[
              ["Crop", crop.cropName],
              ["Category", categoryLabel(crop.category)],
              ["Declared grade", `Grade ${crop.qualityGrade}`],
              ["Quantity", `${formatKg(crop.totalQuantityKg)} (${Math.round(crop.totalQuantityKg / 40).toLocaleString("en-US")} maund)`],
              ["Base price", `${formatPKR(crop.basePricePerKg, 2)}/kg`],
              ["Harvest date", formatDate(crop.harvestDate)],
              ["Farm location", `${crop.farmLocation}${province ? `, ${province}` : ""}`],
              ["Listed", formatDate(crop.createdAt)],
              ["Status", <Badge key="s" status={crop.status} />],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-4 py-2.5"><dt className="text-slate-500">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
            ))}
          </dl>
        </section>

        {/* Quality reports */}
        <section className="card p-6">
          <h2 className="font-bold">Quality inspection</h2>
          {crop.inspections.length === 0 ? (
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-white/5">No lab report yet. Every order is inspected before dispatch.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {crop.inspections.slice(0, 3).map((i) => (
                <li key={i.inspectionId} className={`rounded-2xl border p-4 ${i.status === "passed" ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20" : "border-slate-200 dark:border-white/10"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <GradeBadge grade={i.gradeAssigned} />
                    <Badge status={i.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <p><span className="text-slate-500">Moisture</span><br /><b>{i.moistureLevelPercentage}%</b></p>
                    <p><span className="text-slate-500">Soil pH</span><br /><b>{i.soilPh ?? "—"}</b></p>
                  </div>
                  {i.inspectionNotes && <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">{i.inspectionNotes}</p>}
                  <p className="mt-2 text-[11px] text-slate-500">{i.certificateNo ? `Certificate ${i.certificateNo} · ` : ""}{i.verifiedAt ? formatDate(i.verifiedAt) : "Pending lab"}{i.reportAttachment ? " · PDF on file" : ""}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Seller */}
        <section className="card p-6">
          <h2 className="font-bold">Seller</h2>
          <div className="mt-4 flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-900 text-sm font-bold text-gold-400">{crop.farmerName.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{crop.farmName ?? crop.farmerName}</p>
              <p className="text-xs text-slate-500">{crop.farmerName} · {crop.farmerCity} · since {new Date(crop.memberSince).getFullYear()}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-brand-50 p-3 dark:bg-brand-500/10">
              <p className="text-[11px] font-semibold tracking-wider text-brand-800 uppercase dark:text-brand-300">Trust score</p>
              <p className="mt-1 text-2xl font-extrabold text-brand-900 dark:text-white">{crop.trustScore ? Number(crop.trustScore).toFixed(1) : "New"}<span className="text-sm font-medium text-slate-500">/5</span></p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-3 dark:bg-amber-500/10">
              <p className="text-[11px] font-semibold tracking-wider text-amber-800 uppercase dark:text-amber-300">Reviews</p>
              <p className="mt-1 text-lg font-bold">{crop.ratingCount ? <><Stars value={Number(crop.ratingAvg)} /> <span className="text-sm">{Number(crop.ratingAvg).toFixed(1)}</span></> : "—"}</p>
              <p className="text-[11px] text-slate-500">{crop.ratingCount} verified</p>
            </div>
          </div>
          <ul className="mt-4 space-y-1.5 text-sm">
            <li className={crop.farmerVerified ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700"}>{crop.farmerVerified ? "✔ Identity (CNIC) verified" : "⏳ Identity verification pending"}</li>
            <li className={passed.length ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500"}>{passed.length ? `✔ ${passed.length} passed lab inspection${passed.length > 1 ? "s" : ""}` : "• No lab inspections yet"}</li>
            <li className="text-emerald-700 dark:text-emerald-400">✔ Escrow-protected payment</li>
          </ul>
          <Link href={`/marketplace?farmerId=${crop.farmerId}`} className="btn-secondary mt-4 w-full">More from this seller</Link>
        </section>
      </div>

      {/* Price history */}
      <section className="card p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-bold">Price history: last 30 days</h2>
            <p className="text-xs text-slate-500">Government mandi average vs MarketLink deal price vs this listing (Rs./kg)</p>
          </div>
          <Link href="/mandi-rates" className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-400">All mandi rates →</Link>
        </div>
        <div className="mt-4"><CropPriceChart data={series} /></div>
      </section>

      {/* Reviews */}
      <section className="card p-6">
        <h2 className="font-bold">Buyer reviews for {crop.farmName ?? crop.farmerName}</h2>
        {reviews.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No reviews yet. Reviews can only be written by buyers after a delivered order.</p>
        ) : (
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {reviews.map((r) => (
              <li key={r.reviewId} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                <div className="flex items-center justify-between gap-2">
                  <Stars value={r.rating} />
                  <span className="text-xs text-slate-500">{formatDate(r.createdAt)}</span>
                </div>
                {r.comment && <p className="mt-2 text-sm">&ldquo;{r.comment}&rdquo;</p>}
                <p className="mt-2 text-xs text-slate-500">{r.buyerName ?? r.buyerFullName} · bought {r.cropName} · ✔ Verified purchase</p>
                {r.farmerReply && (
                  <div className="mt-3 rounded-lg border-l-2 border-brand-600 bg-brand-50 px-3 py-2 text-sm dark:bg-brand-950/30">
                    <p className="text-xs font-semibold text-brand-800 dark:text-brand-300">Seller response · {formatDate(r.repliedAt)}</p>
                    <p className="mt-1 whitespace-pre-wrap">{r.farmerReply}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
