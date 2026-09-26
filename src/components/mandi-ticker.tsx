export type TickerItem = { crop: string; urdu: string; avg: number; change: number | null };

/** Horizontally scrolling live mandi rates strip (PKR per 40kg maund). */
export function MandiTicker({ items, variant = "light" }: { items: TickerItem[]; variant?: "light" | "dark" }) {
  if (!items.length) return null;
  const row = [...items, ...items];
  const dark = variant === "dark";
  return (
    <div className={`relative flex items-center overflow-hidden text-xs ${dark ? "bg-brand-950 text-white" : "border-b border-brand-900/10 bg-brand-50/70 text-slate-700 dark:border-white/5 dark:bg-brand-950/60 dark:text-slate-200"}`} dir="ltr">
      <span className={`z-10 flex shrink-0 items-center gap-1.5 px-3 py-1.5 font-bold tracking-wide uppercase ${dark ? "bg-gold-400 text-brand-950" : "bg-brand-900 text-white"}`}>
        <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" /></span>
        Live Mandi
      </span>
      <div className="flex overflow-hidden">
        <div className="animate-marquee flex shrink-0 gap-7 py-1.5 pl-6 whitespace-nowrap">
          {row.map((t, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className="font-semibold">{t.crop}</span>
              <span className="opacity-60">{t.urdu}</span>
              <span className="font-mono">Rs. {Math.round(t.avg * 40).toLocaleString("en-US")}/maund</span>
              {t.change !== null && (
                <span className={`font-semibold ${t.change >= 0 ? (dark ? "text-emerald-300" : "text-emerald-600") : "text-rose-500"}`}>
                  {t.change >= 0 ? "▲" : "▼"} {Math.abs(t.change).toFixed(1)}%
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
