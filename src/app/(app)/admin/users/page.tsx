"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, Badge, LoadingBlock, Modal, PageHeader, Spinner, StatCard } from "@/components/ui";
import { CityOptions } from "@/components/city-options";
import { useToast } from "@/components/providers";
import { formatDate, formatPKRShort } from "@/lib/constants";

type U = { id: number; fullName: string; email: string; phone: string; role: "farmer" | "buyer" | "admin" | "inspector"; cnicId: string | null; businessName: string | null; city: string; isVerified: boolean; walletBalance: number; listings: number; orders: number; createdAt: string };

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-brand-900 text-white",
  farmer: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  buyer: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  inspector: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300",
};
const emptyNew = { fullName: "", email: "", password: "", phone: "", role: "admin" as U["role"], city: "Lahore", cnicId: "", businessName: "" };

export default function AdminUsersPage() {
  const { push } = useToast();
  const [users, setUsers] = useState<U[] | null>(null);
  const [role, setRole] = useState<"" | U["role"]>("");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [nu, setNu] = useState(emptyNew);
  const [resetFor, setResetFor] = useState<U | null>(null);
  const [newPw, setNewPw] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => api<U[]>("/api/admin/users").then(setUsers).catch((e) => push({ kind: "error", title: e.message })), [push]);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(
    () => (users ?? []).filter((u) => (!role || u.role === role) && (!q || `${u.fullName} ${u.email} ${u.city} ${u.businessName ?? ""}`.toLowerCase().includes(q.toLowerCase()))),
    [users, role, q],
  );

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy("create");
    try {
      await api("/api/admin/users", { method: "POST", json: { ...nu, cnicId: nu.cnicId || undefined, businessName: nu.businessName || undefined } });
      push({ kind: "success", title: `${nu.role === "admin" ? "Admin" : "User"} account created`, body: `${nu.email} can now sign in.` });
      setCreating(false);
      setNu(emptyNew);
      load();
    } catch (err) {
      push({ kind: "error", title: "Could not create account", body: (err as Error).message });
    } finally { setBusy(null); }
  }

  async function patch(u: U, json: Record<string, unknown>, ok: string) {
    setBusy(`u${u.id}`);
    try {
      await api(`/api/admin/users/${u.id}`, { method: "PATCH", json });
      push({ kind: "success", title: ok });
      load();
      return true;
    } catch (err) {
      push({ kind: "error", title: (err as Error).message });
      return false;
    } finally { setBusy(null); }
  }

  function genPassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$";
    return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  }

  if (!users) return <LoadingBlock />;
  const count = (r: string) => users.filter((u) => u.role === r).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Users & Access" urdu="صارفین" subtitle="Accounts, roles and passwords" actions={<button className="btn-primary" onClick={() => { setNu({ ...emptyNew, password: genPassword() }); setCreating(true); }}>＋ New account</button>} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Total accounts" value={users.length} icon="👥" />
        <StatCard label="Admins / inspectors" value={`${count("admin")} / ${count("inspector")}`} icon="🛡️" tone="violet" />
        <StatCard label="Farmers" value={count("farmer")} sub={`${users.filter((u) => u.role === "farmer" && !u.isVerified).length} unverified`} icon="🧑‍🌾" tone="amber" />
        <StatCard label="Buyers" value={count("buyer")} icon="🏢" tone="sky" />
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4 dark:border-white/5">
          <input className="input max-w-xs" placeholder="🔍 Search name, email, city…" value={q} onChange={(e) => setQ(e.target.value)} />
          {(["", "admin", "inspector", "farmer", "buyer"] as const).map((r) => (
            <button key={r || "all"} onClick={() => setRole(r)} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize ${role === r ? "bg-brand-900 text-white" : "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300"}`}>{r || "all"}</button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head"><tr><th className="px-4 py-2.5">User</th><th className="px-4 py-2.5">Role</th><th className="px-4 py-2.5">City</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Activity</th><th className="px-4 py-2.5">Joined</th><th className="px-4 py-2.5 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {shown.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3"><p className="font-semibold">{u.fullName}</p><p className="text-xs text-slate-500">{u.email}{u.businessName ? ` · ${u.businessName}` : ""}</p></td>
                  <td className="px-4 py-3">
                    <select
                      className={`rounded-lg border-0 px-2 py-1 text-xs font-bold capitalize ${ROLE_BADGE[u.role]}`}
                      value={u.role}
                      disabled={busy === `u${u.id}`}
                      onChange={(e) => {
                        const r = e.target.value as U["role"];
                        if (confirm(`Change ${u.fullName}'s role to ${r}?`)) patch(u, { role: r }, `Role changed to ${r}`);
                      }}
                    >
                      <option value="admin">admin</option><option value="inspector">inspector</option><option value="farmer">farmer</option><option value="buyer">buyer</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">{u.city}</td>
                  <td className="px-4 py-3"><Badge status={u.isVerified ? "accepted" : "pending"} label={u.isVerified ? "verified" : "unverified"} /></td>
                  <td className="px-4 py-3 text-xs text-slate-500">{u.listings} listings · {u.orders} orders{u.role === "buyer" ? ` · ${formatPKRShort(u.walletBalance)}` : ""}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button className="btn-secondary px-2.5 py-1 text-xs" disabled={busy === `u${u.id}`} onClick={() => patch(u, { isVerified: !u.isVerified }, u.isVerified ? "Verification revoked" : "User verified")}>{u.isVerified ? "Unverify" : "✔ Verify"}</button>
                      <button className="btn-secondary px-2.5 py-1 text-xs" onClick={() => { setResetFor(u); setNewPw(genPassword()); }}>🔑 Reset password</button>
                    </div>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-500">No users match</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="Create account">
        <form onSubmit={create} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(["admin", "inspector", "farmer", "buyer"] as const).map((r) => (
              <button type="button" key={r} onClick={() => setNu({ ...nu, role: r })} className={`rounded-xl border-2 p-2.5 text-xs font-bold capitalize ${nu.role === r ? "border-brand-600 bg-brand-50 dark:bg-brand-500/10" : "border-slate-200 dark:border-slate-700"}`}>
                {r === "admin" ? "🛡️ Admin" : r === "inspector" ? "🔬 Inspector" : r === "farmer" ? "🧑‍🌾 Farmer" : "🏢 Buyer"}
              </button>
            ))}
          </div>
          <div className="col-span-2"><label className="label">Full name</label><input className="input" required value={nu.fullName} onChange={(e) => setNu({ ...nu, fullName: e.target.value })} /></div>
          <div className="col-span-2 sm:col-span-1"><label className="label">Email (login)</label><input type="email" className="input" required value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} /></div>
          <div className="col-span-2 sm:col-span-1"><label className="label">Password</label><div className="flex gap-1"><input className="input font-mono" required minLength={8} value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} /><button type="button" className="btn-secondary px-2" title="Generate" onClick={() => setNu({ ...nu, password: genPassword() })}>🎲</button></div></div>
          <div className="col-span-2 sm:col-span-1"><label className="label">Phone</label><input className="input" required value={nu.phone} onChange={(e) => setNu({ ...nu, phone: e.target.value })} placeholder="+92 3xx xxxxxxx" /></div>
          <div className="col-span-2 sm:col-span-1"><label className="label">City</label><select className="input" value={nu.city} onChange={(e) => setNu({ ...nu, city: e.target.value })}><CityOptions /></select></div>
          <div className="col-span-2 sm:col-span-1"><label className="label">CNIC (optional)</label><input className="input" value={nu.cnicId} onChange={(e) => setNu({ ...nu, cnicId: e.target.value })} placeholder="12345-1234567-1" /></div>
          <div className="col-span-2 sm:col-span-1"><label className="label">Organisation (optional)</label><input className="input" value={nu.businessName} onChange={(e) => setNu({ ...nu, businessName: e.target.value })} /></div>
          <p className="col-span-2 text-xs text-slate-500">Copy the password now and share it securely with the user. They can change it under Account settings.</p>
          <div className="col-span-2 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setCreating(false)}>Cancel</button>
            <button className="btn-primary" disabled={busy === "create"}>{busy === "create" && <Spinner />} Create account</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!resetFor} onClose={() => setResetFor(null)} title={resetFor ? `Reset password: ${resetFor.fullName}` : ""}>
        {resetFor && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">Set a new password for <b>{resetFor.email}</b>. Share it with the user securely.</p>
            <div className="flex gap-2">
              <input className="input font-mono" value={newPw} minLength={8} onChange={(e) => setNewPw(e.target.value)} />
              <button type="button" className="btn-secondary" onClick={() => setNewPw(genPassword())}>🎲</button>
              <button type="button" className="btn-secondary" onClick={() => { navigator.clipboard.writeText(newPw); push({ kind: "info", title: "Copied" }); }}>📋</button>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setResetFor(null)}>Cancel</button>
              <button className="btn-primary" disabled={busy === `u${resetFor.id}` || newPw.length < 8} onClick={async () => { if (await patch(resetFor, { newPassword: newPw }, "Password reset")) setResetFor(null); }}>Set password</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
