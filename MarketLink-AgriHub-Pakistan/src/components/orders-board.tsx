"use client";

import { useCallback, useEffect, useState } from "react";
import { api, Badge, EmptyState, LoadingBlock, Modal, PageHeader, Spinner } from "@/components/ui";
import { LogisticsStepper } from "@/components/stepper";
import { useToast } from "@/components/providers";
import { CITIES, CITY_NAMES, DELIVERY_STAGES, cropImage, formatDate, formatKg, formatPKR, nextStage, PLATFORM_FEE_RATE, type Category, type DeliveryStage, type Role } from "@/lib/constants";

export type OrderRow = {
  orderId: number; trackingNumber: string; quantityKg: number; pricePerKg: number; totalAmount: number; paymentStatus: string; deliveryStage: DeliveryStage;
  transitLocation: string | null; expectedDeliveryDate: string | null; createdAt: string; cropName: string; category: Category; qualityGrade: string; farmLocation: string; imagesJson: string[];
  farmerName: string; farmName: string | null; buyerName: string; buyerBusiness: string | null; buyerCity: string;
  events: { eventId: number; stage: string; location: string | null; note: string | null; createdAt: string }[];
  disputes: { disputeId: number; reason: string; status: string; resolution: string | null }[];
};

const EVENT_ICON: Record<string, string> = { confirmed: "📝", escrow_locked: "🔐", quality_checked: "🔬", dispatched: "📦", in_transit: "🚚", location_update: "📍", delivered: "🏁", escrow_released: "💸", escrow_refunded: "↩️", dispute_opened: "⚠️" };

type Dialog = { order: OrderRow; kind: "advance" | "location" | "dispute" | "escrow" } | null;

export function OrdersBoard({ role, title, subtitle }: { role: Role; title: string; subtitle: string }) {
  const { push } = useToast();
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [tab, setTab] = useState<"active" | "done" | "all">("active");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [form, setForm] = useState({ location: "", note: "", grade: "A", moisture: "12" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<OrderRow[]>("/api/orders").then(setOrders).catch((e) => push({ kind: "error", title: e.message })), [push]);
  useEffect(() => { load(); }, [load]);

  const isDone = (o: OrderRow) => (o.deliveryStage === "delivered" && o.paymentStatus !== "disputed") || o.paymentStatus === "refunded";
  const shown = (orders ?? []).filter((o) => (tab === "all" ? true : tab === "done" ? isDone(o) : !isDone(o)));

  function openDialog(order: OrderRow, kind: NonNullable<Dialog>["kind"]) {
    setForm({ location: kind === "advance" && nextStage(order.deliveryStage) === "in_transit" ? "" : (order.transitLocation ?? ""), note: "", grade: order.qualityGrade, moisture: "12" });
    setDialog({ order, kind });
  }

  async function submit() {
    if (!dialog) return;
    const { order, kind } = dialog;
    setBusy(true);
    try {
      if (kind === "dispute") {
        await api(`/api/orders/${order.orderId}/dispute`, { method: "POST", json: { reason: form.note } });
        push({ kind: "info", title: "Dispute raised", body: "Escrow is frozen until an admin resolves it." });
      } else if (kind === "escrow") {
        await api(`/api/orders/${order.orderId}`, { method: "PATCH", json: { action: "lock_escrow" } });
        push({ kind: "success", title: "Funds locked in escrow", body: `${formatPKR(order.totalAmount)} secured for ${order.trackingNumber}` });
      } else if (kind === "location") {
        await api(`/api/orders/${order.orderId}`, { method: "PATCH", json: { action: "update_location", location: form.location } });
        push({ kind: "success", title: "Checkpoint updated" });
      } else {
        const next = nextStage(order.deliveryStage)!;
        await api(`/api/orders/${order.orderId}`, {
          method: "PATCH",
          json: { action: "advance", location: form.location || undefined, note: form.note || undefined, ...(next === "quality_checked" ? { grade: form.grade, moisture: Number(form.moisture) } : {}) },
        });
        push({ kind: "success", title: `Order ${DELIVERY_STAGES.find((s) => s.key === next)!.label}`, body: next === "delivered" ? "Escrow released to the farmer." : undefined });
      }
      setDialog(null);
      load();
    } catch (e) {
      push({ kind: "error", title: "Action failed", body: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  function shareGps(o: OrderRow) {
    if (!navigator.geolocation) return push({ kind: "error", title: "GPS not available on this device" });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await api(`/api/orders/${o.orderId}/gps`, { method: "POST", json: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
          push({ kind: "success", title: "Live location shared with the buyer" });
          load();
        } catch (e) {
          push({ kind: "error", title: (e as Error).message });
        }
      },
      () => push({ kind: "error", title: "Location permission denied" }),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function actions(o: OrderRow) {
    const next = nextStage(o.deliveryStage);
    const btns: React.ReactNode[] = [];
    const locked = o.paymentStatus === "escrow_locked";
    if (role === "buyer" && o.paymentStatus === "awaiting_escrow") btns.push(<button key="esc" className="btn-primary" onClick={() => openDialog(o, "escrow")}>🔐 Lock {formatPKR(o.totalAmount)} in escrow</button>);
    if (locked && next === "quality_checked" && role === "admin") btns.push(<button key="qc" className="btn-primary" onClick={() => openDialog(o, "advance")}>🔬 Record quality inspection</button>);
    if (locked && (next === "dispatched" || next === "in_transit") && (role === "farmer" || role === "admin"))
      btns.push(<button key="adv" className="btn-primary" onClick={() => openDialog(o, "advance")}>{next === "dispatched" ? "📦 Mark dispatched" : "🚚 Mark in transit"}</button>);
    if (locked && (o.deliveryStage === "dispatched" || o.deliveryStage === "in_transit") && (role === "farmer" || role === "admin"))
      btns.push(<button key="loc" className="btn-secondary" onClick={() => openDialog(o, "location")}>📍 Update checkpoint</button>);
    if (locked && next === "delivered" && (role === "buyer" || role === "admin"))
      btns.push(<button key="del" className="btn-primary" onClick={() => openDialog(o, "advance")}>🏁 Confirm delivery & release escrow</button>);
    if (["dispatched", "in_transit", "quality_checked", "delivered"].includes(o.deliveryStage)) btns.push(<a key="trk" href={`/tracking?no=${o.trackingNumber}`} className="btn-secondary">📍 Live map</a>);
    if (locked && role === "farmer" && (o.deliveryStage === "dispatched" || o.deliveryStage === "in_transit")) btns.push(<button key="gps" className="btn-secondary" onClick={() => shareGps(o)}>📡 Share GPS</button>);
    if (locked && role !== "admin") btns.push(<button key="dis" className="btn-secondary text-rose-600" onClick={() => openDialog(o, "dispute")}>⚠️ Raise dispute</button>);
    return btns;
  }

  function waitingText(o: OrderRow) {
    if (o.paymentStatus === "disputed") return "⚖️ Under dispute review — progression frozen";
    if (o.paymentStatus === "refunded") return "↩️ Refunded to buyer";
    if (o.paymentStatus === "awaiting_escrow") return role === "buyer" ? null : "⏳ Waiting for buyer to lock funds in escrow";
    const next = nextStage(o.deliveryStage);
    if (!next) return "✅ Completed — payment released";
    const who = DELIVERY_STAGES.find((s) => s.key === next)!.actor;
    if (who === role) return null;
    return `⏳ Next: ${DELIVERY_STAGES.find((s) => s.key === next)!.label} by ${who === "admin" ? "quality inspector" : who}`;
  }

  const d = dialog;
  const dNext = d ? nextStage(d.order.deliveryStage) : null;

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="mb-4 flex flex-wrap gap-2">
        {(["active", "done", "all"] as const).map((x) => (
          <button key={x} onClick={() => setTab(x)} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize ${tab === x ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700"}`}>
            {x === "done" ? "Completed" : x} {orders && <span className="opacity-60">({orders.filter((o) => (x === "all" ? true : x === "done" ? isDone(o) : !isDone(o))).length})</span>}
          </button>
        ))}
      </div>

      {!orders ? <LoadingBlock /> : shown.length === 0 ? (
        <EmptyState icon="🚚" title="No orders here" body="Orders appear once a bid is accepted." />
      ) : (
        <div className="space-y-4">
          {shown.map((o) => {
            const wait = waitingText(o);
            const acts = actions(o);
            return (
              <article key={o.orderId} className="card overflow-hidden">
                <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:p-5 dark:border-slate-800">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cropImage(o.imagesJson, o.cropName, o.category)} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                    <div className="min-w-0">
                      <p className="font-semibold">{o.cropName} · {formatKg(o.quantityKg)} <span className="font-mono text-xs text-slate-500">#{o.trackingNumber}</span></p>
                      <p className="truncate text-xs text-slate-500">
                        🧑‍🌾 {o.farmName ?? o.farmerName} ({o.farmLocation}) → 🏢 {o.buyerBusiness ?? o.buyerName} ({o.buyerCity})
                      </p>
                      <p className="text-xs text-slate-500">Placed {formatDate(o.createdAt)} · ETA {formatDate(o.expectedDeliveryDate)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
                    <p className="text-lg font-bold">{formatPKR(o.totalAmount)}</p>
                    <p className="text-xs text-slate-500">@ {formatPKR(o.pricePerKg, 2)}/kg</p>
                    <Badge status={o.paymentStatus} />
                  </div>
                </div>
                <div className="p-4 sm:p-5">
                  <LogisticsStepper stage={o.deliveryStage} disputed={o.paymentStatus === "disputed"} />
                  {o.transitLocation && o.deliveryStage !== "confirmed" && (
                    <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-300">📍 Last known location: <b>{o.transitLocation}</b></p>
                  )}
                  {o.disputes.filter((x) => x.status === "open" || x.status === "investigating").map((x) => (
                    <p key={x.disputeId} className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/30 dark:text-rose-300">⚠️ Dispute ({x.status}): {x.reason}</p>
                  ))}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {acts}
                    {wait && <span className="text-sm text-slate-500">{wait}</span>}
                    <button className="ml-auto text-sm font-semibold text-brand-600 hover:underline" onClick={() => setExpanded(expanded === o.orderId ? null : o.orderId)}>
                      {expanded === o.orderId ? "Hide" : "Show"} tracking history ({o.events.length})
                    </button>
                  </div>
                  {expanded === o.orderId && (
                    <ol className="animate-fade-in mt-4 space-y-3 border-l-2 border-slate-200 pl-5 dark:border-slate-700">
                      {[...o.events].reverse().map((e) => (
                        <li key={e.eventId} className="relative">
                          <span className="absolute top-0 -left-[31px] grid h-6 w-6 place-items-center rounded-full bg-white text-xs ring-2 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">{EVENT_ICON[e.stage] ?? "•"}</span>
                          <p className="text-sm font-semibold capitalize">{e.stage.replace(/_/g, " ")}</p>
                          <p className="text-xs text-slate-500">{new Date(e.createdAt).toLocaleString("en-GB")} {e.location && `· ${e.location}`}</p>
                          {e.note && <p className="text-xs text-slate-600 dark:text-slate-400">{e.note}</p>}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={!!d}
        onClose={() => setDialog(null)}
        title={
          !d ? "" : d.kind === "escrow" ? "Lock funds in escrow" : d.kind === "dispute" ? "Raise a dispute" : d.kind === "location" ? "Update shipment checkpoint" : `Advance to: ${DELIVERY_STAGES.find((s) => s.key === dNext)?.label}`
        }
      >
        {d && (
          <div className="space-y-4">
            {d.kind === "escrow" && (
              <div className="space-y-3 text-sm">
                <p>MarketLink holds <b>{formatPKR(d.order.totalAmount)}</b> from your wallet in escrow. It is released to the farmer only when you confirm delivery.</p>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                  <div className="flex justify-between"><span>Order value</span><b>{formatPKR(d.order.totalAmount)}</b></div>
                  <div className="flex justify-between text-slate-500"><span>Farmer receives (after {PLATFORM_FEE_RATE * 100}% fee)</span><span>{formatPKR(d.order.totalAmount * (1 - PLATFORM_FEE_RATE))}</span></div>
                </div>
              </div>
            )}
            {d.kind === "dispute" && (
              <div>
                <label className="label">Describe the issue</label>
                <textarea className="input" rows={4} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. Quantity short by 200kg, moisture above agreed level…" />
                <p className="mt-2 text-xs text-slate-500">Funds stay locked in escrow while an admin investigates.</p>
              </div>
            )}
            {(d.kind === "location" || (d.kind === "advance" && (dNext === "dispatched" || dNext === "in_transit" || dNext === "delivered"))) && (
              <div>
                <label className="label">{dNext === "delivered" ? "Received at" : "Current location / checkpoint"}</label>
                <input className="input" list="cities" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder={dNext === "delivered" ? "Buyer warehouse" : "e.g. Motorway M-4, Pindi Bhattian toll"} />
                <datalist id="cities">{CITY_NAMES.map((c) => <option key={c} value={`${c}, ${CITIES[c].province}`} />)}</datalist>
              </div>
            )}
            {d.kind === "advance" && dNext === "quality_checked" && (
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Grade assigned</label><select className="input" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}><option>A</option><option>B</option><option>C</option></select></div>
                <div><label className="label">Moisture %</label><input type="number" step="0.1" className="input" value={form.moisture} onChange={(e) => setForm({ ...form, moisture: e.target.value })} /></div>
              </div>
            )}
            {d.kind === "advance" && (
              <div>
                <label className="label">Note (optional)</label>
                <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={dNext === "dispatched" ? "Truck LES-4521, driver Akram 0300-..." : ""} />
              </div>
            )}
            {d.kind === "advance" && dNext === "delivered" && (
              <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                Confirming delivery releases <b>{formatPKR(d.order.totalAmount)}</b> from escrow to the farmer. This cannot be undone.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setDialog(null)}>Cancel</button>
              <button className={d.kind === "dispute" ? "btn-danger" : "btn-primary"} disabled={busy || (d.kind === "dispute" && form.note.trim().length < 5) || (d.kind === "location" && !form.location)} onClick={submit}>
                {busy && <Spinner />} Confirm
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
