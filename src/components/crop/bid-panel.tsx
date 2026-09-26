"use client";

import Link from "next/link";
import { useState } from "react";
import { api, Spinner } from "@/components/ui";
import { useToast } from "@/components/providers";
import { formatPKR, todayISO } from "@/lib/constants";

type Props = {
  crop: { cropId: number; cropName: string; basePricePerKg: number; totalQuantityKg: number; available: boolean };
  viewerRole: string | null;
  isOwner: boolean;
};

/** Direct "Submit Bid / RFQ" call-to-action on the crop details page. */
export function BidPanel({ crop, viewerRole, isOwner }: Props) {
  const { push } = useToast();
  const [f, setF] = useState({ price: String(Math.round(crop.basePricePerKg * 0.97 * 100) / 100), qty: String(Math.min(crop.totalQuantityKg, 1000)), date: todayISO(7), message: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const total = Number(f.price || 0) * Number(f.qty || 0);

  if (!crop.available) return <div className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">This listing is not accepting bids right now.</div>;
  if (isOwner) return <Link href="/farmer/listings" className="btn-secondary w-full">✏️ Manage this listing</Link>;
  if (!viewerRole)
    return (
      <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-900 dark:bg-brand-950/30">
        <p className="text-sm font-semibold text-brand-900 dark:text-brand-100">Sign in as a buyer to submit a bid or RFQ</p>
        <div className="mt-3 flex gap-2">
          <Link href={`/login?next=${encodeURIComponent(`/crop/${crop.cropId}`)}`} className="btn-primary flex-1">Log in</Link>
          <Link href="/register?role=buyer" className="btn-secondary flex-1">Create buyer account</Link>
        </div>
      </div>
    );
  if (viewerRole !== "buyer") return <div className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">Only buyer accounts can submit bids.</div>;
  if (done)
    return (
      <div className="animate-fade-in rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center dark:border-emerald-900 dark:bg-emerald-950/30">
        <p className="text-3xl">🎉</p>
        <p className="mt-2 font-bold">Bid submitted</p>
        <p className="text-sm text-slate-600 dark:text-slate-300">The farmer has been notified. You&apos;ll get a notification when they accept or counter.</p>
        <Link href="/buyer/bids" className="btn-primary mt-4">Track my bids</Link>
      </div>
    );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/bids", { method: "POST", json: { cropId: crop.cropId, bidPricePerKg: Number(f.price), bidQuantityKg: Number(f.qty), targetDeliveryDate: f.date, message: f.message || undefined } });
      setDone(true);
    } catch (err) {
      push({ kind: "error", title: "Bid not submitted", body: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
      <p className="font-bold">Submit bid / RFQ</p>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Price (Rs./kg)</label><input type="number" step="0.01" min={crop.basePricePerKg * 0.5} className="input" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} required /></div>
        <div><label className="label">Quantity (kg)</label><input type="number" min={1} max={crop.totalQuantityKg} className="input" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} required /></div>
        <div className="col-span-2 sm:col-span-1"><label className="label">Delivery by</label><input type="date" min={todayISO(1)} className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required /></div>
        <div className="col-span-2 sm:col-span-1"><label className="label">Terms (optional)</label><input className="input" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder="Packing, pickup…" /></div>
      </div>
      <div className="flex items-center justify-between rounded-xl bg-brand-700 px-4 py-2.5 text-white">
        <span className="text-sm">Offer value · {Math.round(Number(f.qty || 0) / 40)} maund</span>
        <span className="text-lg font-extrabold">{formatPKR(total)}</span>
      </div>
      <button className="btn-primary w-full py-2.5" disabled={busy}>{busy && <Spinner />} Submit bid</button>
      <p className="text-center text-[11px] text-slate-500">Funds are only locked in escrow after the farmer accepts.</p>
    </form>
  );
}
