"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageHeader, Spinner } from "@/components/ui";
import { LogisticsStepper } from "@/components/stepper";
import { formatKg, type DeliveryStage } from "@/lib/constants";
import type { MapData } from "@/components/tracking/tracking-map";

const TrackingMap = dynamic(() => import("@/components/tracking/tracking-map").then((m) => m.TrackingMap), {
  ssr: false,
  loading: () => <div className="h-[380px] animate-pulse rounded-2xl bg-slate-100 dark:bg-white/5" />,
});

type Track = {
  trackingNumber: string; cropName: string; quantityKg: number; stage: DeliveryStage; stageLabel: string; payment: string; disputed: boolean;
  origin: MapData["origin"]; destination: MapData["destination"]; current: MapData["current"]; route: MapData["route"];
  distanceKm: number; eta: string | null; lastUpdate: string;
  events: { id: number; stage: string; label: string; location: string | null; lat: number | null; lng: number | null; note: string | null; at: string }[];
  parties?: { farmer: string | null; buyer: string | null };
};

const ICON: Record<string, string> = { confirmed: "📝", escrow_locked: "🔐", quality_checked: "🔬", dispatched: "📦", in_transit: "🚚", gps_ping: "📡", location_update: "📍", arriving: "⏱️", delivered: "🏁", escrow_released: "💸", escrow_refunded: "↩️", dispute_opened: "⚠️" };

export function TrackingClient({ initial, mine }: { initial: string; mine: { trackingNumber: string; cropName: string; stage: string }[] }) {
  const router = useRouter();
  const [input, setInput] = useState(initial);
  const [no, setNo] = useState(initial);
  const [data, setData] = useState<Track | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (tn: string, quiet = false) => {
    if (!tn) return;
    if (!quiet) setLoading(true);
    try {
      const r = await fetch(`/api/tracking/${encodeURIComponent(tn)}`, { cache: "no-store" }).then((x) => x.json());
      if (!r.success) throw new Error(r.error);
      setData(r.data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      if (!quiet) setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(no);
    if (!no) return;
    const id = setInterval(() => load(no, true), 20_000);
    return () => clearInterval(id);
  }, [no, load]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const tn = input.trim().toUpperCase();
    setNo(tn);
    router.replace(`/tracking?no=${encodeURIComponent(tn)}`, { scroll: false });
  }

  return (
    <div>
      <PageHeader title="Shipment Tracking" urdu="ترسیل کی نگرانی" subtitle="Live GPS position, route and milestones for every MarketLink consignment" />
      <form onSubmit={submit} className="card flex flex-col gap-3 p-4 sm:flex-row">
        <input className="input flex-1 font-mono uppercase" placeholder="Tracking number, e.g. ML-2026-1001" value={input} onChange={(e) => setInput(e.target.value)} aria-label="Tracking number" />
        <button className="btn-primary px-6" disabled={loading || !input.trim()}>{loading && <Spinner />} Track</button>
      </form>
      {mine.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">Your active shipments:</span>
          {mine.map((m) => (
            <button key={m.trackingNumber} onClick={() => { setInput(m.trackingNumber); setNo(m.trackingNumber); router.replace(`/tracking?no=${m.trackingNumber}`, { scroll: false }); }}
              className={`rounded-full px-3 py-1 font-semibold ${no === m.trackingNumber ? "bg-brand-900 text-white" : "bg-white ring-1 ring-slate-200 dark:bg-white/5 dark:ring-white/10"}`}>
              {m.cropName} · {m.trackingNumber}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-6 rounded-2xl bg-rose-50 p-4 text-sm text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">{error}</p>}
      {!data && !error && !loading && <p className="mt-10 text-center text-sm text-slate-500">Enter a tracking number to see the shipment on the map.</p>}

      {data && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-5">
            <div className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs font-semibold text-slate-500">{data.trackingNumber}</p>
                  <p className="text-xl font-bold">{data.cropName} · {formatKg(data.quantityKg)}</p>
                  <p className="text-sm text-slate-500">{data.origin.city} → {data.destination.city} · ~{data.distanceKm} km by road</p>
                </div>
                <div className="text-right">
                  <span className={`badge ${data.stage === "delivered" ? "bg-emerald-100 text-emerald-800" : data.disputed ? "bg-rose-100 text-rose-800" : "bg-sky-100 text-sky-800"}`}>{data.stageLabel}</span>
                  <p className="mt-1 text-xs text-slate-500">Payment: {data.payment}</p>
                </div>
              </div>
              <div className="mt-5"><LogisticsStepper stage={data.stage} disputed={data.disputed} /></div>
            </div>
            <TrackingMap data={{ origin: data.origin, destination: data.destination, current: data.current, route: data.route, events: data.events, delivered: data.stage === "delivered" }} />
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div className="card p-3"><p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Progress</p><p className="text-lg font-bold">{data.current.progress}%</p></div>
              <div className="card p-3"><p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">ETA</p><p className="text-lg font-bold">{data.eta ? new Date(data.eta).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : data.stage === "delivered" ? "Delivered" : "—"}</p></div>
              <div className="card p-3"><p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Position</p><p className="text-lg font-bold">{data.current.source === "gps" ? "📡 Live GPS" : data.current.source === "simulated" ? "≈ Estimated" : "At farm"}</p></div>
            </div>
          </div>

          <aside className="card h-fit p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Timeline</h2>
              <span className="text-[11px] text-slate-500">Auto-refresh 20s</span>
            </div>
            {data.parties && <p className="mt-2 text-xs text-slate-500">{data.parties.farmer} → {data.parties.buyer}</p>}
            <ol className="relative mt-4 space-y-4 border-l border-slate-200 pl-6 dark:border-white/10">
              {[...data.events].reverse().map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[33px] grid h-6 w-6 place-items-center rounded-full bg-white text-xs ring-2 ring-slate-200 dark:bg-[#0d1f16] dark:ring-white/10">{ICON[e.stage] ?? "•"}</span>
                  <p className="text-sm font-semibold">{e.label}</p>
                  <p className="text-xs text-slate-500">{new Date(e.at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}{e.location ? ` · ${e.location}` : ""}</p>
                  {e.note && <p className="text-xs text-slate-600 dark:text-slate-400">{e.note}</p>}
                </li>
              ))}
            </ol>
          </aside>
        </div>
      )}
    </div>
  );
}
