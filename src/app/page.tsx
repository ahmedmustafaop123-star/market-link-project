import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { SiteNav } from "@/components/nav/site-nav";
import { getViewer } from "@/lib/viewer";
import { MandiTicker } from "@/components/mandi-ticker";
import { ChatBot } from "@/components/ChatBot";
import { getTicker } from "@/lib/ticker";
import { CROP_CATALOGUE, MANDIS, PROVINCES, CITIES } from "@/lib/constants";

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: "🌾", title: "Direct Crop Listings", ur: "براہ راست فصل کی فروخت", body: "Kisan list graded produce with photos, harvest date and quantity in kg, maund or tons — visible to verified buyers across Pakistan." },
  { icon: "🤝", title: "Bidding & Negotiation", ur: "بولی اور سودا", body: "Wholesalers, supermarkets, exporters and processors send bulk offers. Farmers accept, reject or counter — no arhti commission." },
  { icon: "📈", title: "Live Mandi Rates", ur: "منڈی کے تازہ ریٹ", body: "Daily min / max / average rates from Badami Bagh, Multan Ghalla Mandi, Karachi Super Highway and 7 more mandis, per kg and per maund." },
  { icon: "🔐", title: "Escrow Payments (PKR)", ur: "محفوظ ادائیگی", body: "Buyer money is locked in escrow and released to the farmer only after delivery is confirmed. Flat 1.5% fee — no hidden cuts." },
  { icon: "🚚", title: "Truck Tracking", ur: "ترسیل کی نگرانی", body: "Follow every consignment: Placed → Inspected → Dispatched → In Transit (e.g. M-2, N-5) → Delivered, with checkpoint history." },
  { icon: "🛡️", title: "Quality Inspection", ur: "معیار کی جانچ", body: "Inspectors verify CNIC & farm, grade crops A/B/C, record moisture and soil pH, and attach lab reports before dispatch." },
];

const STEPS = [
  { n: "1", title: "Kisan lists the crop", ur: "کسان فصل درج کرے", body: "Photo, grade, quantity and a price suggested from today's mandi rates." },
  { n: "2", title: "Buyers bid, farmer decides", ur: "خریدار بولی لگائے", body: "Accept the best offer or send a counter-offer in one tap." },
  { n: "3", title: "Escrow, inspect, deliver", ur: "محفوظ ادائیگی اور ترسیل", body: "Funds locked, quality checked, truck tracked, payment released on delivery." },
];

export default async function Home() {
  const user = await getCurrentUser();
  const viewer = await getViewer(user);
  const ticker = await getTicker();
  const cityCount = Object.keys(CITIES).length;
  return (
    <div className="min-h-screen">
      <SiteNav viewer={viewer} transparent />

      {/* HERO */}
      <section className="relative isolate overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/hero-pakistan.jpg" alt="Pakistani farmer in a wheat field in Punjab" className="absolute inset-0 -z-20 h-full w-full object-cover object-[70%_center]" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-brand-950/95 via-brand-900/80 to-brand-900/10" />
        <div className="mx-auto max-w-7xl px-4 pt-32 pb-20 sm:px-6 lg:pt-40 lg:pb-32">
          <div className="max-w-2xl text-white">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/20 backdrop-blur">🇵🇰 Pakistan&apos;s B2B Agri-Commerce Platform</span>
            <h1 className="mt-6 text-4xl leading-[1.1] font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Kisan se khareedar tak.
              <span className="block text-gold-400">No middlemen.</span>
            </h1>
            <p className="mt-3 text-2xl text-white/90" dir="rtl" lang="ur" style={{ fontFamily: "'Noto Nastaliq Urdu', serif" }}>کسان سے خریدار تک — براہِ راست</p>
            <p className="mt-5 max-w-xl text-lg text-white/80">
              MarketLink Agri-Hub connects farmers in Punjab, Sindh, KPK and Balochistan directly with wholesalers, supermarket chains, exporters and food processors, with transparent mandi rates, PKR escrow and truck tracking.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register?role=farmer" className="btn bg-gold-400 px-6 py-3 text-base text-brand-950 hover:bg-gold-300">🧑‍🌾 I&apos;m a Kisan (Farmer)</Link>
              <Link href="/marketplace" className="btn bg-white/10 px-6 py-3 text-base text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/20">🛒 Browse marketplace</Link>
            </div>
            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-white/15 pt-6">
              {[[`${MANDIS.length}`, "Mandis tracked"], [`${cityCount}+`, "Cities covered"], ["1.5%", "Flat fee, no arhti cut"]].map(([v, l]) => (
                <div key={l}>
                  <dt className="text-3xl font-extrabold text-gold-400">{v}</dt>
                  <dd className="text-xs text-white/70">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <MandiTicker items={ticker} variant="dark" />

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <p className="text-center text-sm font-bold tracking-widest text-brand-600 uppercase">How it works · یہ کیسے کام کرتا ہے</p>
        <h2 className="mt-2 text-center text-3xl font-extrabold tracking-tight sm:text-4xl">Three steps from field to buyer</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="card relative overflow-hidden p-6">
              <span className="absolute -top-4 -right-2 text-8xl font-black text-brand-900/5 dark:text-white/5">{s.n}</span>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-900 font-bold text-gold-400">{s.n}</span>
              <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
              <p className="text-sm text-brand-700 dark:text-brand-300" dir="rtl">{s.ur}</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES + MANDI IMAGE */}
      <section className="bg-white py-16 dark:bg-[#0a1a12]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_380px]">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">Built for Pakistani agriculture</h2>
            <p className="mt-2 text-slate-500 dark:text-slate-400">Prices in PKR, rates per maund (40 kg), mandi names you know, and Urdu support.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex gap-4 rounded-2xl border border-slate-100 p-4 transition hover:border-brand-200 hover:bg-brand-50/40 dark:border-white/5 dark:hover:bg-white/5">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-900 text-xl">{f.icon}</span>
                  <div>
                    <h3 className="font-semibold">{f.title} <span className="text-xs font-normal text-brand-600" dir="rtl">· {f.ur}</span></h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{f.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative hidden overflow-hidden rounded-3xl shadow-xl lg:block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/mandi-pakistan.jpg" alt="Sabzi mandi in Lahore" className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-950/90 to-transparent p-5 text-white">
              <p className="text-sm font-semibold">Badami Bagh Mandi, Lahore</p>
              <p className="text-xs text-white/70">Rates synced daily with 9 other mandis nationwide</p>
            </div>
          </div>
        </div>
      </section>

      {/* CROPS */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-3xl font-extrabold tracking-tight">Crops traded on MarketLink</h2>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {CROP_CATALOGUE.slice(0, 10).map((c) => (
            <div key={c.name} className="group relative overflow-hidden rounded-2xl shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.image} alt={c.name} className="h-36 w-full object-cover transition duration-500 group-hover:scale-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                <p className="text-sm font-bold">{c.name} <span className="font-normal opacity-80">{c.urdu}</span></p>
                <p className="text-[11px] text-gold-300">≈ Rs. {(c.mandiBase * 40).toLocaleString("en-US")}/maund</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PROVINCES */}
      <section className="pk-pattern relative bg-brand-900 py-14 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-extrabold sm:text-3xl">Serving every province of Pakistan</h2>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {PROVINCES.map((p) => (
              <div key={p} className="rounded-2xl bg-white/10 p-4 text-center ring-1 ring-white/10">
                <p className="text-sm font-bold">{p}</p>
                <p className="mt-1 text-xs text-white/60">{Object.values(CITIES).filter((c) => c.province === p).length} cities</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DEMO */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="card overflow-hidden border-0 bg-gradient-to-br from-gold-400 to-gold-500 p-8 text-brand-950 sm:p-12">
          <h2 className="text-2xl font-extrabold sm:text-3xl">Try the live demo</h2>
          <p className="mt-2 max-w-2xl">Pre-loaded with farmers from Multan, Sahiwal, Hyderabad, Okara & Turbat, buyers from Lahore, Karachi & Faisalabad. Password for all: <code className="rounded bg-brand-950/10 px-1.5 py-0.5 font-bold">password123</code></p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[["🧑‍🌾 Kisan (Farmer)", "farmer@marketlink.pk"], ["🏢 Buyer / Wholesaler", "buyer@marketlink.pk"], ["🛡️ Admin / Inspector", "ahmed.mustafa@admin.com"]].map(([r, e]) => (
              <Link key={e} href={`/login?email=${e}`} className="rounded-2xl bg-brand-950 p-4 text-white transition hover:-translate-y-0.5 hover:shadow-xl">
                <p className="font-semibold">{r}</p>
                <p className="text-sm text-gold-300">{e}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-brand-900/10 dark:border-white/5">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} MarketLink Agri-Hub Pakistan</p>
          <nav className="flex gap-5">
            <Link href="/login" className="hover:text-brand-700 dark:hover:text-brand-400">Sign in</Link>
            <Link href="/admin-login" className="hover:text-brand-700 dark:hover:text-brand-400">Admin</Link>
            <Link href="/deploy" className="hover:text-brand-700 dark:hover:text-brand-400">Developers</Link>
          </nav>
        </div>
      </footer>
      {(!user || user.role === "buyer") && <ChatBot placement="public" userCity={user?.city} />}
    </div>
  );
}
