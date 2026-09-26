"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, Badge, Drawer, EmptyState, PageHeader, Spinner } from "@/components/ui";
import { LogisticsStepper } from "@/components/stepper";
import { useToast } from "@/components/providers";
import type { OrderRow } from "@/components/orders-board";
import { CITIES, CITY_NAMES, DELIVERY_STAGES, STATUS_LABELS, cropImage, formatDate, formatKg, formatPKR, formatPKRShort, nextStage, stageIndex } from "@/lib/constants";

type Filter = "all" | "inspection" | "transit" | "escrow" | "disputed" | "done";
type Sort = "newest" | "oldest" | "amount_desc" | "amount_asc";

const PAGE_SIZE = 10;

const FILTERS: { key: Filter; label: string; match: (o: OrderRow) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "inspection", label: "Needs inspection", match: (o) => o.paymentStatus === "escrow_locked" && o.deliveryStage === "confirmed" },
  { key: "transit", label: "In transit", match: (o) => o.paymentStatus === "escrow_locked" && ["quality_checked", "dispatched", "in_transit"].includes(o.deliveryStage) },
  { key: "escrow", label: "Awaiting escrow", match: (o) => o.paymentStatus === "awaiting_escrow" },
  { key: "disputed", label: "Disputed", match: (o) => o.paymentStatus === "disputed" },
  { key: "done", label: "Completed", match: (o) => o.paymentStatus === "released" || o.paymentStatus === "refunded" },
];

const EVENT_LABEL: Record<string, string> = {
  confirmed: "Order placed",
  escrow_locked: "Escrow funded",
  quality_checked: "Quality inspected",
  dispatched: "Dispatched",
  in_transit: "In transit",
  location_update: "Checkpoint update",
  delivered: "Delivered",
  escrow_released: "Payment released",
  escrow_refunded: "Buyer refunded",
  dispute_opened: "Dispute opened",
};

/** Next action an admin can take on an order, or null. */
function adminAction(o: OrderRow): { label: string; icon: string } | null {
  if (o.paymentStatus !== "escrow_locked") return null;
  const next = nextStage(o.deliveryStage);
  if (next === "quality_checked") return { label: "Inspect", icon: "🔬" };
  if (next === "dispatched") return { label: "Dispatch", icon: "📦" };
  if (next === "in_transit") return { label: "In transit", icon: "🚚" };
  if (next === "delivered") return { label: "Deliver", icon: "🏁" };
  return null;
}

function ProgressBar({ o }: { o: OrderRow }) {
  const idx = stageIndex(o.deliveryStage);
  const disputed = o.paymentStatus === "disputed";
  const refunded = o.paymentStatus === "refunded";
  return (
    <div className="w-32">
      <div className="flex gap-1" aria-hidden>
        {DELIVERY_STAGES.map((s, i) => (
          <span
            key={s.key}
            className={`h-1.5 flex-1 rounded-full ${
              i <= idx ? (disputed ? "bg-rose-500" : refunded ? "bg-violet-400" : "bg-brand-600") : "bg-slate-200 dark:bg-white/10"
            }`}
          />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{STATUS_LABELS[o.deliveryStage]}</p>
    </div>
  );
}

export function AdminOrdersTable() {
  const { push } = useToast();
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(
    () =>
      api<OrderRow[]>("/api/orders")
        .then(setOrders)
        .catch((e) => push({ kind: "error", title: "Could not load orders", body: (e as Error).message })),
    [push],
  );
  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter)!;
    const term = q.trim().toLowerCase();
    const list = (orders ?? []).filter(
      (o) =>
        f.match(o) &&
        (!term || [o.trackingNumber, o.cropName, o.farmerName, o.farmName, o.buyerName, o.buyerBusiness, o.farmLocation, o.buyerCity].some((v) => v?.toLowerCase().includes(term))),
    );
    return list.sort((a, b) =>
      sort === "newest" ? +new Date(b.createdAt) - +new Date(a.createdAt)
      : sort === "oldest" ? +new Date(a.createdAt) - +new Date(b.createdAt)
      : sort === "amount_desc" ? b.totalAmount - a.totalAmount
      : a.totalAmount - b.totalAmount,
    );
  }, [orders, filter, q, sort]);

  useEffect(() => setPage(1), [filter, q, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selected = orders?.find((o) => o.orderId === openId) ?? null;

  const kpi = useMemo(() => {
    const all = orders ?? [];
    const count = (k: Filter) => all.filter(FILTERS.find((f) => f.key === k)!.match).length;
    return {
      total: all.length,
      value: all.filter((o) => o.paymentStatus !== "refunded").reduce((s, o) => s + o.totalAmount, 0),
      inspection: count("inspection"),
      transit: count("transit"),
      disputed: count("disputed"),
      frozen: all.filter((o) => o.paymentStatus === "disputed").reduce((s, o) => s + o.totalAmount, 0),
    };
  }, [orders]);

  return (
    <div>
      <PageHeader title="Orders" urdu="آرڈرز" subtitle="Inspect, dispatch and resolve every order on the platform" />

      {/* KPI strip */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total orders", value: kpi.total, sub: formatPKRShort(kpi.value), f: "all" as Filter },
          { label: "Needs inspection", value: kpi.inspection, sub: "Escrow funded", f: "inspection" as Filter, accent: kpi.inspection > 0 },
          { label: "In transit", value: kpi.transit, sub: "Inspected → on the road", f: "transit" as Filter },
          { label: "Open disputes", value: kpi.disputed, sub: kpi.disputed ? `${formatPKRShort(kpi.frozen)} frozen` : "None", f: "disputed" as Filter, danger: kpi.disputed > 0 },
        ].map((k) => (
          <button
            key={k.label}
            onClick={() => setFilter(k.f)}
            className={`card p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${filter === k.f ? "ring-2 ring-brand-600" : ""}`}
          >
            <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">{k.label}</p>
            <p className={`mt-1 text-2xl font-extrabold tabular-nums ${k.danger ? "text-rose-600" : k.accent ? "text-amber-600" : ""}`}>{orders ? k.value : "—"}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{k.sub}</p>
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {/* Toolbar */}
        <div className="space-y-3 border-b border-slate-200 p-4 dark:border-white/5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-sm">
              <svg className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
              </svg>
              <input className="input pl-9" placeholder="Search tracking no., crop, party…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search orders" />
            </div>
            <select className="input sm:ml-auto sm:w-48" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort orders">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="amount_desc">Amount: high → low</option>
              <option value="amount_asc">Amount: low → high</option>
            </select>
          </div>
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5" role="tablist" aria-label="Filter orders">
            {FILTERS.map((f) => {
              const n = orders ? orders.filter(f.match).length : 0;
              return (
                <button
                  key={f.key}
                  role="tab"
                  aria-selected={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                    filter === f.key ? "bg-brand-900 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
                  }`}
                >
                  {f.label}
                  <span className={`rounded-md px-1.5 text-[10px] tabular-nums ${filter === f.key ? "bg-white/20" : "bg-slate-100 dark:bg-white/10"}`}>{n}</span>
                </button>
              );
            })}
          </div>
        </div>

        {!orders ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6"><EmptyState icon="📭" title="No orders match" body="Try a different filter or search term." /></div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="table-head">
                  <tr>
                    <th className="px-4 py-3 whitespace-nowrap">Order</th>
                    <th className="px-4 py-3">Produce</th>
                    <th className="px-4 py-3 whitespace-nowrap">Farmer → Buyer</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Progress</th>
                    <th className="px-4 py-3 text-right"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {pageRows.map((o) => {
                    const act = adminAction(o);
                    return (
                      <tr key={o.orderId} onClick={() => setOpenId(o.orderId)} className="cursor-pointer align-middle transition hover:bg-brand-50/50 dark:hover:bg-white/[0.03]">
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs font-semibold whitespace-nowrap text-slate-900 dark:text-slate-100">{o.trackingNumber}</p>
                          <p className="text-xs whitespace-nowrap text-slate-500">{formatDate(o.createdAt)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={cropImage(o.imagesJson, o.cropName, o.category)} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                            <div className="min-w-0 max-w-[180px]">
                              <p className="truncate font-medium" title={o.cropName}>{o.cropName}</p>
                              <p className="text-xs whitespace-nowrap text-slate-500">{formatKg(o.quantityKg)} · Grade {o.qualityGrade}</p>
                            </div>
                          </div>
                        </td>
                        <td className="max-w-[220px] px-4 py-3">
                          <p className="truncate font-medium">{o.farmName ?? o.farmerName}</p>
                          <p className="truncate text-xs text-slate-500">→ {o.buyerBusiness ?? o.buyerName} · {o.buyerCity}</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="font-semibold whitespace-nowrap tabular-nums">{formatPKR(o.totalAmount)}</p>
                          <p className="text-xs whitespace-nowrap text-slate-500 tabular-nums">{formatPKR(o.pricePerKg, 2)}/kg</p>
                        </td>
                        <td className="px-4 py-3"><Badge status={o.paymentStatus} /></td>
                        <td className="px-4 py-3"><ProgressBar o={o} /></td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {o.paymentStatus === "disputed" ? (
                            <button className="btn-danger px-3 py-1.5 text-xs" onClick={(e) => { e.stopPropagation(); setOpenId(o.orderId); }}>Resolve</button>
                          ) : act ? (
                            <button className="btn-primary px-3 py-1.5 text-xs" onClick={(e) => { e.stopPropagation(); setOpenId(o.orderId); }}>{act.icon} {act.label}</button>
                          ) : (
                            <span className="text-xs font-semibold text-brand-700 dark:text-brand-400">View →</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile list */}
            <ul className="divide-y divide-slate-100 md:hidden dark:divide-white/5">
              {pageRows.map((o) => (
                <li key={o.orderId}>
                  <button onClick={() => setOpenId(o.orderId)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cropImage(o.imagesJson, o.cropName, o.category)} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-medium">{o.cropName}</p>
                        <p className="text-sm font-semibold tabular-nums">{formatPKRShort(o.totalAmount)}</p>
                      </div>
                      <p className="truncate text-xs text-slate-500">{o.trackingNumber} · {o.buyerBusiness ?? o.buyerName}</p>
                      <div className="mt-1.5 flex items-center gap-2"><Badge status={o.paymentStatus} /><Badge status={o.deliveryStage} dot={false} /></div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            {/* Pagination */}
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm dark:border-white/5">
              <p className="text-slate-500">
                <span className="tabular-nums">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, rows.length)}</span> of <span className="tabular-nums">{rows.length}</span>
              </p>
              <div className="flex items-center gap-1">
                <button className="btn-secondary px-3 py-1.5 text-xs" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
                <span className="px-2 text-xs text-slate-500 tabular-nums">{page} / {pages}</span>
                <button className="btn-secondary px-3 py-1.5 text-xs" disabled={page === pages} onClick={() => setPage((p) => p + 1)}>Next →</button>
              </div>
            </div>
          </>
        )}
      </div>

      <OrderDrawer order={selected} onClose={() => setOpenId(null)} onChanged={load} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Detail drawer                                                       */
/* ------------------------------------------------------------------ */
function OrderDrawer({ order, onClose, onChanged }: { order: OrderRow | null; onClose: () => void; onChanged: () => Promise<unknown> | void }) {
  const { push } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ grade: "A", moisture: "12", note: "", location: "", resolution: "" });

  useEffect(() => {
    if (order) setForm({ grade: order.qualityGrade, moisture: "12", note: "", location: "", resolution: order.disputes.find((d) => d.status === "open" || d.status === "investigating")?.resolution ?? "" });
  }, [order?.orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!order) return <Drawer open={false} onClose={onClose} title="">{null}</Drawer>;
  const o = order;
  const next = nextStage(o.deliveryStage);
  const locked = o.paymentStatus === "escrow_locked";
  const dispute = o.disputes.find((d) => d.status === "open" || d.status === "investigating");
  const moving = locked && (o.deliveryStage === "dispatched" || o.deliveryStage === "in_transit");

  async function run(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    try {
      await fn();
      push({ kind: "success", title: ok });
      await onChanged();
      setForm((f) => ({ ...f, note: "", location: "" }));
    } catch (e) {
      push({ kind: "error", title: "Action failed", body: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const advance = () =>
    run(
      "advance",
      () =>
        api(`/api/orders/${o.orderId}`, {
          method: "PATCH",
          json: {
            action: "advance",
            location: form.location || undefined,
            note: form.note || undefined,
            ...(next === "quality_checked" ? { grade: form.grade, moisture: Number(form.moisture) } : {}),
          },
        }),
      `Order marked ${STATUS_LABELS[next ?? ""]?.toLowerCase() ?? "updated"}`,
    );

  return (
    <Drawer
      open
      wide
      onClose={onClose}
      title={<span className="flex items-center gap-2"><span className="font-mono text-sm">{o.trackingNumber}</span><Badge status={o.paymentStatus} /></span>}
    >
      <div className="space-y-6">
        {/* Summary */}
        <section className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cropImage(o.imagesJson, o.cropName, o.category)} alt="" className="h-16 w-16 rounded-xl object-cover" />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold">{o.cropName}</p>
            <p className="text-sm text-slate-500">{formatKg(o.quantityKg)} · Grade {o.qualityGrade} · {formatPKR(o.pricePerKg, 2)}/kg</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-extrabold tabular-nums">{formatPKR(o.totalAmount)}</p>
            <p className="text-xs text-slate-500">Placed {formatDate(o.createdAt)}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
          <LogisticsStepper stage={o.deliveryStage} compact disputed={o.paymentStatus === "disputed"} />
          {o.transitLocation && o.deliveryStage !== "confirmed" && <p className="mt-4 text-center text-xs text-slate-500">📍 {o.transitLocation}</p>}
        </section>

        <section className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
            <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Farmer</p>
            <p className="mt-1 font-semibold">{o.farmName ?? o.farmerName}</p>
            <p className="text-xs text-slate-500">{o.farmLocation}{CITIES[o.farmLocation] ? `, ${CITIES[o.farmLocation].province}` : ""}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
            <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Buyer</p>
            <p className="mt-1 font-semibold">{o.buyerBusiness ?? o.buyerName}</p>
            <p className="text-xs text-slate-500">{o.buyerCity} · ETA {formatDate(o.expectedDeliveryDate)}</p>
          </div>
        </section>

        {/* Dispute resolution */}
        {dispute && (
          <section className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 dark:border-rose-900 dark:bg-rose-950/20">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-rose-900 dark:text-rose-200">Dispute</p>
              <Badge status={dispute.status} />
            </div>
            <p className="mt-2 text-sm text-rose-900/80 dark:text-rose-200/80">{dispute.reason}</p>
            <label className="label mt-3">Resolution notes</label>
            <textarea className="input" rows={3} value={form.resolution} onChange={(e) => setForm({ ...form, resolution: e.target.value })} placeholder="Findings from weighbridge slip, lab re-test, calls with both parties…" />
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button className="btn-secondary text-xs" disabled={!!busy} onClick={() => run("inv", () => api(`/api/admin/disputes/${dispute.disputeId}`, { method: "PATCH", json: { outcome: "investigating", resolution: form.resolution || undefined } }), "Marked as investigating")}>
                {busy === "inv" && <Spinner />} Investigating
              </button>
              <button className="btn-primary text-xs" disabled={!!busy || !form.resolution.trim()} onClick={() => run("rel", () => api(`/api/admin/disputes/${dispute.disputeId}`, { method: "PATCH", json: { outcome: "release", resolution: form.resolution } }), "Payment released to farmer")}>
                {busy === "rel" && <Spinner />} Pay farmer
              </button>
              <button className="btn-danger text-xs" disabled={!!busy || !form.resolution.trim()} onClick={() => run("ref", () => api(`/api/admin/disputes/${dispute.disputeId}`, { method: "PATCH", json: { outcome: "refund", resolution: form.resolution } }), "Buyer refunded")}>
                {busy === "ref" && <Spinner />} Refund buyer
              </button>
            </div>
          </section>
        )}

        {/* Next action */}
        {locked && next && (
          <section className="rounded-2xl border border-brand-200 bg-brand-50/50 p-4 dark:border-brand-900 dark:bg-brand-950/20">
            <p className="font-semibold">Next step: {DELIVERY_STAGES.find((s) => s.key === next)!.label}</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {next === "quality_checked" ? (
                <>
                  <div>
                    <label className="label">Grade</label>
                    <select className="input" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}><option>A</option><option>B</option><option>C</option></select>
                  </div>
                  <div>
                    <label className="label">Moisture %</label>
                    <input type="number" step="0.1" min="0" max="100" className="input" value={form.moisture} onChange={(e) => setForm({ ...form, moisture: e.target.value })} />
                  </div>
                </>
              ) : (
                <div className="col-span-2">
                  <label className="label">{next === "delivered" ? "Received at" : "Location"}</label>
                  <input className="input" list="admin-cities" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder={next === "delivered" ? "Buyer warehouse" : "e.g. M-2 Motorway, Sheikhupura"} />
                </div>
              )}
              <div className="col-span-2">
                <label className="label">Note (optional)</label>
                <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={next === "dispatched" ? "Truck LES-4521, driver 0300-…" : ""} />
              </div>
            </div>
            {next === "delivered" && <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">Confirming delivery releases {formatPKR(o.totalAmount)} to the farmer (minus 1.5% fee).</p>}
            <button className="btn-primary mt-3 w-full" disabled={!!busy} onClick={advance}>
              {busy === "advance" && <Spinner />} Mark as {STATUS_LABELS[next].toLowerCase()}
            </button>
          </section>
        )}

        {moving && (
          <section className="flex gap-2">
            <input className="input" list="admin-cities" placeholder="Update checkpoint location…" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <button
              className="btn-secondary shrink-0"
              disabled={!!busy || !form.location}
              onClick={() => run("loc", () => api(`/api/orders/${o.orderId}`, { method: "PATCH", json: { action: "update_location", location: form.location } }), "Checkpoint updated")}
            >
              {busy === "loc" && <Spinner />} Update
            </button>
          </section>
        )}

        {o.paymentStatus === "awaiting_escrow" && (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Waiting for the buyer to fund escrow. No action required yet.</p>
        )}

        {/* Timeline */}
        <section>
          <p className="mb-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Activity</p>
          <ol className="relative space-y-4 border-l border-slate-200 pl-5 dark:border-white/10">
            {[...o.events].reverse().map((e) => (
              <li key={e.eventId} className="relative">
                <span className={`absolute top-1.5 -left-[25px] h-2.5 w-2.5 rounded-full ring-4 ring-white dark:ring-[#0d1f16] ${e.stage.includes("dispute") ? "bg-rose-500" : e.stage.includes("escrow") ? "bg-gold-400" : "bg-brand-600"}`} />
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold">{EVENT_LABEL[e.stage] ?? e.stage.replace(/_/g, " ")}</p>
                  <time className="shrink-0 text-xs text-slate-500">{new Date(e.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
                </div>
                {(e.location || e.note) && <p className="text-xs text-slate-500">{[e.location, e.note].filter(Boolean).join(" · ")}</p>}
              </li>
            ))}
          </ol>
        </section>
      </div>
      <datalist id="admin-cities">{CITY_NAMES.map((c) => <option key={c} value={`${c}, ${CITIES[c].province}`} />)}</datalist>
    </Drawer>
  );
}
