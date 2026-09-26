"use client";

import { useCallback, useEffect, useState } from "react";
import { api, Badge, GradeBadge, Modal, PageHeader, Spinner, StatCard } from "@/components/ui";
import { useToast } from "@/components/providers";
import { formatDate, formatKg } from "@/lib/constants";

type Crop = { cropId: number; cropName: string; farmerName: string; farmName: string | null; farmLocation: string; qualityGrade: string; totalQuantityKg: number; status: string; harvestDate: string; inspectionGrade: string | null };
type Order = { orderId: number; trackingNumber: string; cropName: string; quantityKg: number; qualityGrade: string; farmLocation: string; farmName: string | null; farmerName: string; buyerBusiness: string | null; buyerName: string; paymentStatus: string; deliveryStage: string; createdAt: string };
type Insp = { inspectionId: number; cropName: string; farmerName: string; farmLocation: string; inspectorName: string; gradeAssigned: string; moistureLevelPercentage: number; soilPh: number | null; inspectionNotes: string | null; reportAttachment: string | null; status: string; verifiedAt: string | null; certificateNo?: string | null };
type Target = { kind: "listing"; crop: Crop } | { kind: "order"; order: Order };

export default function InspectorDashboard() {
  const { push } = useToast();
  const [crops, setCrops] = useState<Crop[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reports, setReports] = useState<Insp[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<Target | null>(null);
  const [f, setF] = useState({ grade: "A", moisture: "12", ph: "7.2", notes: "", status: "passed", file: "", fileName: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, o, r] = await Promise.all([api<Crop[]>("/api/crops"), api<Order[]>("/api/orders?active=1"), api<Insp[]>("/api/inspections")]);
      setCrops(c.filter((x) => x.status === "pending_inspection"));
      setOrders(o.filter((x) => x.paymentStatus === "escrow_locked" && x.deliveryStage === "confirmed"));
      setReports(r);
    } catch (e) {
      push({ kind: "error", title: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [push]);
  useEffect(() => { load(); }, [load]);

  function open(t: Target) {
    setTarget(t);
    setF({ grade: t.kind === "listing" ? t.crop.qualityGrade : t.order.qualityGrade, moisture: "12", ph: "7.2", notes: "", status: "passed", file: "", fileName: "" });
  }
  function onFile(file?: File) {
    if (!file) return;
    if (!["application/pdf", "image/png", "image/jpeg"].includes(file.type)) return push({ kind: "error", title: "Upload a PDF, PNG or JPG lab report" });
    if (file.size > 1_400_000) return push({ kind: "error", title: "File too large (max 1.4 MB)" });
    const r = new FileReader();
    r.onload = () => setF((x) => ({ ...x, file: r.result as string, fileName: file.name }));
    r.readAsDataURL(file);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    setBusy(true);
    try {
      if (target.kind === "listing") {
        await api("/api/inspections", { method: "POST", json: { cropId: target.crop.cropId, gradeAssigned: f.grade, moistureLevelPercentage: Number(f.moisture), soilPh: f.ph ? Number(f.ph) : undefined, inspectionNotes: f.notes, status: f.status, reportAttachment: f.file || undefined, reportFileName: f.fileName || undefined } });
        push({ kind: "success", title: f.status === "passed" ? "Certified: listing is now live" : f.status === "failed" ? "Listing rejected" : "Saved as pending lab result" });
      } else {
        await api(`/api/orders/${target.order.orderId}`, { method: "PATCH", json: { action: "advance", grade: f.grade, moisture: Number(f.moisture), note: f.notes || `Pre-dispatch inspection · pH ${f.ph}` } });
        push({ kind: "success", title: "Order certified for dispatch", body: "Farmer and buyer have been notified." });
      }
      setTarget(null);
      load();
    } catch (err) {
      push({ kind: "error", title: "Could not save", body: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const passed = reports.filter((r) => r.status === "passed").length;
  return (
    <div className="space-y-6">
      <PageHeader title="Quality Inspection Desk" urdu="معائنہ ڈیسک" subtitle="Lab tests, grade certification and pre-dispatch checks" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Orders awaiting QC" value={loading ? "—" : orders.length} sub="Escrow funded, ready to inspect" icon="📦" tone="amber" />
        <StatCard label="Listings to certify" value={loading ? "—" : crops.length} sub="New / unverified sellers" icon="🌾" />
        <StatCard label="Reports filed" value={reports.length} sub={`${passed} passed`} icon="🧪" tone="violet" />
        <StatCard label="Pass rate" value={reports.length ? `${Math.round((passed / reports.length) * 100)}%` : "—"} sub="All inspections" icon="✅" tone="sky" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <h2 className="border-b border-slate-100 px-5 py-3.5 font-bold dark:border-white/5">Pre-dispatch inspections</h2>
          {orders.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">{loading ? "Loading…" : "No orders waiting for inspection 🎉"}</p> : (
            <ul className="divide-y divide-slate-100 dark:divide-white/5">
              {orders.map((o) => (
                <li key={o.orderId} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{o.cropName} · {formatKg(o.quantityKg)} <span className="font-mono text-xs font-normal text-slate-500">{o.trackingNumber}</span></p>
                    <p className="truncate text-xs text-slate-500">{o.farmName ?? o.farmerName} ({o.farmLocation}) → {o.buyerBusiness ?? o.buyerName}</p>
                  </div>
                  <GradeBadge grade={o.qualityGrade} />
                  <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => open({ kind: "order", order: o })}>🔬 Inspect</button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card overflow-hidden">
          <h2 className="border-b border-slate-100 px-5 py-3.5 font-bold dark:border-white/5">Listing certification</h2>
          {crops.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">{loading ? "Loading…" : "No listings pending certification"}</p> : (
            <ul className="divide-y divide-slate-100 dark:divide-white/5">
              {crops.map((c) => (
                <li key={c.cropId} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{c.cropName} · {formatKg(c.totalQuantityKg)}</p>
                    <p className="truncate text-xs text-slate-500">{c.farmName ?? c.farmerName} · {c.farmLocation} · harvested {formatDate(c.harvestDate)}</p>
                  </div>
                  <GradeBadge grade={c.qualityGrade} />
                  <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => open({ kind: "listing", crop: c })}>🧪 Lab test</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card overflow-hidden">
        <h2 className="border-b border-slate-100 px-5 py-3.5 font-bold dark:border-white/5">Inspection reports</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head"><tr><th className="px-4 py-3">Crop / farmer</th><th className="px-4 py-3">Grade</th><th className="px-4 py-3">Moisture</th><th className="px-4 py-3">Soil pH</th><th className="px-4 py-3">Result</th><th className="px-4 py-3">Inspector</th><th className="px-4 py-3">Report</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {reports.map((r) => (
                <tr key={r.inspectionId}>
                  <td className="px-4 py-3"><p className="font-medium">{r.cropName}</p><p className="text-xs text-slate-500">{r.farmerName} · {r.farmLocation}</p></td>
                  <td className="px-4 py-3"><GradeBadge grade={r.gradeAssigned} /></td>
                  <td className="px-4 py-3 tabular-nums">{r.moistureLevelPercentage}%</td>
                  <td className="px-4 py-3 tabular-nums">{r.soilPh ?? "—"}</td>
                  <td className="px-4 py-3"><Badge status={r.status} /><p className="mt-1 text-[11px] text-slate-500">{r.verifiedAt ? formatDate(r.verifiedAt) : ""}</p></td>
                  <td className="px-4 py-3 text-xs text-slate-500">{r.inspectorName}</td>
                  <td className="px-4 py-3">{r.reportAttachment ? <a href={`/api/inspections/${r.inspectionId}/report`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-400">📄 Open</a> : <span className="text-xs text-slate-400">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal open={!!target} onClose={() => setTarget(null)} title={target ? (target.kind === "order" ? `Pre-dispatch QC · ${target.order.trackingNumber}` : `Lab certification · ${target.crop.cropName}`) : ""}>
        {target && (
          <form onSubmit={submit} className="grid grid-cols-2 gap-3">
            <div><label className="label">Grade certification</label><select className="input" value={f.grade} onChange={(e) => setF({ ...f, grade: e.target.value })}><option value="A">A · Premium / export</option><option value="B">B · Standard</option><option value="C">C · Processing</option></select></div>
            {target.kind === "listing" ? (
              <div><label className="label">Result</label><select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="passed">✅ Passed</option><option value="pending">⏳ Awaiting lab</option><option value="failed">❌ Failed</option></select></div>
            ) : <div><label className="label">Result</label><input className="input" value="✅ Passed → release for dispatch" readOnly /></div>}
            <div><label className="label">Moisture %</label><input type="number" step="0.1" min="0" max="100" className="input" value={f.moisture} onChange={(e) => setF({ ...f, moisture: e.target.value })} required /></div>
            <div><label className="label">Soil pH</label><input type="number" step="0.1" min="0" max="14" className="input" value={f.ph} onChange={(e) => setF({ ...f, ph: e.target.value })} /></div>
            <div className="col-span-2"><label className="label">Lab notes</label><textarea rows={3} className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Foreign matter %, broken grains, pest damage, colour, brix…" /></div>
            {target.kind === "listing" && (
              <div className="col-span-2">
                <label className="label">Lab report (PDF)</label>
                <input type="file" accept="application/pdf,image/png,image/jpeg" className="input" onChange={(e) => onFile(e.target.files?.[0])} />
                {f.fileName && <p className="mt-1 text-xs text-brand-700">📎 {f.fileName}</p>}
              </div>
            )}
            <div className="col-span-2 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setTarget(null)}>Cancel</button>
              <button className="btn-primary" disabled={busy}>{busy && <Spinner />} {target.kind === "order" ? "Certify & release" : "Save report"}</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
