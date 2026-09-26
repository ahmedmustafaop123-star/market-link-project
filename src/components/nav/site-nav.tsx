"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { NotificationBell, ProfileMenu, WalletChip, type NavViewer } from "@/components/nav/nav-actions";
import { useTheme } from "@/components/providers";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/mandi-rates", label: "Mandi Rates" },
  { href: "/tracking", label: "Tracking" },
];

/** Public top navigation: auth-aware (dashboard link, wallet, notifications, profile) and responsive. */
export function SiteNav({ viewer, transparent = false }: { viewer: NavViewer; transparent?: boolean }) {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOpen(false), [pathname]);

  const glass = transparent && !scrolled && !open;
  const tone = glass ? "dark" : "light";
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const links = viewer ? [...LINKS, { href: viewer.dashboard, label: "Dashboard" }] : LINKS;

  return (
    <header className={`${transparent ? "fixed" : "sticky"} inset-x-0 top-0 z-40 transition-colors duration-300 ${glass ? "bg-transparent" : "border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-white/5 dark:bg-[#07130d]/90"}`}>
      <nav className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6" aria-label="Main">
        <Link href="/" aria-label="MarketLink home" className="shrink-0"><Logo size={34} tone={glass ? "light" : "auto"} tagline={false} /></Link>

        <ul className="ml-4 hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} aria-current={active(l.href) ? "page" : undefined}
                className={`relative rounded-lg px-3 py-2 text-sm font-medium transition ${glass ? (active(l.href) ? "text-white" : "text-white/75 hover:text-white") : active(l.href) ? "text-brand-800 dark:text-white" : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"}`}>
                {l.label}
                {active(l.href) && <span className={`absolute inset-x-3 -bottom-[1px] h-0.5 rounded-full ${glass ? "bg-gold-400" : "bg-brand-600"}`} />}
              </Link>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2">
          {viewer ? (
            <>
              {(viewer.role === "farmer" || viewer.role === "buyer") && <WalletChip balance={viewer.walletBalance} escrow={viewer.escrowBalance} tone={tone} />}
              <NotificationBell initialUnread={viewer.unread} tone={tone} />
              <ProfileMenu viewer={viewer} tone={tone} />
            </>
          ) : (
            <>
              <button onClick={toggle} aria-label="Toggle theme" className={`hidden h-9 w-9 place-items-center rounded-xl sm:grid ${glass ? "text-white/80 hover:bg-white/10" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}>{theme === "dark" ? "☀️" : "🌙"}</button>
              <Link href="/login" className={`hidden rounded-xl px-3.5 py-2 text-sm font-semibold sm:block ${glass ? "text-white hover:bg-white/10" : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"}`}>Log in</Link>
              <Link href="/register" className="btn bg-gold-400 text-brand-950 hover:bg-gold-300">Register</Link>
            </>
          )}
          <button onClick={() => setOpen((v) => !v)} className={`grid h-9 w-9 place-items-center rounded-xl lg:hidden ${glass ? "text-white hover:bg-white/10" : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"}`} aria-label="Menu" aria-expanded={open}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">{open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
          </button>
        </div>
      </nav>

      {open && (
        <div className="animate-fade-in border-t border-slate-200 bg-white px-4 pb-4 lg:hidden dark:border-white/5 dark:bg-[#07130d]">
          <ul className="grid gap-1 pt-3">
            {links.map((l) => (
              <li key={l.href}><Link href={l.href} className={`block rounded-xl px-3 py-2.5 text-sm font-medium ${active(l.href) ? "bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200" : "text-slate-700 dark:text-slate-200"}`}>{l.label}</Link></li>
            ))}
          </ul>
          {!viewer && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link href="/login" className="btn-secondary">Log in</Link>
              <Link href="/register" className="btn-primary">Register</Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
