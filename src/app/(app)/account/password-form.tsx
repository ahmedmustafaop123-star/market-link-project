"use client";

import { useState } from "react";
import { api, Spinner } from "@/components/ui";
import { useToast } from "@/components/providers";

export function ChangePasswordForm() {
  const { push } = useToast();
  const [f, setF] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  const strength = (() => {
    const p = f.newPassword;
    let s = 0;
    if (p.length >= 8) s++;
    if (p.length >= 12) s++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
    if (/\d/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.newPassword !== f.confirm) return push({ kind: "error", title: "New passwords don't match" });
    setBusy(true);
    try {
      await api("/api/account/password", { method: "PATCH", json: { currentPassword: f.currentPassword, newPassword: f.newPassword } });
      push({ kind: "success", title: "Password changed", body: "Use your new password next time you sign in." });
      setF({ currentPassword: "", newPassword: "", confirm: "" });
    } catch (err) {
      push({ kind: "error", title: "Could not change password", body: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const type = show ? "text" : "password";
  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <div>
        <h2 className="font-bold">🔒 Change password</h2>
        <p className="text-xs text-slate-500">Minimum 8 characters. Mix letters, numbers and symbols for a strong password.</p>
      </div>
      <div><label className="label">Current password</label><input type={type} className="input" required value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} autoComplete="current-password" /></div>
      <div>
        <label className="label">New password</label>
        <input type={type} className="input" required minLength={8} value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} autoComplete="new-password" />
        <div className="mt-2 flex gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i < strength ? (strength <= 2 ? "bg-rose-500" : strength <= 3 ? "bg-amber-500" : "bg-brand-600") : "bg-slate-200 dark:bg-slate-700"}`} />
          ))}
        </div>
      </div>
      <div><label className="label">Confirm new password</label><input type={type} className="input" required value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} autoComplete="new-password" /></div>
      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show passwords</label>
      <button className="btn-primary w-full" disabled={busy}>{busy && <Spinner />} Update password</button>
    </form>
  );
}
