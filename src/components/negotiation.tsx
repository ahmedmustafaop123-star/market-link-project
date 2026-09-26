"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, Badge, Drawer, EmptyState, GradeBadge, LoadingBlock, PageHeader, Spinner } from "@/components/ui";
import { useI18n, useToast } from "@/components/providers";
import { cropImage, formatDate, formatKg, formatPKR, type Category } from "@/lib/constants";

type BidRow = {
  bidId: number; cropId: number; buyerId: number; bidPricePerKg: number; bidQuantityKg: number; targetDeliveryDate: string | null; message: string | null;
  status: "pending" | "accepted" | "rejected" | "countered" | "withdrawn"; counterPrice: number | null; counterNote: string | null; createdAt: string; updatedAt: string;
  cropName: string; category: Category; qualityGrade: string; basePricePerKg: number; availableKg: number; farmLocation: string; imagesJson: string[];
  farmerName: string; buyerName: string; buyerBusiness: string | null; buyerCity: string; orderId: number | null;
};
type Rate = { avgPricePerKg: number };
type Result = { kind: "accepted" | "countered" | "rejected" | "withdrawn" | "revised"; tracking?: string };

const TABS = [
  { key: "open", label: "Open", match: (s: string) => s === "pending" || s === "countered" },
  { key: "accepted", label: "Accepted", match: (s: string) => s === "accepted" },
  { key: "closed", label: "Closed", match: (s: string) => s === "rejected" || s === "withdrawn" },
  { key: "all", label: "All", match: () => true },
];

export function NegotiationBoard({ role }: { role: "farmer" | "buyer" }) {
  const { push } = useToast();
  const { t } = useI18n();
  const [bids, setBids] = useState<BidRow[] | null>(null);
  const [tab, setTab] = useState("open");
  const [active, setActive] = useState<BidRow | null>(null);
  const [mandiAvg, setMandiAvg] = useState<number | null>(null);
  const [mode, setMode] = useState<"view" | "counter" | "revise">("view");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const load = useCallback(() => api<BidRow[]>("/api/bids").then(setBids).catch((e) => push({ kind: "error", title: e.message })), [push]);
  useEffect(() => { load(); }, [load]);

  function open(b: BidRow) {
    setActive(b);
    setMode("view");
    setResult(null);
    setNote("");
    setPrice(role === "farmer" ? String(Math.round(((b.bidPricePerKg + b.basePricePerKg) / 2) * 100) / 100) : String(b.counterPrice ?? b.bidPricePerKg));
    setMandiAvg(null);
    api<Rate[]>(`/api/mandi-rates?view=latest&crop=${encodeURIComponent(b.cropName)}`)
      .then((r) => setMandiAvg(r.length ? r.reduce((s, x) => s + x.avgPricePerKg, 0) / r.length : null))
      .catch(() => {});
  }

  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (!active) return;
    setBusy(action);
    try {
      const r = await api<{ bid: BidRow; order?: { trackingNumber: string } }>(`/api/bids/${active.bidId}`, { method: "PATCH", json: { action, ...extra } });
      const kind: Result["kind"] =
        action === "accept" || action === "accept_counter" ? "accepted" : action === "counter" ? "countered" : action === "withdraw" ? "withdrawn" : action === "revise" ? "revised" : "rejected";
      // Instant optimistic UI update
      setBids((prev) =>
        prev?.map((b) =>
          b.bidId === active.bidId
            ? {
                ...b,
                status: kind === "accepted" ? "accepted" : kind === "countered" ? "countered" : kind === "revised" ? "pending" : kind === "withdrawn" ? "withdrawn" : "rejected",
                counterPrice: kind === "countered" ? Number(extra.counterPrice) : b.counterPrice,
                bidPricePerKg: kind === "revised" ? Number(extra.bidPricePerKg) : kind === "accepted" && action === "accept_counter" ? (b.counterPrice ?? b.bidPricePerKg) : b.bidPricePerKg,
              }
            : b,
        ) ?? null,
      );
      setResult({ kind, tracking: r.order?.trackingNumber });
      push({
        kind: kind === "accepted" ? "success" : "info",
        title: kind === "accepted" ? "Deal closed! Order created" : kind === "countered" ? "Counter-offer sent" : kind === "revised" ? "Revised bid sent" : `Bid ${kind}`,
        body: r.order ? `Tracking ${r.order.trackingNumber}` : undefined,
      });
      load();
    } catch (e) {
      push({ kind: "error", title: "Action failed", body: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const tabDef = TABS.find((x) => x.key === tab)!;
  const shown = useMemo(() => (bids ?? []).filter((b) => tabDef.match(b.status)), [bids, tabDef]);

  const b = active;
  const total = b ? b.bidQuantityKg * (b.status === "countered" && b.counterPrice ? b.counterPrice : b.bidPricePerKg) : 0;
  const vsAsk = b ? ((b.bidPricePerKg - b.basePricePerKg) / b.basePricePerKg) * 100 : 0;

  return (
    <div>
      <PageHeader
        title={role === "farmer" ? t("negotiations") : t("myBids")}
        subtitle={role === "farmer" ? "Review buyer offers — accept, reject or counter in one tap" : "Track your bulk purchase offers and respond to farmer counter-offers"}
        actions={role === "buyer" ? <Link href="/marketplace" className="btn-primary">🛒 Browse marketplace</Link> : undefined}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((x) => (
          <button key={x.key} onClick={() => setTab(x.key)} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${tab === x.key ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700"}`}>
            {x.label} {bids && <span className="opacity-60">({bids.filter((y) => x.match(y.status)).length})</span>}
          </button>
        ))}
      </div>

      {!bids ? <LoadingBlock /> : shown.length === 0 ? (
        <EmptyState icon="🤝" title="Nothing here yet" body={role === "farmer" ? "When buyers bid on your listings, they'll appear here." : "Place a bid from the marketplace to start negotiating."} />
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {shown.map((x) => {
              const needsMe = (role === "farmer" && x.status === "pending") || (role === "buyer" && x.status === "countered");
              return (
                <li key={x.bidId}>
                  <button onClick={() => open(x)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50 sm:px-5 dark:hover:bg-slate-800/50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cropImage(x.imagesJson, x.cropName, x.category)} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {x.cropName} <span className="font-normal text-slate-500">· {role === "farmer" ? (x.buyerBusiness ?? x.buyerName) : x.farmerName}</span>
                      </p>
                      <p className="text-xs text-slate-500">{formatKg(x.bidQuantityKg)} · target {formatDate(x.targetDeliveryDate)} · {formatDate(x.updatedAt)}</p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="text-sm font-bold">{formatPKR(x.bidPricePerKg, 2)}<span className="text-xs font-normal text-slate-500">/kg</span></p>
                      {x.status === "countered" && x.counterPrice && <p className="text-xs font-semibold text-sky-600">Counter {formatPKR(x.counterPrice, 2)}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge status={x.status} />
                      {needsMe && <span className="text-[10px] font-bold text-amber-600 uppercase">Action needed</span>}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Drawer open={!!b} onClose={() => setActive(null)} title={b ? `Bid #${b.bidId} · ${b.cropName}` : ""}>
        {b && (
          <div className="space-y-5">
            {result ? (
              <div className="animate-fade-in py-6 text-center">
                <div className={`animate-pop mx-auto grid h-20 w-20 place-items-center rounded-full text-4xl ${result.kind === "accepted" ? "bg-emerald-100 dark:bg-emerald-500/20" : result.kind === "rejected" || result.kind === "withdrawn" ? "bg-rose-100 dark:bg-rose-500/20" : "bg-sky-100 dark:bg-sky-500/20"}`}>
                  {result.kind === "accepted" ? "🎉" : result.kind === "rejected" ? "✋" : result.kind === "withdrawn" ? "↩️" : "💬"}
                </div>
                <h3 className="mt-4 text-xl font-bold">
                  {result.kind === "accepted" ? "Deal closed!" : result.kind === "countered" ? "Counter-offer sent" : result.kind === "revised" ? "Revised bid sent" : result.kind === "withdrawn" ? "Bid withdrawn" : "Offer rejected"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {result.kind === "accepted"
                    ? `Order ${result.tracking ?? ""} created. ${role === "buyer" ? "Lock funds in escrow to start fulfilment." : "Buyer has been notified to fund escrow."}`
                    : result.kind === "countered"
                      ? "The buyer can accept, reject or revise their offer."
                      : result.kind === "revised"
                        ? "The farmer will review your new price."
                        : "This negotiation is now closed."}
                </p>
                <div className="mt-6 flex justify-center gap-2">
                  {result.kind === "accepted" && <Link href={role === "buyer" ? "/buyer/orders" : "/farmer/orders"} className="btn-primary">View order →</Link>}
                  <button className="btn-secondary" onClick={() => setActive(null)}>Close</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cropImage(b.imagesJson, b.cropName, b.category)} alt="" className="h-16 w-16 rounded-xl object-cover" />
                  <div>
                    <p className="font-semibold">{b.cropName} <GradeBadge grade={b.qualityGrade} /></p>
                    <p className="text-xs text-slate-500">📍 {b.farmLocation} · {formatKg(b.availableKg)} available</p>
                    <div className="mt-1"><Badge status={b.status} /></div>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                  <p className="text-xs font-semibold text-slate-500 uppercase">{role === "farmer" ? "Buyer" : "Farmer"}</p>
                  <p className="font-semibold">{role === "farmer" ? `${b.buyerBusiness ?? b.buyerName} · ${b.buyerCity}` : b.farmerName}</p>
                  {b.message && <p className="mt-2 rounded-lg bg-white p-2.5 text-sm italic dark:bg-slate-900">&ldquo;{b.message}&rdquo;</p>}
                </div>

                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><dt className="text-xs text-slate-500">Bid price</dt><dd className="text-lg font-bold">{formatPKR(b.bidPricePerKg, 2)}</dd><dd className={`text-xs font-semibold ${vsAsk >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{vsAsk >= 0 ? "+" : ""}{vsAsk.toFixed(1)}% vs ask</dd></div>
                  <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><dt className="text-xs text-slate-500">Asking price</dt><dd className="text-lg font-bold">{formatPKR(b.basePricePerKg, 2)}</dd><dd className="text-xs text-slate-500">Mandi avg {mandiAvg ? formatPKR(mandiAvg, 2) : "…"}</dd></div>
                  <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><dt className="text-xs text-slate-500">Quantity</dt><dd className="font-bold">{formatKg(b.bidQuantityKg)}</dd></div>
                  <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><dt className="text-xs text-slate-500">Target delivery</dt><dd className="font-bold">{formatDate(b.targetDeliveryDate)}</dd></div>
                  {b.counterPrice && (
                    <div className="col-span-2 rounded-xl border border-sky-200 bg-sky-50 p-3 dark:border-sky-800 dark:bg-sky-950/30">
                      <dt className="text-xs font-semibold text-sky-700 dark:text-sky-300">Farmer counter-offer</dt>
                      <dd className="text-lg font-bold text-sky-900 dark:text-sky-100">{formatPKR(b.counterPrice, 2)}/kg</dd>
                      {b.counterNote && <dd className="text-xs text-sky-800 dark:text-sky-300">&ldquo;{b.counterNote}&rdquo;</dd>}
                    </div>
                  )}
                  <div className="col-span-2 flex items-center justify-between rounded-xl bg-brand-600 p-3 text-white">
                    <span className="text-sm">Deal value</span><span className="text-xl font-extrabold">{formatPKR(total)}</span>
                  </div>
                </dl>

                {/* Farmer actions */}
                {role === "farmer" && b.status === "pending" && (
                  mode === "counter" ? (
                    <div className="animate-fade-in space-y-3 rounded-2xl border border-sky-200 p-4 dark:border-sky-800">
                      <div><label className="label">Counter price (Rs./kg)</label><input type="number" step="0.01" className="input" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
                      <p className="text-xs text-slate-500">New deal value: <b>{formatPKR(Number(price || 0) * b.bidQuantityKg)}</b></p>
                      <div><label className="label">Note to buyer</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Includes bagging & loading" /></div>
                      <div className="flex gap-2">
                        <button className="btn-secondary flex-1" onClick={() => setMode("view")}>Back</button>
                        <button className="btn-primary flex-1 !bg-sky-600 hover:!bg-sky-700" disabled={!!busy} onClick={() => act("counter", { counterPrice: Number(price), note })}>{busy === "counter" && <Spinner />} Send counter</button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <button className="btn-primary" disabled={!!busy} onClick={() => act("accept")}>{busy === "accept" ? <Spinner /> : "✓"} {t("accept")}</button>
                      <button className="btn-secondary !border-sky-300 !text-sky-700 dark:!text-sky-300" disabled={!!busy} onClick={() => setMode("counter")}>↔ {t("counter")}</button>
                      <button className="btn-danger" disabled={!!busy} onClick={() => act("reject")}>{busy === "reject" ? <Spinner /> : "✕"} {t("reject")}</button>
                    </div>
                  )
                )}
                {role === "farmer" && b.status === "countered" && (
                  <div className="space-y-2">
                    <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-800 dark:bg-sky-950/30 dark:text-sky-300">⏳ Waiting for the buyer to respond to your counter-offer.</p>
                    <button className="btn-secondary w-full text-rose-600" disabled={!!busy} onClick={() => act("reject")}>Withdraw counter & reject</button>
                  </div>
                )}

                {/* Buyer actions */}
                {role === "buyer" && (b.status === "countered" || b.status === "pending") && (
                  mode === "revise" ? (
                    <div className="animate-fade-in space-y-3 rounded-2xl border border-amber-200 p-4 dark:border-amber-800">
                      <div><label className="label">New bid price (Rs./kg)</label><input type="number" step="0.01" className="input" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
                      <div><label className="label">Message</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
                      <div className="flex gap-2">
                        <button className="btn-secondary flex-1" onClick={() => setMode("view")}>Back</button>
                        <button className="btn-amber flex-1" disabled={!!busy} onClick={() => act("revise", { bidPricePerKg: Number(price), note: note || undefined })}>{busy === "revise" && <Spinner />} Send revised bid</button>
                      </div>
                    </div>
                  ) : b.status === "countered" ? (
                    <div className="grid grid-cols-3 gap-2">
                      <button className="btn-primary" disabled={!!busy} onClick={() => act("accept_counter")}>{busy === "accept_counter" ? <Spinner /> : "✓"} Accept</button>
                      <button className="btn-secondary" disabled={!!busy} onClick={() => setMode("revise")}>↔ Revise</button>
                      <button className="btn-danger" disabled={!!busy} onClick={() => act("reject_counter")}>✕ Reject</button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button className="btn-secondary" disabled={!!busy} onClick={() => setMode("revise")}>✏️ Revise price</button>
                      <button className="btn-danger" disabled={!!busy} onClick={() => act("withdraw")}>{busy === "withdraw" && <Spinner />} Withdraw</button>
                    </div>
                  )
                )}
                {b.status === "accepted" && (
                  <Link href={role === "buyer" ? "/buyer/orders" : "/farmer/orders"} className="btn-primary w-full">🚚 Track order</Link>
                )}
              </>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
