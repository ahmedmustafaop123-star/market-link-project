"use client";

import { useCallback, useEffect, useState } from "react";
import { api, Badge, GradeBadge, LoadingBlock, Modal, PageHeader, Spinner } from "@/components/ui";
import { useToast } from "@/components/providers";
import { formatDate, formatKg, formatPKR } from "@/lib/constants";

type U = { id: number; fullName: string; email: string; phone: string; role: string; cnicId: string | null; businessName: string | null; city: string; address: string | null; isVerified: boolean; listings: number; orders: number; createdAt: string };
type Crop = { cropId: number; cropName: string; farmerName: string; farmLocation: string; qualityGrade: string; totalQuantityKg: number; basePricePerKg: number; status: string; harvestDate: string; inspectionGrade: string | null };
type Insp = { inspectionId: number; cropName: string; farmerName: string; farmLocation: string; inspectorName: string; gradeAssigned: string; moistureLevelPercentage: number; soilPh: number | null; inspectionNotes: string | null; reportAttachment: string | null; status: string; verifiedAt: string | null };

export default function VerificationPortal() {
  const { push } = useToast();
  const [tab, setTab] = useState<"farmers" | "inspections">("farmers");
  const [users, setUsers] = useState<U[] | null>(null);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [insps, setInsps] = useState<Insp[]>([]);
  const [target, setTarget] = useState<Crop | null>(null);
  const [form, setForm] = useState({ gradeAssigned: "A", moistureLevelPercentage: "12", soilPh: "7.2", inspectionNotes: "", status: "passed", reportAttachment: "" , fileName: "" });
  const [busy, setBusy] = useState<number | string | null>(null);

  const load = useCallback(async () => {
    try {
      const [u, c, i] = await Promise.all([api<U[]>("/api/admin/users?role=farmer"), api<Crop[]>("/api/crops"), api<Insp[]>("/api/inspections")]);
      setUsers(u); setCrops(c); setInsps(i);
    } catch (e) {
      push({ kind: "error", title: (e as Error).message });
    }
  }, [push]);
  useEffect(() => { load(); }, [load]);

  async function verify(u: U, v: boolean) {
    setBusy(u.id);
    try {
      const r = await api<{ listingsActivated: number }>(`/api/admin/users/${u.id}`, { method: "PATCH", json: { isVerified: v } });
      push({ kind: "success", title: v ? `${u.fullName} verified` : `${u.fullName} unverified`, body: r.listingsActivated ? `${r.listingsActivated} held listing(s) activated` : undefined });
      load();
    } catch (e) {
      push({ kind: "error", title: (e as Error).message });
    } finally { setBusy(null); }
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 1_400_000) return push({ kind: "error", title: "File too large (max 1.4MB)" });
    const r = new FileReader();
    r.onload = () => setForm((f) => ({ ...f, reportAttachment: r.result as string, fileName: file.name }));
    r.readAsDataURL(file);
  }

  async function submitInspection(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    setBusy("insp");
    try {
      await api("/api/inspections", {
        method: "POST",
        json: { cropId: target.cropId, gradeAssigned: form.gradeAssigned, moistureLevelPercentage: Number(form.moistureLevelPercentage), soilPh: form.soilPh ? Number(form.soilPh) : undefined, inspectionNotes: form.inspectionNotes, status: form.status, reportAttachment: form.reportAttachment || undefined },
      });
      push({ kind: "success", title: "Inspection report saved", body: form.status === "passed" ? "Listing activated with assigned grade." : form.status === "failed" ? "Listing archived; open bids rejected." : "Listing held for inspection." });
      setTarget(null);
      load();
    } catch (err) {
      push({ kind: "error", title: (err as Error).message });
    } finally { setBusy(null); }
  }

  if (!users) return <LoadingBlock />;
  const pendingCrops = crops.filter((c) => c.status === "pending_inspection");
  const otherCrops = crops.filter((c) => c.status !== "pending_inspection" && c.status !== "archived");

  return (
    <div>
      <PageHeader title="Verification Portal" subtitle="Farmer verification and crop inspections" />
      <div className="mb-5 flex gap-2">
        <button onClick={() => setTab("farmers")} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === "farmers" ? "bg-brand-600 text-white" : "bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"}`}>🧑‍🌾 Farmer accounts ({users.filter((u) => !u.isVerified).length} pending)</button>
        <button onClick={() => setTab("inspections")} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === "inspections" ? "bg-brand-600 text-white" : "bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"}`}>🔬 Crop inspections ({pendingCrops.length} pending)</button>
      </div>

      {tab === "farmers" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {users.map((u) => (
            <div key={u.id} className={`card p-5 ${!u.isVerified ? "ring-2 ring-amber-400/60" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{u.fullName}</p>
                  <p className="text-xs text-slate-500">{u.businessName ?? "—"}</p>
                </div>
                <Badge status={u.isVerified ? "accepted" : "pending"} label={u.isVerified ? "verified" : "unverified"} />
              </div>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-slate-500">CNIC</dt><dd className="font-mono">{u.cnicId ?? "Not provided"}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Phone</dt><dd>{u.phone}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Location</dt><dd>{u.city}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Listings / Orders</dt><dd>{u.listings} / {u.orders}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Joined</dt><dd>{formatDate(u.createdAt)}</dd></div>
              </dl>
              {u.address && <p className="mt-2 text-xs text-slate-500">📍 {u.address}</p>}
              <div className="mt-4">
                {u.isVerified ? (
                  <button className="btn-secondary w-full text-rose-600" disabled={busy === u.id} onClick={() => verify(u, false)}>Revoke verification</button>
                ) : (
                  <button className="btn-primary w-full" disabled={busy === u.id} onClick={() => verify(u, true)}>{busy === u.id && <Spinner />} ✔ Verify farmer</button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="card overflow-hidden">
            <h2 className="border-b border-slate-200 px-5 py-3.5 font-semibold dark:border-slate-800">Listings awaiting inspection</h2>
            <CropTable rows={pendingCrops} onInspect={(c) => { setTarget(c); setForm({ ...form, gradeAssigned: c.qualityGrade, inspectionNotes: "", reportAttachment: "", fileName: "" }); }} empty="No listings pending inspection 🎉" />
          </div>
          <details className="card overflow-hidden">
            <summary className="cursor-pointer px-5 py-3.5 font-semibold">Re-inspect an active listing ({otherCrops.length})</summary>
            <CropTable rows={otherCrops} onInspect={(c) => { setTarget(c); setForm({ ...form, gradeAssigned: c.qualityGrade, inspectionNotes: "", reportAttachment: "", fileName: "" }); }} empty="None" />
          </details>
          <div className="card overflow-hidden">
            <h2 className="border-b border-slate-200 px-5 py-3.5 font-semibold dark:border-slate-800">Inspection reports log</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="table-head"><tr><th className="px-4 py-2.5">#</th><th className="px-4 py-2.5">Crop / Farmer</th><th className="px-4 py-2.5">Grade</th><th className="px-4 py-2.5">Moisture</th><th className="px-4 py-2.5">Soil pH</th><th className="px-4 py-2.5">Notes</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Report</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {insps.map((i) => (
                    <tr key={i.inspectionId}>
                      <td className="px-4 py-3 text-slate-500">{i.inspectionId}</td>
                      <td className="px-4 py-3"><p className="font-medium">{i.cropName}</p><p className="text-xs text-slate-500">{i.farmerName} · {i.farmLocation}</p></td>
                      <td className="px-4 py-3"><GradeBadge grade={i.gradeAssigned} /></td>
                      <td className="px-4 py-3">{i.moistureLevelPercentage}%</td>
                      <td className="px-4 py-3">{i.soilPh ?? "—"}</td>
                      <td className="max-w-xs px-4 py-3 text-xs text-slate-600 dark:text-slate-400">{i.inspectionNotes}</td>
                      <td className="px-4 py-3"><Badge status={i.status} /><p className="mt-1 text-[11px] text-slate-500">{i.verifiedAt ? formatDate(i.verifiedAt) : ""}</p></td>
                      <td className="px-4 py-3">{i.reportAttachment ? <a className="font-semibold text-brand-600 hover:underline" href={`/api/inspections/${i.inspectionId}/report`} target="_blank" rel="noreferrer">📄 View</a> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <Modal open={!!target} onClose={() => setTarget(null)} title={target ? `Inspection report · ${target.cropName} (${target.farmerName})` : ""}>
        {target && (
          <form onSubmit={submitInspection} className="grid grid-cols-2 gap-3">
            <div><label className="label">Grade assigned</label><select className="input" value={form.gradeAssigned} onChange={(e) => setForm({ ...form, gradeAssigned: e.target.value })}><option>A</option><option>B</option><option>C</option></select></div>
            <div><label className="label">Result</label><select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="passed">✅ Passed</option><option value="pending">⏳ Pending lab</option><option value="failed">❌ Failed</option></select></div>
            <div><label className="label">Moisture %</label><input type="number" step="0.1" min="0" max="100" className="input" value={form.moistureLevelPercentage} onChange={(e) => setForm({ ...form, moistureLevelPercentage: e.target.value })} required /></div>
            <div><label className="label">Soil pH</label><input type="number" step="0.1" min="0" max="14" className="input" value={form.soilPh} onChange={(e) => setForm({ ...form, soilPh: e.target.value })} /></div>
            <div className="col-span-2"><label className="label">Inspection notes</label><textarea rows={3} className="input" value={form.inspectionNotes} onChange={(e) => setForm({ ...form, inspectionNotes: e.target.value })} placeholder="Foreign matter %, pest damage, grain size, colour…" /></div>
            <div className="col-span-2">
              <label className="label">Soil / crop lab report (PDF or image)</label>
              <input type="file" accept="application/pdf,image/*" className="input" onChange={(e) => onFile(e.target.files?.[0])} />
              {form.fileName && <p className="mt-1 text-xs text-brand-600">📎 {form.fileName}</p>}
            </div>
            <div className="col-span-2 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setTarget(null)}>Cancel</button>
              <button className="btn-primary" disabled={busy === "insp"}>{busy === "insp" && <Spinner />} Save report</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

function CropTable({ rows, onInspect, empty }: { rows: Crop[]; onInspect: (c: Crop) => void; empty: string }) {
  if (!rows.length) return <p className="p-8 text-center text-sm text-slate-500">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="table-head"><tr><th className="px-4 py-2.5">Crop</th><th className="px-4 py-2.5">Farmer</th><th className="px-4 py-2.5">Declared grade</th><th className="px-4 py-2.5">Qty</th><th className="px-4 py-2.5">Price</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5"></th></tr></thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((c) => (
            <tr key={c.cropId}>
              <td className="px-4 py-3 font-medium">{c.cropName}<p className="text-xs text-slate-500">Harvest {formatDate(c.harvestDate)}</p></td>
              <td className="px-4 py-3">{c.farmerName}<p className="text-xs text-slate-500">{c.farmLocation}</p></td>
              <td className="px-4 py-3"><GradeBadge grade={c.qualityGrade} /></td>
              <td className="px-4 py-3">{formatKg(c.totalQuantityKg)}</td>
              <td className="px-4 py-3">{formatPKR(c.basePricePerKg, 2)}</td>
              <td className="px-4 py-3"><Badge status={c.status} /></td>
              <td className="px-4 py-3 text-right"><button className="btn-primary py-1.5 text-xs" onClick={() => onInspect(c)}>🔬 Inspect</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
