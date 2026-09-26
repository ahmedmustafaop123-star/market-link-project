"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, Badge, compressImage, EmptyState, GradeBadge, LoadingBlock, Modal, PageHeader, Spinner } from "@/components/ui";
import { CityOptions } from "@/components/city-options";
import { useToast } from "@/components/providers";
import { CATEGORIES, CROP_CATALOGUE, perMaund, cropImage, formatDate, formatKg, formatPKR, todayISO, type Category, type Grade } from "@/lib/constants";

type Crop = {
  cropId: number; cropName: string; category: Category; qualityGrade: Grade; totalQuantityKg: number; basePricePerKg: number;
  harvestDate: string; imagesJson: string[]; status: string; farmLocation: string; description: string | null; openBids: number; highestBid: number | null; inspectionGrade: string | null;
};
type Rate = { marketLocation: string; minPricePerKg: number; maxPricePerKg: number; avgPricePerKg: number };

const GRADE_FACTOR: Record<Grade, number> = { A: 1.06, B: 1.0, C: 0.9 };
const empty = { cropName: "Wheat", category: "grains" as Category, qualityGrade: "A" as Grade, quantity: "", unit: "kg" as "kg" | "maund" | "tons", basePricePerKg: "", harvestDate: todayISO(), farmLocation: "Multan", description: "", imagesJson: [] as string[] };

export function ListingsClient({ openNew }: { openNew: boolean }) {
  const { push } = useToast();
  const [crops, setCrops] = useState<Crop[] | null>(null);
  const [open, setOpen] = useState(openNew);
  const [editing, setEditing] = useState<Crop | null>(null);
  const [form, setForm] = useState(empty);
  const [rates, setRates] = useState<Rate[]>([]);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");

  const load = useCallback(() => api<Crop[]>("/api/crops?mine=1").then(setCrops).catch((e) => push({ kind: "error", title: e.message })), [push]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!open) return;
    api<Rate[]>(`/api/mandi-rates?view=latest&crop=${encodeURIComponent(form.cropName)}`).then(setRates).catch(() => setRates([]));
  }, [form.cropName, open]);

  const suggestion = useMemo(() => {
    if (!rates.length) return null;
    const avg = rates.reduce((s, r) => s + r.avgPricePerKg, 0) / rates.length;
    const min = Math.min(...rates.map((r) => r.minPricePerKg));
    const max = Math.max(...rates.map((r) => r.maxPricePerKg));
    return { avg, min, max, recommended: Math.round(avg * GRADE_FACTOR[form.qualityGrade] * 100) / 100 };
  }, [rates, form.qualityGrade]);

  function startNew() { setEditing(null); setForm(empty); setOpen(true); }
  function startEdit(c: Crop) {
    setEditing(c);
    setForm({ cropName: c.cropName, category: c.category, qualityGrade: c.qualityGrade, quantity: String(c.totalQuantityKg), unit: "kg", basePricePerKg: String(c.basePricePerKg), harvestDate: c.harvestDate, farmLocation: c.farmLocation, description: c.description ?? "", imagesJson: c.imagesJson });
    setOpen(true);
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const room = 4 - form.imagesJson.length;
    const list = Array.from(files).slice(0, room);
    try {
      const imgs = await Promise.all(list.map((f) => compressImage(f)));
      setForm((f) => ({ ...f, imagesJson: [...f.imagesJson, ...imgs] }));
    } catch (e) {
      push({ kind: "error", title: (e as Error).message });
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const qtyKg = Number(form.quantity) * (form.unit === "tons" ? 1000 : form.unit === "maund" ? 40 : 1);
    const payload = { cropName: form.cropName, category: form.category, qualityGrade: form.qualityGrade, totalQuantityKg: qtyKg, basePricePerKg: Number(form.basePricePerKg), harvestDate: form.harvestDate, farmLocation: form.farmLocation, description: form.description, imagesJson: form.imagesJson };
    try {
      if (editing) {
        await api(`/api/crops/${editing.cropId}`, { method: "PATCH", json: payload });
        push({ kind: "success", title: "Listing updated" });
      } else {
        const c = await api<{ status: string }>("/api/crops", { method: "POST", json: payload });
        push({ kind: "success", title: "Listing published", body: c.status === "pending_inspection" ? "Held for quality inspection until your account is verified." : "Now visible to buyers in the marketplace." });
      }
      setOpen(false);
      load();
    } catch (err) {
      push({ kind: "error", title: "Could not save", body: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function remove(c: Crop) {
    if (!confirm(`Remove ${c.cropName} listing? Open bids will be rejected.`)) return;
    try {
      const r = await api<{ archived?: boolean }>(`/api/crops/${c.cropId}`, { method: "DELETE" });
      push({ kind: "success", title: r.archived ? "Listing archived (has order history)" : "Listing deleted" });
      load();
    } catch (err) {
      push({ kind: "error", title: (err as Error).message });
    }
  }

  const shown = (crops ?? []).filter((c) => filter === "all" || c.status === filter);

  return (
    <div>
      <PageHeader title="My Crop Listings" urdu="میری فصلیں" subtitle="Publish produce, manage stock and pricing" actions={<button className="btn-primary" onClick={startNew}>＋ New Listing</button>} />

      <div className="mb-4 flex flex-wrap gap-2">
        {["all", "active", "pending_inspection", "sold_out"].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize ${filter === s ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700"}`}>
            {s.replace("_", " ")} {crops && <span className="opacity-60">({s === "all" ? crops.length : crops.filter((c) => c.status === s).length})</span>}
          </button>
        ))}
      </div>

      {!crops ? <LoadingBlock /> : shown.length === 0 ? (
        <EmptyState icon="🌱" title="No listings here" body="Create your first listing to start receiving bids from verified buyers." action={<button className="btn-primary" onClick={startNew}>Create listing</button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((c) => (
            <article key={c.cropId} className="card overflow-hidden">
              <div className="relative h-40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cropImage(c.imagesJson, c.cropName, c.category)} alt={c.cropName} className="h-full w-full object-cover" />
                <div className="absolute top-3 left-3 flex gap-1.5"><GradeBadge grade={c.qualityGrade} />{c.inspectionGrade && <span className="badge bg-white/90 text-emerald-700">🔬 Inspected</span>}</div>
                <div className="absolute top-3 right-3"><Badge status={c.status} /></div>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{c.cropName}</h3>
                    <p className="text-xs text-slate-500">📍 {c.farmLocation} · Harvested {formatDate(c.harvestDate)}</p>
                  </div>
                  <div className="text-right"><p className="text-lg font-bold text-brand-700 dark:text-brand-400">{formatPKR(c.basePricePerKg, 2)}<span className="text-xs font-normal text-slate-500">/kg</span></p><p className="text-[11px] text-slate-500">{perMaund(c.basePricePerKg)}</p></div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2.5 text-center text-xs dark:bg-slate-800/60">
                  <div><p className="text-slate-500">Available</p><p className="font-semibold">{formatKg(c.totalQuantityKg)}</p></div>
                  <div><p className="text-slate-500">Open bids</p><p className="font-semibold">{c.openBids}</p></div>
                  <div><p className="text-slate-500">Top bid</p><p className="font-semibold">{c.highestBid ? formatPKR(c.highestBid, 1) : "—"}</p></div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button className="btn-secondary flex-1 py-1.5 text-xs" onClick={() => startEdit(c)}>✏️ Edit</button>
                  <button className="btn-secondary py-1.5 text-xs text-rose-600" onClick={() => remove(c)}>🗑</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Edit ${editing.cropName}` : "New crop listing"} wide>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Crop</label>
            <select className="input" value={form.cropName} onChange={(e) => { const c = CROP_CATALOGUE.find((x) => x.name === e.target.value); setForm({ ...form, cropName: e.target.value, category: c?.category ?? form.category }); }}>
              {CROP_CATALOGUE.map((c) => <option key={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Category })}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Quality grade</label>
            <div className="grid grid-cols-3 gap-2">
              {(["A", "B", "C"] as Grade[]).map((g) => (
                <button type="button" key={g} onClick={() => setForm({ ...form, qualityGrade: g })} className={`rounded-xl border-2 py-2 text-sm font-bold ${form.qualityGrade === g ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300" : "border-slate-200 dark:border-slate-700"}`}>{g}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Harvest date</label>
            <input type="date" className="input" max={todayISO()} value={form.harvestDate} onChange={(e) => setForm({ ...form, harvestDate: e.target.value })} required />
          </div>
          <div>
            <label className="label">Available quantity</label>
            <div className="flex gap-2">
              <input type="number" min="1" step="any" className="input" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required placeholder="e.g. 5000" />
              <select className="input w-28" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value as "kg" | "maund" | "tons" })}><option value="kg">Kg</option><option value="maund">Maund (40kg)</option><option value="tons">Tons</option></select>
            </div>
          </div>
          <div>
            <label className="label">Base price (Rs. / kg)</label>
            <input type="number" min="0.5" step="0.01" className="input" value={form.basePricePerKg} onChange={(e) => setForm({ ...form, basePricePerKg: e.target.value })} required />
            {form.basePricePerKg && <p className="mt-1 text-xs text-slate-500">= {perMaund(Number(form.basePricePerKg))}</p>}
          </div>
          {suggestion && (
            <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm sm:col-span-2 dark:border-brand-800 dark:bg-brand-950/30">
              <p className="font-semibold text-brand-800 dark:text-brand-300">📈 Live mandi insight for {form.cropName}</p>
              <p className="mt-1 text-brand-900/80 dark:text-brand-200/80">
                Today across {rates.length} mandis: {formatPKR(suggestion.min, 2)} – {formatPKR(suggestion.max, 2)} (avg {formatPKR(suggestion.avg, 2)}). Recommended for Grade {form.qualityGrade}: <b>{formatPKR(suggestion.recommended, 2)}/kg ({perMaund(suggestion.recommended)})</b>
                <button type="button" className="ml-2 font-semibold text-brand-700 underline dark:text-brand-300" onClick={() => setForm({ ...form, basePricePerKg: String(suggestion.recommended) })}>Use this</button>
              </p>
            </div>
          )}
          <div>
            <label className="label">Farm location</label>
            <select className="input" value={form.farmLocation} onChange={(e) => setForm({ ...form, farmLocation: e.target.value })}><CityOptions /></select>
          </div>
          <div>
            <label className="label">Crop photos (max 4)</label>
            <input type="file" accept="image/*" multiple className="input file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1 file:text-brand-700" onChange={(e) => onFiles(e.target.files)} disabled={form.imagesJson.length >= 4} />
          </div>
          {form.imagesJson.length > 0 && (
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              {form.imagesJson.map((src, i) => (
                <div key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-20 w-28 rounded-lg object-cover" />
                  <button type="button" className="absolute -top-2 -right-2 grid h-6 w-6 place-items-center rounded-full bg-rose-600 text-xs text-white" onClick={() => setForm({ ...form, imagesJson: form.imagesJson.filter((_, j) => j !== i) })}>✕</button>
                </div>
              ))}
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="label">Description</label>
            <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Variety, packing, moisture, pickup terms…" />
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={saving}>{saving && <Spinner />} {editing ? "Save changes" : "Publish listing"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
