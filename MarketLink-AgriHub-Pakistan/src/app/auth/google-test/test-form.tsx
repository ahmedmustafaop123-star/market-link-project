"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GoogleLogo } from "@/components/auth/google-button";
import { Spinner } from "@/components/ui";
import { useToast } from "@/components/providers";

/** Simulated Google account chooser for servers without GOOGLE_CLIENT_ID. Uses the real provisioning logic. */
export function GoogleTestForm({ role, next }: { role: "buyer" | "farmer"; next?: string }) {
  const router = useRouter();
  const { push } = useToast();
  const [f, setF] = useState({ name: "", email: "", role });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/auth/google/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...f, next }) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Sign-in failed");
      push({ kind: "success", title: data.data.created ? "Account created with Google" : "Signed in with Google" });
      router.push(data.data.redirectTo);
      router.refresh();
    } catch (err) {
      push({ kind: "error", title: "Google sign-in failed", body: (err as Error).message });
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[#f0f4f9] px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-[450px] rounded-[28px] bg-white p-8 shadow-sm sm:p-10 dark:bg-slate-900">
        <GoogleLogo className="h-10 w-10" />
        <h1 className="mt-5 text-3xl font-normal text-slate-900 dark:text-white">Sign in</h1>
        <p className="mt-2 text-base text-slate-700 dark:text-slate-300">to continue to <b>MarketLink Agri-Hub</b></p>
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <b>Test mode.</b> Google OAuth credentials aren&apos;t configured on this server, so this screen simulates Google&apos;s consent step. It can only create new accounts or sign into accounts made here. Add <code>GOOGLE_CLIENT_ID</code> / <code>GOOGLE_CLIENT_SECRET</code> for real Google sign-in.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <input className="h-14 w-full rounded-md border border-slate-300 px-4 text-base outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] dark:border-slate-600 dark:bg-slate-800" placeholder="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required aria-label="Full name" />
          <input type="email" className="h-14 w-full rounded-md border border-slate-300 px-4 text-base outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] dark:border-slate-600 dark:bg-slate-800" placeholder="Email (Gmail address)" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required aria-label="Email" />
          <fieldset className="flex gap-2 text-sm">
            <legend className="mb-2 text-slate-600 dark:text-slate-400">New account type</legend>
            {(["buyer", "farmer"] as const).map((r) => (
              <label key={r} className={`flex-1 cursor-pointer rounded-lg border-2 px-3 py-2 text-center font-medium ${f.role === r ? "border-[#1a73e8] bg-blue-50 text-[#1a73e8] dark:bg-blue-500/10" : "border-slate-200 dark:border-slate-700"}`}>
                <input type="radio" className="sr-only" checked={f.role === r} onChange={() => setF({ ...f, role: r })} />
                {r === "buyer" ? "🏢 Buyer" : "🧑‍🌾 Farmer"}
              </label>
            ))}
          </fieldset>
          <p className="text-xs text-slate-500">Google will share your name, email address and profile picture with MarketLink.</p>
          <div className="flex items-center justify-between pt-2">
            <Link href="/login" className="rounded-full px-4 py-2 text-sm font-medium text-[#1a73e8] hover:bg-blue-50 dark:hover:bg-blue-500/10">Cancel</Link>
            <button disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-[#1a73e8] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#1765cc] disabled:opacity-60">{busy && <Spinner />} Continue</button>
          </div>
        </form>
      </div>
    </div>
  );
}
