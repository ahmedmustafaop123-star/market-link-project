"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, Badge, LoadingBlock, PageHeader, Spinner, StatCard } from "@/components/ui";
import { useToast } from "@/components/providers";
import { formatDate, formatPKR, formatPKRShort } from "@/lib/constants";

type Wallet = {
  walletBalance: number; escrowBalance: number; pendingInEscrow: number;
  transactions: { txnId: number; type: string; amount: number; description: string | null; createdAt: string }[];
};
type Providers = Record<"stripe" | "jazzcash" | "easypaisa" | "sandbox", { enabled: boolean; label: string; mode: string }>;
type Payout = { payoutId: number; amount: number; method: string; accountNumber: string; status: string; adminNote: string | null; createdAt: string };

const TX: Record<string, { icon: string; sign: 1 | -1 | 0; label: string }> = {
  deposit: { icon: "🏦", sign: 1, label: "Top-up" },
  escrow_lock: { icon: "🔐", sign: -1, label: "Escrow lock" },
  escrow_release: { icon: "📤", sign: 0, label: "Escrow released" },
  payout: { icon: "💸", sign: 1, label: "Sale proceeds" },
  refund: { icon: "↩️", sign: 1, label: "Refund" },
  platform_fee: { icon: "🧾", sign: 0, label: "Platform fee" },
  withdrawal: { icon: "🏧", sign: -1, label: "Withdrawal" },
};
const PROVIDER_ICON = { stripe: "💳", jazzcash: "🔴", easypaisa: "🟢", sandbox: "🧪" };

function submitForm(action: string, fields: Record<string, string>) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;
  Object.entries(fields).forEach(([k, v]) => {
    const i = document.createElement("input");
    i.type = "hidden";
    i.name = k;
    i.value = v;
    form.appendChild(i);
  });
  document.body.appendChild(form);
  form.submit();
}

export function WalletClient({ role }: { role: "farmer" | "buyer" }) {
  const { push } = useToast();
  const sp = useSearchParams();
  const router = useRouter();
  const [w, setW] = useState<Wallet | null>(null);
  const [providers, setProviders] = useState<Providers | null>(null);
  const [provider, setProvider] = useState<keyof Providers>("sandbox");
  const [amount, setAmount] = useState("500000");
  const [busy, setBusy] = useState(false);
  const [payment, setPayment] = useState<{ reference: string; status: string; amount: number } | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [po, setPo] = useState({ amount: "", method: "bank", accountTitle: "", accountNumber: "" });

  const load = useCallback(async () => {
    try {
      setW(await api<Wallet>("/api/wallet"));
      if (role === "buyer") {
        const p = await api<Providers>("/api/payments/checkout");
        setProviders(p);
        const first = (["stripe", "jazzcash", "easypaisa", "sandbox"] as const).find((k) => p[k].enabled);
        if (first) setProvider(first);
      } else setPayouts(await api<Payout[]>("/api/payouts"));
    } catch (e) {
      push({ kind: "error", title: (e as Error).message });
    }
  }, [push, role]);
  useEffect(() => { load(); }, [load]);

  // Returning from a gateway: poll the payment status until the webhook/callback settles it
  const ref = sp.get("payment");
  useEffect(() => {
    if (!ref) return;
    let n = 0;
    let stop = false;
    const tick = async () => {
      try {
        const p = await api<{ reference: string; status: string; amount: number }>(`/api/payments/${ref}`);
        setPayment(p);
        if (p.status !== "pending" || n++ > 20) {
          if (p.status === "succeeded") { push({ kind: "success", title: "Payment received", body: `${formatPKR(p.amount)} added to your wallet` }); load(); }
          return;
        }
      } catch { return; }
      if (!stop) setTimeout(tick, 2000);
    };
    tick();
    return () => { stop = true; };
  }, [ref, push, load]);

  async function topUp() {
    setBusy(true);
    try {
      const r = await api<{ redirectUrl?: string; form?: { action: string; fields: Record<string, string> } }>("/api/payments/checkout", { method: "POST", json: { provider, amount: Number(amount) } });
      if (r.form) submitForm(r.form.action, r.form.fields);
      else if (r.redirectUrl) window.location.href = r.redirectUrl;
    } catch (e) {
      push({ kind: "error", title: "Could not start payment", body: (e as Error).message });
      setBusy(false);
    }
  }

  async function requestPayout(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/payouts", { method: "POST", json: { ...po, amount: Number(po.amount) } });
      push({ kind: "success", title: "Payout requested", body: "An admin will process it within 1 business day." });
      setPo({ amount: "", method: "bank", accountTitle: "", accountNumber: "" });
      load();
    } catch (err) {
      push({ kind: "error", title: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (!w) return <LoadingBlock />;
  return (
    <div className="space-y-6">
      <PageHeader title="Escrow Wallet" urdu="محفوظ والٹ" subtitle={role === "buyer" ? "Add funds through a payment gateway and pay farmers safely through escrow" : "Sale proceeds arrive here when buyers confirm delivery"} />

      {payment && (
        <div className={`card flex flex-wrap items-center gap-3 p-4 ${payment.status === "succeeded" ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30" : payment.status === "pending" ? "border-sky-300 bg-sky-50 dark:bg-sky-950/30" : "border-rose-300 bg-rose-50 dark:bg-rose-950/30"}`}>
          <span className="text-2xl">{payment.status === "succeeded" ? "✅" : payment.status === "pending" ? "⏳" : "⚠️"}</span>
          <p className="flex-1 text-sm">
            {payment.status === "succeeded" ? <>Payment <b>{payment.reference}</b> received: {formatPKR(payment.amount)} added.</> : payment.status === "pending" ? <>Waiting for the gateway to confirm payment <b>{payment.reference}</b>…</> : <>Payment <b>{payment.reference}</b> {payment.status}. No money was deducted.</>}
          </p>
          <button className="text-xs font-semibold text-slate-500 hover:text-slate-800" onClick={() => { setPayment(null); router.replace("/wallet"); }}>Dismiss</button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Available balance" value={formatPKRShort(w.walletBalance)} icon="💰" />
        <StatCard label={role === "buyer" ? "Locked in escrow" : "Incoming (in escrow)"} value={formatPKRShort(role === "buyer" ? w.escrowBalance : w.pendingInEscrow)} icon="🔐" tone="sky" />
        <StatCard label="Transactions" value={w.transactions.length} icon="🧾" tone="violet" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {role === "buyer" ? (
          <section className="card space-y-4 p-5">
            <h2 className="font-bold">Add funds</h2>
            <div className="grid gap-2">
              {providers && (Object.keys(providers) as (keyof Providers)[]).map((k) => (
                <label key={k} className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 text-sm transition ${!providers[k].enabled ? "cursor-not-allowed opacity-45" : provider === k ? "border-brand-600 bg-brand-50 dark:bg-brand-500/10" : "border-slate-200 dark:border-white/10"}`}>
                  <input type="radio" name="provider" className="sr-only" disabled={!providers[k].enabled} checked={provider === k} onChange={() => setProvider(k)} />
                  <span className="text-xl">{PROVIDER_ICON[k]}</span>
                  <span className="flex-1 font-semibold">{providers[k].label}</span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">{providers[k].enabled ? providers[k].mode : "not configured"}</span>
                </label>
              ))}
            </div>
            <div>
              <label className="label">Amount (PKR)</label>
              <input type="number" min={1000} className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[100000, 500000, 2500000].map((a) => <button key={a} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold dark:bg-white/10" onClick={() => setAmount(String(a))}>{formatPKRShort(a)}</button>)}
              </div>
            </div>
            <button className="btn-primary w-full" disabled={busy || !providers?.[provider]?.enabled} onClick={topUp}>{busy && <Spinner />} Continue to {providers?.[provider]?.label ?? "payment"}</button>
            <p className="text-[11px] text-slate-500">Your wallet is credited only after the gateway confirms the payment with a signed callback.</p>
          </section>
        ) : (
          <section className="card p-5">
            <h2 className="font-bold">Request payout</h2>
            <form onSubmit={requestPayout} className="mt-3 space-y-3">
              <div><label className="label">Amount (PKR)</label><input type="number" min={1000} max={w.walletBalance} className="input" required value={po.amount} onChange={(e) => setPo({ ...po, amount: e.target.value })} /><button type="button" className="mt-1 text-xs font-semibold text-brand-700" onClick={() => setPo({ ...po, amount: String(Math.floor(w.walletBalance)) })}>Withdraw all ({formatPKR(w.walletBalance)})</button></div>
              <div><label className="label">Method</label><select className="input" value={po.method} onChange={(e) => setPo({ ...po, method: e.target.value })}><option value="bank">Bank account (IBFT)</option><option value="jazzcash">JazzCash wallet</option><option value="easypaisa">Easypaisa wallet</option></select></div>
              <div><label className="label">Account title</label><input className="input" required value={po.accountTitle} onChange={(e) => setPo({ ...po, accountTitle: e.target.value })} /></div>
              <div><label className="label">{po.method === "bank" ? "IBAN" : "Mobile number"}</label><input className="input font-mono" required value={po.accountNumber} onChange={(e) => setPo({ ...po, accountNumber: e.target.value })} placeholder={po.method === "bank" ? "PK36SCBL0000001123456702" : "03xx xxxxxxx"} /></div>
              <button className="btn-primary w-full" disabled={busy || w.walletBalance < 1000}>{busy && <Spinner />} Request payout</button>
            </form>
            {payouts.length > 0 && (
              <ul className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-sm dark:border-white/5">
                {payouts.slice(0, 5).map((p) => (
                  <li key={p.payoutId} className="flex items-center justify-between gap-2">
                    <span><b>{formatPKR(p.amount)}</b> <span className="text-xs text-slate-500">· {p.method} · {formatDate(p.createdAt)}</span></span>
                    <Badge status={p.status === "paid" ? "released" : p.status === "rejected" ? "rejected" : "pending"} label={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        <section className="card overflow-hidden lg:col-span-2">
          <h2 className="border-b border-slate-100 px-5 py-3.5 font-bold dark:border-white/5">Ledger</h2>
          <ul className="max-h-[560px] divide-y divide-slate-100 overflow-y-auto dark:divide-white/5">
            {w.transactions.map((t) => {
              const meta = TX[t.type] ?? { icon: "•", sign: 0, label: t.type };
              return (
                <li key={t.txnId} className="flex items-center gap-3 px-5 py-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 dark:bg-white/5">{meta.icon}</span>
                  <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{meta.label}</p><p className="truncate text-xs text-slate-500">{t.description} · {formatDate(t.createdAt)}</p></div>
                  <p className={`text-sm font-bold tabular-nums ${meta.sign > 0 ? "text-emerald-600" : meta.sign < 0 ? "text-rose-600" : "text-slate-500"}`}>{meta.sign > 0 ? "+" : meta.sign < 0 ? "−" : ""}{formatPKR(t.amount)}</p>
                </li>
              );
            })}
            {w.transactions.length === 0 && <li className="p-8 text-center text-sm text-slate-500">No transactions yet</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
