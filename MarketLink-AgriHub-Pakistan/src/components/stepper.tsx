"use client";

import { DELIVERY_STAGES, stageIndex, type DeliveryStage } from "@/lib/constants";

const ICONS = ["📝", "🔬", "📦", "🚚", "🏁"];

export function LogisticsStepper({ stage, compact = false, disputed = false }: { stage: DeliveryStage; compact?: boolean; disputed?: boolean }) {
  const current = stageIndex(stage);
  return (
    <ol className="flex w-full items-start" aria-label="Delivery progress">
      {DELIVERY_STAGES.map((s, i) => {
        const done = i < current || (i === current && s.key === "delivered");
        const active = i === current && s.key !== "delivered";
        return (
          <li key={s.key} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && (
              <span
                className={`absolute top-4 right-1/2 h-1 w-full -translate-y-1/2 rounded ${
                  i <= current ? "bg-brand-500" : "bg-slate-200 dark:bg-slate-700"
                }`}
                aria-hidden
              />
            )}
            <span
              className={`relative z-10 grid place-items-center rounded-full border-2 transition ${compact ? "h-8 w-8 text-sm" : "h-9 w-9 text-base"} ${
                done
                  ? "border-brand-500 bg-brand-500 text-white"
                  : active
                    ? disputed
                      ? "border-rose-500 bg-rose-50 text-rose-600 ring-4 ring-rose-500/20 dark:bg-rose-950"
                      : "border-brand-500 bg-white text-brand-600 ring-4 ring-brand-500/20 dark:bg-slate-900"
                    : "border-slate-300 bg-white text-slate-400 dark:border-slate-600 dark:bg-slate-900"
              }`}
            >
              {done ? "✓" : ICONS[i]}
              {active && !disputed && <span className="absolute inset-0 animate-ping rounded-full border-2 border-brand-400 opacity-40" />}
            </span>
            <span
              className={`mt-2 px-0.5 text-[10px] leading-tight font-semibold sm:text-xs ${
                i <= current ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"
              }`}
            >
              {compact ? s.short : s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
