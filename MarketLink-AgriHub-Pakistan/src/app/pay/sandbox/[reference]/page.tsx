"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { Spinner } from "@/components/ui";

/** Hosted test checkout that mimics a real gateway page. The result goes through the signed server callback. */
export default function SandboxCheckout() {
  const { reference } = useParams<{ reference: string }>();
  const router = useRouter();
  const [intent, setIntent] = useState<{ amount: number; status: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/payments/${reference}`).then((r) => r.json()).then((r) => (r.success ? setIntent(r.data) : setErr(r.error))).catch(() => setErr("Could not load payment"));
  }, [reference]);

  async function pay(outcome: "success" | "failed") {
    setBusy(outcome);
    const r = await fetch(`/api/payments/sandbox/${reference}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ outcome }) }).then((x) => x.json());
    if (!r.success) { setErr(r.error); setBusy(null); return; }
    router.replace(`/wallet?payment=${reference}`);
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-100 px-4 dark:bg-[#07130d]">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-[#0d1f16]">
        <div className="flex items-center justify-between bg-slate-900 px-6 py-4 text-white">
          <Logo size={28} tone="light" tagline={false} />
          <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-[11px] font-bold text-slate-900">TEST MODE</span>
        </div>
        <div className="space-y-5 p-6">
          {err && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{err}</p>}
          {intent && (
            <>
              <div>
                <p className="text-sm text-slate-500">Pay MarketLink Agri-Hub</p>
                <p className="text-3xl font-extrabold">Rs. {intent.amount.toLocaleString("en-US")}</p>
                <p className="font-mono text-xs text-slate-500">Ref {reference}</p>
              </div>
              {intent.status !== "pending" ? (
                <p className="rounded-xl bg-slate-100 p-3 text-sm dark:bg-white/5">This payment is already <b>{intent.status}</b>.</p>
              ) : (
                <>
                  <div className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                    <div><label className="label">Card number</label><input className="input font-mono" defaultValue="4242 4242 4242 4242" readOnly /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="label">Expiry</label><input className="input font-mono" defaultValue="12 / 30" readOnly /></div>
                      <div><label className="label">CVC</label><input className="input font-mono" defaultValue="123" readOnly /></div>
                    </div>
                  </div>
                  <button className="btn-primary w-full py-3 text-base" disabled={!!busy} onClick={() => pay("success")}>{busy === "success" && <Spinner />} Pay Rs. {intent.amount.toLocaleString("en-US")}</button>
                  <button className="btn-secondary w-full" disabled={!!busy} onClick={() => pay("failed")}>{busy === "failed" && <Spinner />} Simulate declined payment</button>
                </>
              )}
              <p className="text-center text-[11px] text-slate-500">No real money is charged. Configure Stripe, JazzCash or Easypaisa keys for live payments.</p>
            </>
          )}
          {!intent && !err && <div className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/5" />}
        </div>
      </div>
    </div>
  );
}
