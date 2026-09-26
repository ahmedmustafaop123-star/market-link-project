"use client";

import { useCallback, useEffect, useState } from "react";
import { api, Badge, Spinner } from "@/components/ui";
import { useToast } from "@/components/providers";
import { formatDate, formatPKR } from "@/lib/constants";

type Payout = { payoutId: number; amount: number; method: string; accountTitle: string; accountNumber: string; status: string; createdAt: string; farmerName: string; farmName: string | null; adminNote: string | null };

/** Admin queue for farmer withdrawal requests. */
export function PayoutsPanel() {
  const { push } = useToast();
  const [rows, setRows] = useState<Payout[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const load = useCallback(() => api<Payout[]>("/api/payouts").then(setRows).catch(() => setRows([])), []);
  useEffect(() => { load(); }, [load]);

  async function act(p: Payout, status: "paid" | "rejected") {
    const note = status === "rejected" ? prompt("Reason for rejection (sent to the farmer):") ?? undefined : undefined;
    if (status === "rejected" && !note) return;
    if (status === "paid" && !confirm(`Confirm you transferred ${formatPKR(p.amount)} to ${p.accountTitle} (${p.accountNumber})?`)) return;
    setBusy(p.payoutId);
    try {
      await api(`/api/payouts/${p.payoutId}`, { method: "PATCH", json: { status, note } });
      push({ kind: "success", title: status === "paid" ? "Marked as paid" : "Payout rejected, funds returned" });
      load();
    } catch (e) {
      push({ kind: "error", title: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const pending = rows?.filter((r) => r.status === "pending") ?? [];
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-white/5">
        <h2 className="font-bold">Farmer payout requests</h2>
        <span className="text-xs text-slate-500">{pending.length} pending</span>
      </div>
      {!rows ? <div className="h-24 animate-pulse" /> : rows.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">No payout requests yet.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head"><tr><th className="px-4 py-3">Farmer</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Destination</th><th className="px-4 py-3">Requested</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {rows.slice(0, 10).map((p) => (
                <tr key={p.payoutId}>
                  <td className="px-4 py-3"><p className="font-medium">{p.farmName ?? p.farmerName}</p><p className="text-xs text-slate-500">{p.farmerName}</p></td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatPKR(p.amount)}</td>
                  <td className="px-4 py-3"><p className="text-xs font-semibold uppercase">{p.method}</p><p className="font-mono text-xs text-slate-500">{p.accountTitle} · {p.accountNumber}</p></td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatDate(p.createdAt)}</td>
                  <td className="px-4 py-3"><Badge status={p.status === "paid" ? "released" : p.status === "rejected" ? "rejected" : "pending"} label={p.status} /></td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {p.status === "pending" && (
                      <div className="flex justify-end gap-1.5">
                        <button className="btn-primary px-3 py-1 text-xs" disabled={busy === p.payoutId} onClick={() => act(p, "paid")}>{busy === p.payoutId && <Spinner />} Mark paid</button>
                        <button className="btn-secondary px-3 py-1 text-xs text-rose-600" disabled={busy === p.payoutId} onClick={() => act(p, "rejected")}>Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
