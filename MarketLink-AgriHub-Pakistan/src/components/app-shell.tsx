"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useI18n } from "@/components/providers";
import { MandiTicker, type TickerItem } from "@/components/mandi-ticker";
import { Logo } from "@/components/Logo";
import { NotificationBell, ProfileMenu, WalletChip, type NavViewer } from "@/components/nav/nav-actions";
import { ChatBot } from "@/components/ChatBot";
import { CITIES, type Role } from "@/lib/constants";

type NavItem = { href: string; key: string; icon: string };
const NAV: Record<Role, NavItem[]> = {
  farmer: [
    { href: "/farmer/dashboard", key: "dashboard", icon: "📊" },
    { href: "/farmer/listings", key: "listings", icon: "🌾" },
    { href: "/farmer/bids", key: "negotiations", icon: "🤝" },
    { href: "/farmer/orders", key: "orders", icon: "🚚" },
    { href: "/wallet", key: "wallet", icon: "💰" },
    { href: "/farmer/reviews", key: "reviews", icon: "⭐" },
    { href: "/mandi-rates", key: "mandi", icon: "📈" },
  ],
  buyer: [
    { href: "/buyer/dashboard", key: "dashboard", icon: "📊" },
    { href: "/marketplace", key: "marketplace", icon: "🛒" },
    { href: "/buyer/bids", key: "myBids", icon: "📝" },
    { href: "/buyer/orders", key: "logistics", icon: "🚚" },
    { href: "/wallet", key: "wallet", icon: "🔐" },
    { href: "/mandi-rates", key: "mandi", icon: "📈" },
  ],
  inspector: [
    { href: "/inspector/dashboard", key: "inspections", icon: "🔬" },
    { href: "/tracking", key: "tracking", icon: "📍" },
    { href: "/mandi-rates", key: "mandi", icon: "📈" },
  ],
  admin: [
    { href: "/admin/dashboard", key: "analytics", icon: "📊" },
    { href: "/admin/orders", key: "disputes", icon: "⚖️" },
    { href: "/admin/users", key: "users", icon: "👥" },
    { href: "/admin/verification", key: "verification", icon: "🛡️" },
    { href: "/admin/mandi", key: "priceController", icon: "💹" },
    { href: "/inspector/dashboard", key: "inspections", icon: "🔬" },
    { href: "/admin/db-explorer", key: "dbExplorer", icon: "🗄️" },
  ],
};

const ROLE_LABEL: Record<Role, { en: string; ur: string }> = {
  farmer: { en: "Kisan · Seller", ur: "کسان" },
  buyer: { en: "Buyer · Wholesaler", ur: "خریدار" },
  inspector: { en: "Quality Inspector", ur: "کوالٹی انسپکٹر" },
  admin: { en: "Administrator", ur: "ایڈمن" },
};

export type ShellUser = { fullName: string; role: Role; businessName: string | null; isVerified: boolean; city: string; title: string | null; avatarUrl: string | null; userCode: string | null };

function PKClock() {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const tick = () =>
      setNow(new Date().toLocaleString("en-GB", { timeZone: "Asia/Karachi", weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);
  return <span suppressHydrationWarning>{now} PKT</span>;
}

export function AppShell({ user, ticker, viewer, children }: { user: ShellUser; ticker: TickerItem[]; viewer: NavViewer; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, t } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = NAV[user.role];
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const province = CITIES[user.city]?.province;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const navList = (onClick?: () => void) => (
    <nav className="flex flex-col gap-1">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          onClick={onClick}
          className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
            isActive(it.href) ? "bg-white text-brand-900 shadow-lg shadow-black/20" : "text-white/75 hover:bg-white/10 hover:text-white"
          }`}
        >
          <span className={`grid h-8 w-8 place-items-center rounded-lg text-base ${isActive(it.href) ? "bg-brand-50" : "bg-white/10"}`}>{it.icon}</span>
          {t(it.key)}
          {isActive(it.href) && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-gold-400" />}
        </Link>
      ))}
      <div className="my-3 h-px bg-white/10" />
      <Link href="/account" onClick={onClick} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium ${pathname.startsWith("/account") ? "bg-white text-brand-900" : "text-white/60 hover:bg-white/10 hover:text-white"}`}>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/5">⚙️</span>
        {t("account")}
      </Link>
    </nav>
  );

  const initials = user.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("");

  const sidebarInner = (onClick?: () => void) => (
    <>
      <Brand light />
      <div className="mt-6 flex-1 overflow-y-auto">{navList(onClick)}</div>
      <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
        <div className="flex items-center gap-3">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-10 w-10 rounded-full object-cover ring-2 ring-gold-400" />
          ) : (
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gold-400 text-sm font-extrabold text-brand-950">{initials}</div>
          )}
          <div className="min-w-0 text-white">
            <p className="truncate text-sm font-semibold">{user.fullName}</p>
            <p className="truncate text-xs text-white/60" title={user.userCode ? `ID ${user.userCode}` : undefined}>{user.role === "admin" ? (user.title ?? ROLE_LABEL.admin[lang]) : ROLE_LABEL[user.role][lang]}</p>
            {user.role === "admin" && <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-gold-400 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-brand-950 uppercase">★ Super Admin</span>}
          </div>
        </div>
        <button onClick={logout} className="mt-3 w-full rounded-lg bg-white/10 py-1.5 text-xs font-semibold text-white hover:bg-white/20">
          ⎋ {t("logout")}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[270px_1fr]">
      <aside className="pk-pattern sticky top-0 hidden h-screen flex-col bg-gradient-to-b from-brand-900 via-brand-900 to-brand-950 p-4 lg:flex">
        {sidebarInner()}
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col">
        <div className="sticky top-0 z-40">
          <header className="flex items-center gap-2 border-b border-brand-900/10 bg-white/90 px-4 py-2.5 backdrop-blur sm:px-6 dark:border-white/5 dark:bg-[#07130d]/90">
            <button className="rounded-lg p-2 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div className="lg:hidden"><Brand small /></div>
            <div className="hidden min-w-0 lg:block">
              <p className="truncate text-sm">
                <span className="font-semibold text-brand-800 dark:text-brand-300">{lang === "ur" ? "السلام علیکم" : "Assalam-o-Alaikum"}, {user.fullName.split(" ")[0]}</span>
                <span className="text-slate-500 dark:text-slate-400">
                  {user.businessName && <> · {user.businessName}</>} · 📍 {user.city}{province ? `, ${province}` : ""}
                </span>
                {user.role === "admin" ? (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-gold-400 px-2 py-0.5 text-xs font-bold text-brand-950">★ Super Admin · {user.title ?? "Platform Manager"}</span>
                ) : user.isVerified ? (
                  <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">✔ {t("verified")}</span>
                ) : user.role === "farmer" ? (
                  <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">⏳ Verification pending</span>
                ) : null}
              </p>
              <p className="text-xs text-slate-400"><PKClock /> · 🇵🇰 Pakistan</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <nav className="mr-2 hidden items-center gap-1 xl:flex" aria-label="Site">
                {[["/", "Home"], ["/marketplace", "Marketplace"], ["/mandi-rates", "Mandi Rates"], ["/tracking", "Tracking"]].map(([href, label]) => (
                  <Link key={href} href={href} className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">{label}</Link>
                ))}
              </nav>
              {viewer && (viewer.role === "farmer" || viewer.role === "buyer") && <WalletChip balance={viewer.walletBalance} escrow={viewer.escrowBalance} />}
              {viewer && <NotificationBell initialUnread={viewer.unread} />}
              {viewer && <ProfileMenu viewer={viewer} />}
            </div>
          </header>
          <MandiTicker items={ticker} />
        </div>

        <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-10">{children}</main>

        <nav className="fixed inset-x-0 bottom-0 z-40 grid border-t border-white/10 bg-brand-900 lg:hidden" style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 5)}, minmax(0, 1fr))` }}>
          {items.slice(0, 5).map((it) => (
            <Link key={it.href} href={it.href} className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${isActive(it.href) ? "text-gold-400" : "text-white/70"}`}>
              <span className="text-lg">{it.icon}</span>
              <span className="truncate px-1">{t(it.key)}</span>
            </Link>
          ))}
        </nav>
      </div>

      {user.role === "buyer" && <ChatBot placement="app" userCity={user.city} />}

      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="pk-pattern animate-fade-in relative flex h-full w-72 flex-col bg-brand-900 p-4" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setMobileOpen(false)} className="mb-2 self-end rounded-lg p-1 text-white/70 hover:bg-white/10">✕</button>
            {sidebarInner(() => setMobileOpen(false))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Brand({ small = false, light = false }: { small?: boolean; light?: boolean }) {
  return (
    <Link href="/" className="inline-flex rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-400" aria-label="MarketLink home">
      <Logo size={small ? 30 : 38} tone={light ? "light" : "auto"} tagline={!small} />
    </Link>
  );
}
