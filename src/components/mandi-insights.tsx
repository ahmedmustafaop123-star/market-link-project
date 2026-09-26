"use client";

import { useEffect, useMemo, useState } from "react";
import { api, LoadingBlock, PageHeader } from "@/components/ui";
import { CompareBarChart, MultiLineChart } from "@/components/charts";
import { useToast } from "@/components/providers";
import { CITIES, CROP_CATALOGUE, MANDIS, MANDI_MARKETS, PROVINCES, formatPKR, mandiName, cropUrdu } from "@/lib/constants";

type Latest = { rateId: number; cropName: string; marketLocation: string; minPricePerKg: number; maxPricePerKg: number; avgPricePerKg: number; changePct: number | null; source: string; dateUpdated: string };
type Compare = { cropName: string; mandiAvg: number; platformAsk: number | null; platformDeal: number | null; supplyKg: number; farmerGainPct: number | null };
type Trend = { markets: string[]; series: Record<string, number | string>[] };

export function MandiInsights() {
  const { push } = useToast();
  const [crop, setCrop] = useState("Wheat");
  const [days, setDays] = useState(14);
  const [market, setMarket] = useState("");
  const [province, setProvince] = useState("");
  const [latest, setLatest] = useState<Latest[] | null>(null);
  const [compare, setCompare] = useState<Compare[]>([]);
  const [trend, setTrend] = useState<Trend | null>(null);

  useEffect(() => {
    Promise.all([api<Latest[]>("/api/mandi-rates?view=latest"), api<Compare[]>("/api/mandi-rates?view=compare")])
      .then(([l, c]) => { setLatest(l); setCompare(c); })
      .catch((e) => push({ kind: "error", title: e.message }));
  }, [push]);

  useEffect(() => {
    api<Trend>(`/api/mandi-rates?view=trend&crop=${encodeURIComponent(crop)}&days=${days}`).then(setTrend).catch(() => {});
  }, [crop, days]);

  const board = useMemo(() => (latest ?? []).filter((r) => (!market || r.marketLocation === market) && (!province || CITIES[r.marketLocation]?.province === province) && r.cropName === crop), [latest, market, province, crop]);
  const movers = useMemo(() => {
    const byCrop: Record<string, number[]> = {};
    (latest ?? []).forEach((r) => r.changePct !== null && (byCrop[r.cropName] = [...(byCrop[r.cropName] ?? []), r.changePct]));
    return Object.entries(byCrop).map(([c, v]) => ({ crop: c, change: v.reduce((a, b) => a + b, 0) / v.length })).sort((a, b) => b.change - a.change);
  }, [latest]);
  const lastUpdated = latest?.[0]?.dateUpdated;

  if (!latest) return <LoadingBlock />;
  return (
    <div className="space-y-6">
      <PageHeader title="Live Mandi Insights" urdu="منڈی ریٹس" subtitle={`Daily wholesale rates from ${MANDI_MARKETS.length} Pakistani mandis (Badami Bagh, Multan, Karachi, Quetta…) · last updated ${lastUpdated ?? "—"} PKT`} />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {movers.map((m) => (
          <button key={m.crop} onClick={() => setCrop(m.crop)} className={`card shrink-0 px-4 py-2.5 text-left ${crop === m.crop ? "ring-2 ring-brand-500" : ""}`}>
            <p className="text-xs font-semibold text-slate-500">{m.crop}</p>
            <p className={`text-sm font-bold ${m.change >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{m.change >= 0 ? "▲" : "▼"} {Math.abs(m.change).toFixed(2)}%</p>
          </button>
        ))}
      </div>

      <div className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">{crop} <span className="font-normal text-slate-500">{cropUrdu(crop)}</span> — avg price by mandi</h2>
            <p className="text-xs text-slate-500">PKR per kg, daily average (× 40 for per-maund rate)</p>
          </div>
          <div className="flex gap-2">
            <select className="input w-40" value={crop} onChange={(e) => setCrop(e.target.value)}>{CROP_CATALOGUE.map((c) => <option key={c.name}>{c.name}</option>)}</select>
            <select className="input w-28" value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option></select>
          </div>
        </div>
        {trend ? <MultiLineChart data={trend.series} keys={trend.markets} /> : <div className="h-[300px] animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="card p-5 lg:col-span-3">
          <h2 className="font-semibold">Government mandi rate vs MarketLink platform rate</h2>
          <p className="mb-3 text-xs text-slate-500">Mandi avg (latest) vs active listing ask vs realised platform deal price (90d)</p>
          <CompareBarChart data={compare} />
        </div>
        <div className="card overflow-hidden lg:col-span-2">
          <h2 className="border-b border-slate-200 px-5 py-3.5 font-semibold dark:border-slate-800">Farmer price advantage</h2>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {compare.map((c) => (
              <li key={c.cropName} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span className="font-medium">{c.cropName}</span>
                <span className="text-slate-500">{formatPKR(c.mandiAvg * 40)} → {c.platformDeal ? formatPKR(c.platformDeal * 40) : "—"} /maund</span>
                <span className={`w-16 text-right font-bold ${c.farmerGainPct === null ? "text-slate-400" : c.farmerGainPct >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {c.farmerGainPct === null ? "—" : `${c.farmerGainPct >= 0 ? "+" : ""}${c.farmerGainPct.toFixed(1)}%`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <h2 className="font-semibold">Today&apos;s rate board · {crop}</h2>
          <select className="input w-40" value={province} onChange={(e) => { setProvince(e.target.value); setMarket(""); }} aria-label="Province"><option value="">All provinces</option>{PROVINCES.filter((p) => MANDIS.some((m) => CITIES[m.key]?.province === p)).map((p) => <option key={p}>{p}</option>)}</select>
          <select className="input w-44" value={market} onChange={(e) => setMarket(e.target.value)}><option value="">All mandis</option>{MANDIS.filter((m) => !province || CITIES[m.key]?.province === province).map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}</select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head"><tr><th className="px-5 py-2.5">Mandi</th><th className="px-5 py-2.5">Min</th><th className="px-5 py-2.5">Max</th><th className="px-5 py-2.5">Average /kg</th><th className="px-5 py-2.5">Per maund (40kg)</th><th className="px-5 py-2.5">Day change</th><th className="px-5 py-2.5">Source</th><th className="px-5 py-2.5">Date</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {board.map((r) => (
                <tr key={r.rateId}>
                  <td className="px-5 py-3 font-medium">{mandiName(r.marketLocation)}</td>
                  <td className="px-5 py-3">{formatPKR(r.minPricePerKg, 2)}</td>
                  <td className="px-5 py-3">{formatPKR(r.maxPricePerKg, 2)}</td>
                  <td className="px-5 py-3 font-bold">{formatPKR(r.avgPricePerKg, 2)}</td>
                  <td className="px-5 py-3 font-bold text-brand-700 dark:text-brand-400">{formatPKR(r.avgPricePerKg * 40)}</td>
                  <td className={`px-5 py-3 font-semibold ${r.changePct === null ? "" : r.changePct >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{r.changePct === null ? "—" : `${r.changePct >= 0 ? "▲" : "▼"} ${Math.abs(r.changePct).toFixed(2)}%`}</td>
                  <td className="px-5 py-3"><span className={`badge ${r.source === "feed" ? "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>{r.source}</span></td>
                  <td className="px-5 py-3 text-slate-500">{r.dateUpdated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
