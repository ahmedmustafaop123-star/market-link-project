"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/app-shell";
import { Logo } from "@/components/Logo";
import { api, Spinner } from "@/components/ui";
import { CityOptions } from "@/components/city-options";
import { useToast } from "@/components/providers";
import { GoogleButton, OrDivider } from "@/components/auth/google-button";
import { useEffect } from "react";

const DEMOS = [
  { label: "Farmer", sub: "Muhammad Aslam · Multan", email: "farmer@marketlink.pk", icon: "🧑‍🌾" },
  { label: "Buyer", sub: "Qureshi Wholesale · Lahore", email: "buyer@marketlink.pk", icon: "🏢" },
  { label: "Quality Inspector", sub: "Dr. Farhan Malik · Faisalabad", email: "inspector@marketlink.pk", icon: "🔬" },
];

export type LoginAlert = { kind: "error" | "info"; title: string; body?: string } | null;

export function LoginForm({ initialEmail, initialRole, startOnRegister, adminMode = false, next, alert = null, signedInAs = null }: { initialEmail: string; initialRole: "farmer" | "buyer"; startOnRegister: boolean; adminMode?: boolean; next?: string; alert?: LoginAlert; signedInAs?: { fullName: string; role: string } | null }) {
  const router = useRouter();
  const { push } = useToast();
  const [tab, setTab] = useState<"login" | "register">(startOnRegister ? "register" : "login");
  const [loading, setLoading] = useState<string | null>(null);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState(initialEmail && !adminMode ? "password123" : "");
  const [reg, setReg] = useState({ fullName: "", email: "", password: "", phone: "", role: initialRole, city: "Lahore", cnicId: "", businessName: "", address: "" });

  async function login(e?: string, p?: string) {
    setLoading(e ?? "form");
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: e ?? email, password: p ?? password }) });
      const data = await res.json();
      if (res.status === 403 && data.details?.code === "EMAIL_NOT_VERIFIED") {
        push({ kind: "info", title: "Verify your email to continue" });
        router.push(`/verify-email?email=${encodeURIComponent(data.details.email)}${data.details.devCode ? `&dev=${data.details.devCode}` : ""}`);
        return;
      }
      if (!res.ok || !data.success) throw new Error(data.error || "Sign in failed");
      const r = data.data as { redirectTo: string; fullName: string };
      push({ kind: "success", title: `Welcome, ${r.fullName}` });
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : r.redirectTo);
      router.refresh();
    } catch (err) {
      push({ kind: "error", title: "Sign in failed", body: (err as Error).message });
      setLoading(null);
    }
  }

  async function register(ev: React.FormEvent) {
    ev.preventDefault();
    setLoading("register");
    try {
      const r = await api<{ email: string; devCode?: string }>("/api/auth/register", { method: "POST", json: reg });
      push({ kind: "success", title: "Account created", body: "Enter the verification code we emailed you." });
      router.push(`/verify-email?email=${encodeURIComponent(r.email)}${r.devCode ? `&dev=${r.devCode}` : ""}`);
    } catch (err) {
      push({ kind: "error", title: "Registration failed", body: (err as Error).message });
      setLoading(null);
    }
  }

  useEffect(() => {
    if (alert) push({ kind: alert.kind === "error" ? "error" : "info", title: alert.title, body: alert.body });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function switchAccount() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
  }

  const set = (k: keyof typeof reg) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setReg({ ...reg, [k]: e.target.value });

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/mandi-pakistan.jpg" alt="Sabzi mandi in Lahore" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-900/60 to-brand-900/10" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-white">
          <p className="mb-4 text-xl text-gold-300" dir="rtl">کسان سے خریدار تک — براہِ راست</p>
          <p className="text-3xl font-bold">&ldquo;I sold 125 maund of wheat at Rs. 3,800/maund — Rs. 280 more than the local arhti offered.&rdquo;</p>
          <p className="mt-3 text-brand-100">— Muhammad Aslam, wheat & Chaunsa mango grower, Multan, Punjab</p>
        </div>
      </div>

      <div className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Brand />
          {alert && (
            <div role="alert" className={`mt-8 rounded-2xl border p-4 text-sm ${alert.kind === "error" ? "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100" : "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100"}`}>
              <p className="flex items-center gap-2 font-bold">{alert.kind === "error" ? "⛔" : "ℹ️"} {alert.title}</p>
              {alert.body && <p className="mt-1 opacity-90">{alert.body}</p>}
              {signedInAs && (
                <p className="mt-2 text-xs opacity-90">
                  You&apos;re signed in as <b>{signedInAs.fullName}</b> ({signedInAs.role}). Sign in below with an administrator account, or{" "}
                  <button type="button" onClick={switchAccount} className="font-semibold underline">sign out</button>.
                </p>
              )}
            </div>
          )}
          {adminMode && (
            <div className="mt-8 flex items-center gap-3 rounded-2xl bg-brand-900 p-4 text-white">
              <Logo variant="mark" size={40} />
              <div>
                <p className="font-bold">MARKETLINK AGRI-HUB · Admin</p>
                <p className="text-xs text-white/70">Authorized administrators only</p>
              </div>
            </div>
          )}
          <h1 className={`${adminMode ? "mt-6" : "mt-8"} text-2xl font-bold`}>{adminMode ? "Admin sign in" : tab === "login" ? "Sign in to your account" : "Create your MarketLink account"}</h1>
          <div className={`mt-5 flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800 ${adminMode ? "hidden" : ""}`}>
            {(["login", "register"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-lg py-2 text-sm font-semibold ${tab === t ? "bg-white shadow dark:bg-slate-900" : "text-slate-500"}`}>
                {t === "login" ? "Sign in" : "Register"}
              </button>
            ))}
          </div>

          {tab === "login" ? (
            <>
              {!adminMode && (
                <div className="mt-6">
                  <GoogleButton role={initialRole} next={next} />
                  <OrDivider text="or sign in with email" />
                </div>
              )}
              <form className={`${adminMode ? "mt-6" : ""} space-y-4`} onSubmit={(e) => { e.preventDefault(); login(); }}>
                <div>
                  <label className="label" htmlFor="email">Email</label>
                  <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="aap@company.pk" />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="label !mb-0" htmlFor="password">Password</label>
                    <a href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`} className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-400">Forgot password?</a>
                  </div>
                  <input id="password" type="password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                </div>
                <button className="btn-primary w-full py-2.5" disabled={!!loading}>{loading === "form" && <Spinner />} Sign in</button>
              </form>
              {adminMode ? (
                <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                  Super Admin: <b>Ahmed Mustafa</b> · <b>ahmed.mustafa@admin.com</b> / <b>password123</b>. After signing in, change it under <b>Account settings</b>.
                </div>
              ) : null}
              {!adminMode && (
                <p className="mt-4 text-center text-xs text-slate-500">
                  Administrator? <a href="/admin-login" className="font-semibold text-brand-700 hover:underline dark:text-brand-400">🛡️ Admin panel login</a>
                </p>
              )}
              {adminMode && (
                <p className="mt-4 text-center text-xs text-slate-500">
                  Not an admin? <a href="/login" className="font-semibold text-brand-700 hover:underline dark:text-brand-400">Farmer / buyer login</a>
                </p>
              )}
              <div className={`mt-8 ${adminMode ? "hidden" : ""}`}>
                <p className="text-center text-xs font-semibold tracking-wider text-slate-500 uppercase">Quick demo access</p>
                <div className="mt-3 grid gap-2">
                  {DEMOS.map((d) => (
                    <button key={d.email} onClick={() => login(d.email, "password123")} disabled={!!loading} className="card flex items-center gap-3 p-3 text-left transition hover:border-brand-400 hover:shadow-md">
                      <span className="text-2xl">{d.icon}</span>
                      <span className="flex-1">
                        <span className="block text-sm font-semibold">Continue as {d.label}</span>
                        <span className="block text-xs text-slate-500">{d.sub}</span>
                      </span>
                      {loading === d.email ? <Spinner /> : <span className="text-slate-400">→</span>}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
            <div className="mt-6">
              <GoogleButton role={reg.role} next={next} label={`Sign up with Google as ${reg.role === "farmer" ? "Farmer" : "Buyer"}`} />
              <OrDivider text="or register with email" />
            </div>
            <form className="grid grid-cols-2 gap-3" onSubmit={register}>
              <div className="col-span-2 grid grid-cols-2 gap-2">
                {(["farmer", "buyer"] as const).map((r) => (
                  <button type="button" key={r} onClick={() => setReg({ ...reg, role: r })} className={`rounded-xl border-2 p-3 text-sm font-semibold ${reg.role === r ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10" : "border-slate-200 dark:border-slate-700"}`}>
                    {r === "farmer" ? "🧑‍🌾 Farmer / Seller" : "🏢 Buyer / Wholesaler"}
                  </button>
                ))}
              </div>
              <div className="col-span-2"><label className="label">Full name</label><input className="input" required value={reg.fullName} onChange={set("fullName")} /></div>
              <div className="col-span-2 sm:col-span-1"><label className="label">Email</label><input type="email" className="input" required value={reg.email} onChange={set("email")} /></div>
              <div className="col-span-2 sm:col-span-1"><label className="label">Password</label><input type="password" minLength={8} className="input" required value={reg.password} onChange={set("password")} /></div>
              <div className="col-span-2 sm:col-span-1"><label className="label">Phone</label><input className="input" required value={reg.phone} onChange={set("phone")} placeholder="+92 3xx xxxxxxx" /></div>
              <div className="col-span-2 sm:col-span-1"><label className="label">CNIC</label><input className="input" value={reg.cnicId} onChange={set("cnicId")} placeholder="12345-1234567-1" pattern="\d{5}-\d{7}-\d" /></div>
              <div className="col-span-2 sm:col-span-1"><label className="label">City</label><select className="input" value={reg.city} onChange={set("city")}><CityOptions /></select></div>
              <div className="col-span-2 sm:col-span-1"><label className="label">{reg.role === "farmer" ? "Farm name" : "Company"}</label><input className="input" value={reg.businessName} onChange={set("businessName")} /></div>
              <div className="col-span-2"><label className="label">Address</label><input className="input" value={reg.address} onChange={set("address")} /></div>
              <button className="btn-primary col-span-2 mt-2 py-2.5" disabled={!!loading}>{loading === "register" && <Spinner />} Create account</button>
            </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
