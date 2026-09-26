"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n, useTheme } from "@/components/providers";

export type NavViewer = {
  fullName: string;
  role: "farmer" | "buyer" | "admin" | "inspector";
  walletBalance: number;
  escrowBalance: number;
  unread: number;
  dashboard: string;
  title: string | null;
  avatarUrl: string | null;
} | null;

type Notif = { notificationId: number; title: string; body: string | null; link: string | null; isRead: boolean; createdAt: string; type: string };

const ROLE_LABEL = { farmer: "Farmer", buyer: "Buyer", admin: "Admin", inspector: "Quality Inspector" };
const TYPE_ICON: Record<string, string> = { bid: "💬", bid_accepted: "🤝", escrow_locked: "🔐", shipment: "🚚", delivered: "🏁", inspection: "🔬", dispute: "⚖️", payment: "💳", payout: "💸", review: "⭐", review_reply: "💬", welcome: "👋", security: "🔒" };

const shortRs = (n: number) => (n >= 1e7 ? `${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `${(n / 1e5).toFixed(1)} Lakh` : Math.round(n).toLocaleString("en-US"));

function useOutside(ref: React.RefObject<HTMLElement | null>, onOut: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onOut();
    const k = (e: KeyboardEvent) => e.key === "Escape" && onOut();
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k);
    };
  }, [ref, onOut]);
}

export function NotificationBell({ initialUnread, tone = "light" }: { initialUnread: number; tone?: "light" | "dark" }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<Notif[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useOutside(ref, close);

  const load = useCallback(async () => {
    const r = await fetch("/api/notifications", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    if (r?.success) {
      setItems(r.data.items);
      setUnread(r.data.unread);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(load, 45_000);
    return () => clearInterval(id);
  }, [load]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) await load();
  }
  async function markAll() {
    await fetch("/api/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: "{}" });
    setUnread(0);
    setItems((xs) => xs?.map((x) => ({ ...x, isRead: true })) ?? null);
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`} aria-expanded={open}
        className={`relative grid h-9 w-9 place-items-center rounded-xl transition ${tone === "dark" ? "text-white/85 hover:bg-white/10" : "border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"}`}>
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
        {unread > 0 && <span className="absolute -top-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-950">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="animate-fade-in absolute right-0 z-50 mt-2 w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-white/10 dark:bg-[#0d1f16] dark:text-slate-100">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/5">
            <p className="text-sm font-bold">Notifications</p>
            {unread > 0 && <button onClick={markAll} className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-400">Mark all read</button>}
          </div>
          <ul className="max-h-[380px] divide-y divide-slate-100 overflow-y-auto dark:divide-white/5">
            {items === null && <li className="p-6 text-center text-sm text-slate-500">Loading…</li>}
            {items?.length === 0 && <li className="p-6 text-center text-sm text-slate-500">You&apos;re all caught up</li>}
            {items?.map((n) => (
              <li key={n.notificationId}>
                <Link href={n.link ?? "/notifications"} onClick={close} className={`flex gap-3 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-white/5 ${n.isRead ? "" : "bg-brand-50/60 dark:bg-brand-500/5"}`}>
                  <span className="text-lg leading-none">{TYPE_ICON[n.type] ?? "🔔"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{n.title}</span>
                    {n.body && <span className="line-clamp-2 block text-xs text-slate-500 dark:text-slate-400">{n.body}</span>}
                    <span className="mt-0.5 block text-[11px] text-slate-400">{new Date(n.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </span>
                  {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/notifications" onClick={close} className="block border-t border-slate-100 py-2.5 text-center text-xs font-semibold text-brand-700 hover:bg-slate-50 dark:border-white/5 dark:text-brand-400 dark:hover:bg-white/5">View all</Link>
        </div>
      )}
    </div>
  );
}

export function WalletChip({ balance, escrow, tone = "light" }: { balance: number; escrow: number; tone?: "light" | "dark" }) {
  return (
    <Link href="/wallet" title={`Available Rs. ${Math.round(balance).toLocaleString("en-US")} · In escrow Rs. ${Math.round(escrow).toLocaleString("en-US")}`}
      className={`hidden items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold sm:inline-flex ${tone === "dark" ? "bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/15" : "border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"}`}>
      <span aria-hidden>💰</span>
      <span className="tabular-nums">Rs. {shortRs(balance)}</span>
      {escrow > 0 && <span className={`tabular-nums ${tone === "dark" ? "text-gold-300" : "text-sky-600 dark:text-sky-400"}`}>· 🔐 {shortRs(escrow)}</span>}
    </Link>
  );
}

export function ProfileMenu({ viewer, tone = "light" }: { viewer: NonNullable<NavViewer>; tone?: "light" | "dark" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const { lang, setLang } = useI18n();
  const close = useCallback(() => setOpen(false), []);
  useOutside(ref, close);
  const initials = viewer.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("");

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-white/5";
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Account menu" className={`flex items-center gap-2 rounded-xl p-1 pr-2 transition ${tone === "dark" ? "hover:bg-white/10" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}>
        {viewer.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={viewer.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <span className="grid h-8 w-8 place-items-center rounded-full bg-gold-400 text-xs font-extrabold text-brand-950">{initials}</span>
        )}
        {viewer.role === "admin" && <span className={`hidden text-xs font-semibold md:inline ${tone === "dark" ? "text-white" : "text-slate-700 dark:text-slate-200"}`}>{viewer.fullName}</span>}
        <svg viewBox="0 0 20 20" className={`h-4 w-4 ${tone === "dark" ? "text-white/70" : "text-slate-400"}`} fill="currentColor"><path d="M5.2 7.2a.75.75 0 0 1 1.06 0L10 10.94l3.74-3.74a.75.75 0 1 1 1.06 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0L5.2 8.26a.75.75 0 0 1 0-1.06Z" /></svg>
      </button>
      {open && (
        <div className="animate-fade-in absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 text-slate-900 shadow-2xl dark:border-white/10 dark:bg-[#0d1f16] dark:text-slate-100">
          <div className="border-b border-slate-100 px-3 pt-1 pb-3 dark:border-white/5">
            <p className="truncate text-sm font-bold">{viewer.fullName}</p>
            <p className="text-xs text-slate-500">{viewer.role === "admin" ? (viewer.title ?? "Administrator") : ROLE_LABEL[viewer.role]}</p>
            {viewer.role === "admin" && <span className="mt-1.5 inline-flex rounded-full bg-gold-400 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-brand-950 uppercase">★ Super Admin</span>}
            {(viewer.role === "farmer" || viewer.role === "buyer") && (
              <p className="mt-2 rounded-lg bg-brand-50 px-2 py-1.5 text-xs text-brand-900 dark:bg-brand-500/10 dark:text-brand-200">Wallet: <b>Rs. {Math.round(viewer.walletBalance).toLocaleString("en-US")}</b></p>
            )}
          </div>
          <div className="py-1">
            <Link href={viewer.dashboard} onClick={close} className={item}>📊 Dashboard</Link>
            {(viewer.role === "farmer" || viewer.role === "buyer") && <Link href="/wallet" onClick={close} className={item}>💰 Escrow wallet</Link>}
            <Link href="/notifications" onClick={close} className={item}>🔔 Notifications {viewer.unread > 0 && <span className="ml-auto rounded-full bg-rose-600 px-1.5 text-[10px] font-bold text-white">{viewer.unread}</span>}</Link>
            <Link href="/account" onClick={close} className={item}>⚙️ Account settings</Link>
          </div>
          <div className="border-t border-slate-100 py-1 dark:border-white/5">
            <button onClick={toggle} className={item}>{theme === "dark" ? "☀️ Light mode" : "🌙 Dark mode"}</button>
            <button onClick={() => setLang(lang === "en" ? "ur" : "en")} className={item}>🌐 {lang === "en" ? "اردو" : "English"}</button>
            <button onClick={logout} className={`${item} text-rose-600`}>⎋ Sign out</button>
          </div>
        </div>
      )}
    </div>
  );
}
