"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, LoadingBlock, PageHeader, Spinner } from "@/components/ui";
import { useToast } from "@/components/providers";
import { CROP_CATALOGUE, MANDIS, MANDI_MARKETS, formatPKR, mandiName, todayISO } from "@/lib/constants";

type Latest = { rateId: number; cropName: string; marketLocation: string; minPricePerKg: number; maxPricePerKg: number; avgPricePerKg: number; changePct: number | null; source: string; dateUpdated: string };

export default function MandiController() {
  const { push } = useToast();
  const [rows, setRows] = useState<Latest[] | null>(null);
  const [crop, setCrop] = useState("");
  const [form, setForm] = useState({ cropName: "Wheat", marketLocation: "Lahore", minPricePerKg: "", maxPricePerKg: "", avgPricePerKg: "", dateUpdated: todayISO() });
  const [busy, setBusy] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const load = useCallback(() => api<Latest[]>("/api/mandi-rates?view=latest").then(setRows).catch((e) => push({ kind: "error", title: e.message })), [push]);
  useEffect(() => { load(); }, [load]);

  function prefill(r: Latest) {
    setForm({ cropName: r.cropName, marketLocation: r.marketLocation, minPricePerKg: String(r.minPricePerKg), maxPricePerKg: String(r.maxPricePerKg), avgPricePerKg: String(r.avgPricePerKg), dateUpdated: todayISO() });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save");
    try {
      await api("/api/mandi-rates", {
        method: "POST",
        json: { cropName: form.cropName, marketLocation: form.marketLocation, minPricePerKg: Number(form.minPricePerKg), maxPricePerKg: Number(form.maxPricePerKg), avgPricePerKg: form.avgPricePerKg ? Number(form.avgPricePerKg) : undefined, dateUpdated: form.dateUpdated },
      });
      push({ kind: "success", title: "Rate published", body: `${form.cropName} @ ${form.marketLocation}` });
      load();
    } catch (err) {
      push({ kind: "error", title: (err as Error).message });
    } finally { setBusy(null); }
  }

  async function sync() {
    setBusy("sync");
    try {
      const r = await api<{ updated: number; date: string; syncedAt: string }>("/api/mandi-rates/sync", { method: "POST" });
      setLastSync(new Date(r.syncedAt).toLocaleTimeString());
      push({ kind: "success", title: "Mock feed synced", body: `${r.updated} rates updated for ${r.date}` });
      load();
    } catch (err) {
      push({ kind: "error", title: (err as Error).message });
    } finally { setBusy(null); }
  }

  const shown = useMemo(() => (rows ?? []).filter((r) => !crop || r.cropName === crop), [rows, crop]);

  return (
    <div className="space-y-6">
      <PageHeader title="Mandi Price Controller" subtitle="Publish and sync daily mandi rates" />

      <div className="grid gap-4 lg:grid-cols-3">
        <form onSubmit={save} className="card grid grid-cols-2 gap-3 p-5 lg:col-span-2">
          <h2 className="col-span-2 font-semibold">✍️ Manual rate entry</h2>
          <div><label className="label">Crop</label><select className="input" value={form.cropName} onChange={(e) => setForm({ ...form, cropName: e.target.value })}>{CROP_CATALOGUE.map((c) => <option key={c.name}>{c.name}</option>)}</select></div>
          <div><label className="label">Mandi</label><select className="input" value={form.marketLocation} onChange={(e) => setForm({ ...form, marketLocation: e.target.value })}>{MANDIS.map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}</select></div>
          <div><label className="label">Min Rs./kg</label><input type="number" step="0.01" className="input" value={form.minPricePerKg} onChange={(e) => setForm({ ...form, minPricePerKg: e.target.value })} required /></div>
          <div><label className="label">Max Rs./kg</label><input type="number" step="0.01" className="input" value={form.maxPricePerKg} onChange={(e) => setForm({ ...form, maxPricePerKg: e.target.value })} required /></div>
          <div><label className="label">Avg Rs./kg (optional)</label><input type="number" step="0.01" className="input" value={form.avgPricePerKg} onChange={(e) => setForm({ ...form, avgPricePerKg: e.target.value })} placeholder="auto = (min+max)/2" /></div>
          <div><label className="label">Date</label><input type="date" max={todayISO()} className="input" value={form.dateUpdated} onChange={(e) => setForm({ ...form, dateUpdated: e.target.value })} /></div>
          <div className="col-span-2 flex justify-end"><button className="btn-primary" disabled={busy === "save"}>{busy === "save" && <Spinner />} Publish rate</button></div>
        </form>
        <div className="card flex flex-col p-5">
          <h2 className="font-semibold">🔄 Market feed sync</h2>
          <p className="mt-2 flex-1 text-sm text-slate-600 dark:text-slate-400">
            Pull today&apos;s rates for every crop and mandi from the connected market feed. Existing entries for today are updated.
          </p>
          {lastSync && <p className="mt-2 text-xs text-brand-600">Last synced at {lastSync}</p>}
          <button className="btn-amber mt-4" onClick={sync} disabled={busy === "sync"}>{busy === "sync" ? <Spinner /> : "⚡"} Sync {CROP_CATALOGUE.length * MANDI_MARKETS.length} rates now</button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <h2 className="font-semibold">Latest published rates</h2>
          <select className="input w-44" value={crop} onChange={(e) => setCrop(e.target.value)}><option value="">All crops</option>{CROP_CATALOGUE.map((c) => <option key={c.name}>{c.name}</option>)}</select>
        </div>
        {!rows ? <div className="p-5"><LoadingBlock /></div> : (
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="table-head sticky top-0"><tr><th className="px-4 py-2.5">Crop</th><th className="px-4 py-2.5">Mandi</th><th className="px-4 py-2.5">Min</th><th className="px-4 py-2.5">Max</th><th className="px-4 py-2.5">Avg</th><th className="px-4 py-2.5">/maund</th><th className="px-4 py-2.5">Δ</th><th className="px-4 py-2.5">Source</th><th className="px-4 py-2.5">Date</th><th className="px-4 py-2.5"></th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {shown.map((r) => (
                  <tr key={r.rateId}>
                    <td className="px-4 py-2.5 font-medium">{r.cropName}</td>
                    <td className="px-4 py-2.5">{mandiName(r.marketLocation)}</td>
                    <td className="px-4 py-2.5">{formatPKR(r.minPricePerKg, 2)}</td>
                    <td className="px-4 py-2.5">{formatPKR(r.maxPricePerKg, 2)}</td>
                    <td className="px-4 py-2.5 font-bold">{formatPKR(r.avgPricePerKg, 2)}</td><td className="px-4 py-2.5">{formatPKR(r.avgPricePerKg * 40)}</td>
                    <td className={`px-4 py-2.5 text-xs font-semibold ${r.changePct === null ? "" : r.changePct >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{r.changePct === null ? "—" : `${r.changePct >= 0 ? "+" : ""}${r.changePct.toFixed(2)}%`}</td>
                    <td className="px-4 py-2.5"><span className="badge bg-slate-100 dark:bg-slate-800">{r.source}</span></td>
                    <td className="px-4 py-2.5 text-slate-500">{r.dateUpdated}</td>
                    <td className="px-4 py-2.5 text-right"><button className="text-xs font-semibold text-brand-600 hover:underline" onClick={() => prefill(r)}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
