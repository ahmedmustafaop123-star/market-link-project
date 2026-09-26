"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { api, Spinner } from "@/components/ui";
import { useToast } from "@/components/providers";

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f6f8f4] px-4 py-10 dark:bg-[#07130d]">
      <div className="w-full max-w-md">
        <Link href="/" className="inline-flex"><Logo size={38} /></Link>
        <div className="card mt-6 p-6 sm:p-8">
          <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** 6-box one-time-code input with paste support. */
function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, " ").slice(0, 6).split("");
  return (
    <div className="flex justify-between gap-2" onPaste={(e) => { const t = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6); if (t) { e.preventDefault(); onChange(t); refs.current[Math.min(5, t.length)]?.focus(); } }}>
      {digits.map((d, i) => (
        <input key={i} ref={(el) => { refs.current[i] = el; }} inputMode="numeric" maxLength={1} aria-label={`Digit ${i + 1}`} value={d.trim()}
          onChange={(e) => { const c = e.target.value.replace(/\D/g, "").slice(-1); const arr = value.padEnd(6, " ").split(""); arr[i] = c || " "; onChange(arr.join("").trimEnd()); if (c) refs.current[i + 1]?.focus(); }}
          onKeyDown={(e) => { if (e.key === "Backspace" && !d.trim()) refs.current[i - 1]?.focus(); }}
          className="h-14 w-12 rounded-xl border border-slate-300 bg-white text-center text-2xl font-bold focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none dark:border-slate-700 dark:bg-slate-800" />
      ))}
    </div>
  );
}

function DevCode({ code }: { code?: string }) {
  if (!code) return null;
  return <p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">Development mode: email delivery isn&apos;t configured, so your code is shown here: <b className="font-mono text-sm tracking-widest">{code}</b></p>;
}

export function VerifyEmailForm({ email, initialDevCode }: { email: string; initialDevCode?: string }) {
  const router = useRouter();
  const { push } = useToast();
  const [code, setCode] = useState("");
  const [dev, setDev] = useState(initialDevCode);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(45);
  useEffect(() => { const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000); return () => clearInterval(id); }, []);

  async function verify(e?: React.FormEvent) {
    e?.preventDefault();
    if (code.length !== 6) return;
    setBusy(true);
    try {
      const r = await api<{ redirectTo: string }>("/api/auth/verify-email", { method: "POST", json: { email, code } });
      push({ kind: "success", title: "Email verified. Welcome to MarketLink!" });
      router.push(r.redirectTo);
      router.refresh();
    } catch (err) {
      push({ kind: "error", title: (err as Error).message });
      setBusy(false);
    }
  }
  async function resend() {
    try {
      const r = await api<{ devCode?: string }>("/api/auth/verify-email", { method: "POST", json: { email, resend: true } });
      setDev(r.devCode);
      setCooldown(45);
      push({ kind: "info", title: "New code sent" });
    } catch (err) {
      push({ kind: "error", title: (err as Error).message });
    }
  }
  useEffect(() => { if (code.length === 6) verify(); }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Shell title="Verify your email" subtitle={`Enter the 6-digit code we sent to ${email}. It expires in 10 minutes.`}>
      <DevCode code={dev} />
      <form onSubmit={verify} className="space-y-5">
        <CodeInput value={code} onChange={setCode} />
        <button className="btn-primary w-full py-2.5" disabled={busy || code.length !== 6}>{busy && <Spinner />} Verify & continue</button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-500">
        Didn&apos;t get it? {cooldown > 0 ? <span>Resend in {cooldown}s</span> : <button onClick={resend} className="font-semibold text-brand-700 hover:underline dark:text-brand-400">Resend code</button>}
      </p>
    </Shell>
  );
}

export function ForgotPasswordForm({ initialEmail = "" }: { initialEmail?: string }) {
  const { push } = useToast();
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ message: string; devResetUrl?: string } | null>(null);

  async function request(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ message: string; devResetUrl?: string }>("/api/auth/forgot-password", { method: "POST", json: { email } });
      setSent(r);
      push({ kind: "success", title: "Reset link sent", body: "Check your inbox (and spam folder)." });
    } catch (err) {
      push({ kind: "error", title: "Couldn't send reset link", body: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title={sent ? "Check your email" : "Forgot password?"} subtitle={sent ? sent.message : "Enter the email you signed up with. We'll send you a secure link to choose a new password."}>
      {!sent ? (
        <form onSubmit={request} className="space-y-4">
          <div><label className="label" htmlFor="fp-email">Email</label><input id="fp-email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus placeholder="aap@company.pk" /></div>
          <button className="btn-primary w-full py-2.5" disabled={busy}>{busy && <Spinner />} Send reset link</button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="grid place-items-center rounded-2xl bg-brand-50 py-6 text-5xl dark:bg-brand-500/10">📧</div>
          <p className="text-sm text-slate-600 dark:text-slate-300">The link expires in <b>15 minutes</b> and can be used once.</p>
          {sent.devResetUrl && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <p><b>Simulated email:</b> email delivery isn&apos;t configured on this server (RESEND_API_KEY), so the link is shown here instead.</p>
              <Link href={sent.devResetUrl} className="btn-primary mt-2 w-full">Open reset link →</Link>
            </div>
          )}
          <button className="btn-secondary w-full" onClick={() => setSent(null)}>Use a different email</button>
        </div>
      )}
      <p className="mt-5 text-center text-sm text-slate-500"><Link href="/login" className="font-semibold text-brand-700 hover:underline dark:text-brand-400">← Back to sign in</Link></p>
    </Shell>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const { push } = useToast();
  const [state, setState] = useState<{ status: "checking" | "valid" | "invalid"; email?: string; error?: string }>({ status: "checking" });
  const [pw, setPw] = useState({ a: "", b: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((r) => setState(r.success ? { status: "valid", email: r.data.email } : { status: "invalid", error: r.error }))
      .catch(() => setState({ status: "invalid", error: "Could not verify the link. Check your connection." }));
  }, [token]);

  const strength = [pw.a.length >= 8, /[A-Z]/.test(pw.a) && /[a-z]/.test(pw.a), /\d/.test(pw.a), /[^A-Za-z0-9]/.test(pw.a)].filter(Boolean).length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.a !== pw.b) return push({ kind: "error", title: "Passwords don't match" });
    setBusy(true);
    try {
      const r = await api<{ email: string }>("/api/auth/reset-password", { method: "POST", json: { token, newPassword: pw.a } });
      push({ kind: "success", title: "Password updated", body: "Sign in with your new password." });
      router.push(`/login?email=${encodeURIComponent(r.email)}`);
    } catch (err) {
      push({ kind: "error", title: "Couldn't reset password", body: (err as Error).message });
      setBusy(false);
    }
  }

  if (state.status === "checking") return <Shell title="Reset password" subtitle="Checking your reset link…"><div className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" /></Shell>;
  if (state.status === "invalid")
    return (
      <Shell title="Link expired" subtitle={state.error ?? "This reset link is invalid or has expired."}>
        <Link href="/forgot-password" className="btn-primary w-full">Request a new link</Link>
      </Shell>
    );
  const type = show ? "text" : "password";
  return (
    <Shell title="Choose a new password" subtitle={`For ${state.email}. At least 8 characters with a letter and a number.`}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="np">New password</label>
          <input id="np" type={type} minLength={8} required className="input" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} autoComplete="new-password" autoFocus />
          <div className="mt-2 flex gap-1" aria-hidden>{[0, 1, 2, 3].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i < strength ? (strength <= 1 ? "bg-rose-500" : strength <= 2 ? "bg-amber-500" : "bg-brand-600") : "bg-slate-200 dark:bg-slate-700"}`} />)}</div>
        </div>
        <div><label className="label" htmlFor="cp">Confirm password</label><input id="cp" type={type} minLength={8} required className="input" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} autoComplete="new-password" /></div>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show passwords</label>
        <button className="btn-primary w-full py-2.5" disabled={busy}>{busy && <Spinner />} Update password</button>
      </form>
    </Shell>
  );
}
