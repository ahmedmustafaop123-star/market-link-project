"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/* ---------------- Theme ---------------- */
type Theme = "light" | "dark";
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({ theme: "light", toggle: () => {} });
export const useTheme = () => useContext(ThemeCtx);

/* ---------------- i18n (English / Urdu placeholder) ---------------- */
export type Lang = "en" | "ur";
const DICT: Record<string, { en: string; ur: string }> = {
  dashboard: { en: "Dashboard", ur: "ڈیش بورڈ" },
  listings: { en: "My Listings", ur: "میری فصلیں" },
  negotiations: { en: "Negotiation Hub", ur: "مذاکرات" },
  orders: { en: "Orders", ur: "آرڈرز" },
  mandi: { en: "Mandi Insights", ur: "منڈی ریٹس" },
  marketplace: { en: "Marketplace", ur: "منڈی بازار" },
  myBids: { en: "My Bids & RFQs", ur: "میری بولیاں" },
  reviews: { en: "Buyer reviews", ur: "خریدار کے تجزیے" },
  logistics: { en: "Order Tracker", ur: "ترسیل" },
  wallet: { en: "Escrow Wallet", ur: "والٹ" },
  analytics: { en: "Analytics", ur: "تجزیات" },
  verification: { en: "Verification", ur: "تصدیق" },
  priceController: { en: "Price Controller", ur: "قیمت کنٹرول" },
  disputes: { en: "Orders", ur: "آرڈرز" },
  apiDocs: { en: "API & Schema", ur: "API دستاویز" },
  logout: { en: "Sign out", ur: "لاگ آؤٹ" },
  users: { en: "Users & Access", ur: "صارفین" },
  inspections: { en: "Inspections", ur: "معائنہ" },
  tracking: { en: "Tracking", ur: "ٹریکنگ" },
  dbExplorer: { en: "Database", ur: "ڈیٹا بیس" },
  account: { en: "Account settings", ur: "اکاؤنٹ" },
  welcome: { en: "Welcome back", ur: "خوش آمدید" },
  tagline: { en: "Farm-gate to market, no middlemen.", ur: "کھیت سے منڈی تک، بغیر آڑھتی کے" },
  placeBid: { en: "Place Bid", ur: "بولی لگائیں" },
  accept: { en: "Accept", ur: "قبول" },
  reject: { en: "Reject", ur: "مسترد" },
  counter: { en: "Counter", ur: "جوابی پیشکش" },
  newListing: { en: "New Listing", ur: "نئی فصل" },
  verified: { en: "Verified", ur: "تصدیق شدہ" },
};
const LangCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string }>({
  lang: "en",
  setLang: () => {},
  t: (k) => k,
});
export const useI18n = () => useContext(LangCtx);

/* ---------------- Toasts ---------------- */
type Toast = { id: number; kind: "success" | "error" | "info"; title: string; body?: string };
const ToastCtx = createContext<{ push: (t: Omit<Toast, "id">) => void }>({ push: () => {} });
export const useToast = () => useContext(ToastCtx);

export function Providers({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [lang, setLangState] = useState<Lang>("en");
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    const l = (localStorage.getItem("ml-lang") as Lang) || "en";
    setLangState(l);
    document.documentElement.lang = l;
    document.documentElement.dir = l === "ur" ? "rtl" : "ltr";
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      localStorage.setItem("ml-theme", next);
      return next;
    });
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem("ml-lang", l);
    document.documentElement.lang = l;
    document.documentElement.dir = l === "ur" ? "rtl" : "ltr";
  }, []);

  const t = useCallback((k: string) => DICT[k]?.[lang] ?? k, [lang]);

  const push = useCallback((toast: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts, { ...toast, id }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 4200);
  }, []);

  return (
    <ThemeCtx.Provider value={{ theme, toggle }}>
      <LangCtx.Provider value={{ lang, setLang, t }}>
        <ToastCtx.Provider value={{ push }}>
          {children}
          <div className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2" dir="ltr">
            {toasts.map((x) => (
              <div
                key={x.id}
                className={`animate-fade-in pointer-events-auto rounded-xl border p-3 shadow-lg backdrop-blur ${
                  x.kind === "success"
                    ? "border-emerald-200 bg-emerald-50/95 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-100"
                    : x.kind === "error"
                      ? "border-rose-200 bg-rose-50/95 text-rose-900 dark:border-rose-800 dark:bg-rose-950/90 dark:text-rose-100"
                      : "border-sky-200 bg-sky-50/95 text-sky-900 dark:border-sky-800 dark:bg-sky-950/90 dark:text-sky-100"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg leading-none">{x.kind === "success" ? "✅" : x.kind === "error" ? "⚠️" : "ℹ️"}</span>
                  <div>
                    <p className="text-sm font-semibold">{x.title}</p>
                    {x.body && <p className="mt-0.5 text-xs opacity-80">{x.body}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ToastCtx.Provider>
      </LangCtx.Provider>
    </ThemeCtx.Provider>
  );
}
