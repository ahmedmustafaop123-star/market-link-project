"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, EmptyState, GradeBadge, LoadingBlock, Modal, PageHeader, Spinner } from "@/components/ui";
import { useI18n, useToast } from "@/components/providers";
import { CityOptions } from "@/components/city-options";
import { CATEGORIES, PROVINCES, cropImage, perMaund, formatDate, formatKg, formatPKR, todayISO, type Category, type Grade } from "@/lib/constants";

type Listing = {
  cropId: number; cropName: string; category: Category; qualityGrade: Grade; totalQuantityKg: number; basePricePerKg: number; harvestDate: string;
  imagesJson: string[]; description: string | null; farmLocation: string; farmerName: string; farmName: string | null; farmerVerified: boolean;
  openBids: number; highestBid: number | null; inspectionGrade: string | null; distanceKm: number | null; trustScore: number; ratingCount: number;
};
type Rate = { cropName: string; avgPricePerKg: number };

export type MarketFilters = { q?: string; category?: string; grade?: string; sort?: string; farmerId?: string };

export function MarketplaceClient({ homeCity, initial = {}, viewerRole = null }: { homeCity: string; initial?: MarketFilters; viewerRole?: string | null }) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const canBid = viewerRole === "buyer";
  const { push } = useToast();
  const { t } = useI18n();
  const [items, setItems] = useState<Listing[] | null>(null);
  const empty = { q: "", category: "", grade: "", minPrice: "", maxPrice: "", minQty: "", province: "", originCity: homeCity, radiusKm: "", sort: "newest", farmerId: "" };
  const [f, setF] = useState({ ...empty, ...Object.fromEntries(Object.entries(initial).filter(([, v]) => v)) });
  const [mandi, setMandi] = useState<Record<string, number>>({});
  const [target, setTarget] = useState<Listing | null>(null);
  const [bid, setBid] = useState({ price: "", qty: "", date: todayISO(7), message: "" });
  const [busy, setBusy] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => v && p.set(k, v));
    return p.toString();
  }, [f]);

  useEffect(() => {
    let alive = true;
    const h = setTimeout(() => {
      api<Listing[]>(`/api/crops?${query}`)
        .then((d) => alive && setItems(d))
        .catch((e) => push({ kind: "error", title: e.message }));
    }, 250);
    return () => { alive = false; clearTimeout(h); };
  }, [query, push]);

  useEffect(() => {
    api<Rate[]>("/api/mandi-rates?view=latest").then((rows) => {
      const acc: Record<string, { s: number; n: number }> = {};
      rows.forEach((r) => { acc[r.cropName] = { s: (acc[r.cropName]?.s ?? 0) + r.avgPricePerKg, n: (acc[r.cropName]?.n ?? 0) + 1 }; });
      setMandi(Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, v.s / v.n])));
    }).catch(() => {});
  }, []);

  function openBid(l: Listing) {
    setTarget(l);
    setBid({ price: String(Math.round(l.basePricePerKg * 0.97 * 100) / 100), qty: String(Math.min(l.totalQuantityKg, 1000)), date: todayISO(7), message: "" });
  }

  async function submitBid(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    setBusy(true);
    try {
      await api("/api/bids", { method: "POST", json: { cropId: target.cropId, bidPricePerKg: Number(bid.price), bidQuantityKg: Number(bid.qty), targetDeliveryDate: bid.date, message: bid.message || undefined } });
      push({ kind: "success", title: "Bid submitted", body: `${target.farmName ?? target.farmerName} will respond shortly.` });
      setItems((prev) => prev?.map((x) => (x.cropId === target.cropId ? { ...x, openBids: x.openBids + 1, highestBid: Math.max(x.highestBid ?? 0, Number(bid.price)) } : x)) ?? null);
      setTarget(null);
    } catch (err) {
      push({ kind: "error", title: "Bid rejected", body: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const total = Number(bid.price || 0) * Number(bid.qty || 0);

  return (
    <div>
      <PageHeader title={t("marketplace")} urdu="منڈی بازار" subtitle="Buy directly from verified farms" actions={
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 p-0.5 dark:border-slate-700" role="group" aria-label="View">
            {(["grid", "list"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${view === v ? "bg-brand-900 text-white" : "text-slate-500"}`} aria-pressed={view === v}>{v === "grid" ? "▦ Grid" : "☰ List"}</button>
            ))}
          </div>
          {canBid && <Link href="/buyer/bids" className="btn-secondary">📝 My bids</Link>}
        </div>} />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setF({ ...f, category: "" })} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${!f.category ? "bg-brand-600 text-white" : "bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"}`}>🌐 All</button>
        {CATEGORIES.map((c) => (
          <button key={c.value} onClick={() => setF({ ...f, category: c.value })} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${f.category === c.value ? "bg-brand-600 text-white" : "bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"}`}>
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      <div className="card mb-5 p-4">
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="🔍 Search crops (e.g. Wheat, Mango)…" value={f.q} onChange={set("q")} />
          <button className="btn-secondary md:hidden" onClick={() => setShowFilters((v) => !v)}>⚙️ Filters</button>
          <select className="input hidden w-44 md:block" value={f.sort} onChange={set("sort")}>
            <option value="newest">Newest first</option><option value="price_asc">Price: low → high</option><option value="price_desc">Price: high → low</option><option value="distance">Nearest first</option>
          </select>
        </div>
        <div className={`mt-3 grid-cols-2 gap-3 md:grid md:grid-cols-4 xl:grid-cols-8 ${showFilters ? "grid" : "hidden"}`}>
          <div><label className="label">Min quantity</label><select className="input" value={f.minQty} onChange={set("minQty")}><option value="">Any</option><option value="1000">≥ 1 ton</option><option value="5000">≥ 5 tons</option><option value="10000">≥ 10 tons</option><option value="25000">≥ 25 tons</option></select></div>
          <div><label className="label">Province</label><select className="input" value={f.province} onChange={set("province")}><option value="">All</option>{PROVINCES.map((p) => <option key={p}>{p}</option>)}</select></div>
          <div><label className="label">Grade</label><select className="input" value={f.grade} onChange={set("grade")}><option value="">Any</option><option>A</option><option>B</option><option>C</option></select></div>
          <div><label className="label">Min Rs./kg</label><input type="number" className="input" value={f.minPrice} onChange={set("minPrice")} /></div>
          <div><label className="label">Max Rs./kg</label><input type="number" className="input" value={f.maxPrice} onChange={set("maxPrice")} /></div>
          <div><label className="label">From city</label><select className="input" value={f.originCity} onChange={set("originCity")}><CityOptions /></select></div>
          <div><label className="label">Radius</label><select className="input" value={f.radiusKm} onChange={set("radiusKm")}><option value="">Nationwide</option><option value="50">≤ 50 km</option><option value="150">≤ 150 km</option><option value="300">≤ 300 km</option><option value="600">≤ 600 km</option></select></div>
          <div className="md:hidden"><label className="label">Sort</label><select className="input" value={f.sort} onChange={set("sort")}><option value="newest">Newest</option><option value="price_asc">Price ↑</option><option value="price_desc">Price ↓</option><option value="distance">Nearest</option></select></div>
          <div className="flex items-end"><button className="btn-secondary w-full" onClick={() => setF(empty)}>Reset</button></div>
        </div>
      </div>

      {!items ? <LoadingBlock /> : items.length === 0 ? (
        <EmptyState icon="🔎" title="No produce matches your filters" body="Try widening the radius or clearing the grade/price filters." />
      ) : (
        <>
          {f.farmerId && items.length > 0 && (
            <div className="mb-3 flex items-center gap-2 text-sm">
              <span className="rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-800 dark:bg-brand-500/10 dark:text-brand-300">Seller: {items[0].farmName ?? items[0].farmerName}</span>
              <button className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200" onClick={() => setF({ ...f, farmerId: "" })}>✕ Show all sellers</button>
            </div>
          )}
          <p className="mb-3 text-sm text-slate-500">{items.length} listing(s) · distances from {f.originCity}</p>
          <div className={view === "grid" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "grid gap-3"}>
            {items.map((l) => {
              const m = mandi[l.cropName];
              const vs = m ? ((l.basePricePerKg - m) / m) * 100 : null;
              return (
                <article key={l.cropId} className={`card group overflow-hidden transition hover:shadow-lg ${view === "grid" ? "flex flex-col hover:-translate-y-0.5" : "flex flex-col sm:flex-row"}`}>
                  <div className={`relative overflow-hidden ${view === "grid" ? "h-44" : "h-44 sm:h-auto sm:w-56 sm:shrink-0"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cropImage(l.imagesJson, l.cropName, l.category)} alt={l.cropName} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    <div className="absolute top-3 left-3 flex gap-1.5"><GradeBadge grade={l.qualityGrade} />{l.inspectionGrade && <span className="badge bg-white/90 text-emerald-700">🔬 Inspected</span>}</div>
                    {l.distanceKm !== null && <span className="badge absolute top-3 right-3 bg-black/60 text-white">📍 {l.distanceKm} km</span>}
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold"><Link href={`/crop/${l.cropId}`} className="hover:text-brand-700 hover:underline dark:hover:text-brand-400">{l.cropName}</Link></h3>
                        <p className="truncate text-xs text-slate-500">{l.farmName ?? l.farmerName} {l.farmerVerified && <span className="text-brand-600">✔</span>}{l.trustScore > 0 && <span className="ml-1 text-amber-600">★ {Number(l.trustScore).toFixed(1)}</span>} · {l.farmLocation}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-brand-700 dark:text-brand-400">{formatPKR(l.basePricePerKg, 2)}<span className="text-xs font-normal text-slate-500">/kg</span></p>
                        <p className="text-[11px] text-slate-500">{perMaund(l.basePricePerKg)}</p>
                        {vs !== null && <p className={`text-[11px] font-semibold ${vs <= 0 ? "text-emerald-600" : "text-amber-600"}`}>{vs <= 0 ? "▼" : "▲"} {Math.abs(vs).toFixed(1)}% vs mandi</p>}
                      </div>
                    </div>
                    {l.description && <p className="mt-2 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">{l.description}</p>}
                    <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2.5 text-center text-xs dark:bg-slate-800/60">
                      <div><p className="text-slate-500">Available</p><p className="font-semibold">{formatKg(l.totalQuantityKg)}</p></div>
                      <div><p className="text-slate-500">Harvested</p><p className="font-semibold">{formatDate(l.harvestDate).slice(0, 6)}</p></div>
                      <div><p className="text-slate-500">Bids</p><p className="font-semibold">{l.openBids}{l.highestBid ? ` · ${Math.round(l.highestBid)}` : ""}</p></div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Link href={`/crop/${l.cropId}`} className="btn-secondary flex-1">Details</Link>
                      {canBid ? (
                        <button className="btn-primary flex-1" onClick={() => openBid(l)}>💬 {t("placeBid")}</button>
                      ) : (
                        <Link href={viewerRole ? `/crop/${l.cropId}` : `/login?next=${encodeURIComponent(`/crop/${l.cropId}`)}`} className="btn-primary flex-1">💬 {viewerRole ? "View" : "Sign in to bid"}</Link>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      <Modal open={!!target} onClose={() => setTarget(null)} title={target ? `Bulk offer · ${target.cropName}` : ""}>
        {target && (
          <form onSubmit={submitBid} className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cropImage(target.imagesJson, target.cropName, target.category)} alt="" className="h-12 w-12 rounded-lg object-cover" />
              <div className="flex-1">
                <p className="font-semibold">{target.farmName ?? target.farmerName} · Grade {target.qualityGrade}</p>
                <p className="text-xs text-slate-500">Ask {formatPKR(target.basePricePerKg, 2)}/kg · {formatKg(target.totalQuantityKg)} available{mandi[target.cropName] ? ` · Mandi avg ${formatPKR(mandi[target.cropName], 2)}` : ""}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Your price (Rs./kg)</label><input type="number" step="0.01" min={target.basePricePerKg * 0.5} className="input" value={bid.price} onChange={(e) => setBid({ ...bid, price: e.target.value })} required /></div>
              <div><label className="label">Quantity (kg)</label><input type="number" min="1" max={target.totalQuantityKg} className="input" value={bid.qty} onChange={(e) => setBid({ ...bid, qty: e.target.value })} required /></div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[0.25, 0.5, 1].map((p) => (
                <button type="button" key={p} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold dark:bg-slate-800" onClick={() => setBid({ ...bid, qty: String(Math.floor(target.totalQuantityKg * p)) })}>{p * 100}% ({formatKg(target.totalQuantityKg * p)})</button>
              ))}
              <button type="button" className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300" onClick={() => setBid({ ...bid, price: String(target.basePricePerKg) })}>Match ask price</button>
            </div>
            <div><label className="label">Target delivery date</label><input type="date" min={todayISO(1)} className="input" value={bid.date} onChange={(e) => setBid({ ...bid, date: e.target.value })} required /></div>
            <div><label className="label">Message / RFQ terms</label><textarea className="input" rows={2} value={bid.message} onChange={(e) => setBid({ ...bid, message: e.target.value })} placeholder="Packaging, pickup, payment terms…" /></div>
            <div className="flex items-center justify-between rounded-xl bg-brand-600 p-3 text-white"><span className="text-sm">Offer value · {Math.round(Number(bid.qty || 0) / 40)} maund</span><span className="text-xl font-extrabold">{formatPKR(total)}</span></div>
            <p className="text-xs text-slate-500">If accepted, you&apos;ll lock this amount in escrow. Funds are released to the farmer only after you confirm delivery.</p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setTarget(null)}>Cancel</button>
              <button className="btn-primary" disabled={busy}>{busy && <Spinner />} Submit bid</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
