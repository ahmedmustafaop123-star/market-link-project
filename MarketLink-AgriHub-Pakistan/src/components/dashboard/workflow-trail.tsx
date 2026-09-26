import Link from "next/link";

type Step = {
  label: string;
  detail: string;
  href: string;
  /** Number of items that need the user's attention at this step. */
  pending?: number;
};

/** A compact, role-specific map from the user's task to the next marketplace module. */
export function WorkflowTrail({ title = "Trading workflow", steps }: { title?: string; steps: Step[] }) {
  return (
    <section className="card p-4 sm:p-5" aria-label={title}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold text-brand-950 dark:text-white">{title}</h2>
        <span className="hidden text-[10px] font-semibold tracking-widest text-brand-700 uppercase sm:block dark:text-gold-400">MARKETLINK AGRI-HUB</span>
      </div>
      <ol className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {steps.map((step, index) => (
          <li key={step.label} className="relative min-w-[152px] flex-1">
            <Link href={step.href} className="group flex h-full flex-col rounded-xl border border-slate-200 bg-slate-50/70 p-3 transition hover:border-brand-400 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:bg-brand-950/30">
              <div className="flex items-center justify-between gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-brand-900 text-[10px] font-bold text-white">{String(index + 1).padStart(2, "0")}</span>
                {step.pending ? <span className="rounded-full bg-gold-400 px-2 py-0.5 text-[10px] font-bold text-brand-950">{step.pending} pending</span> : null}
              </div>
              <span className="mt-2 text-xs font-bold text-slate-900 group-hover:text-brand-800 dark:text-slate-100 dark:group-hover:text-gold-300">{step.label} <span aria-hidden>→</span></span>
              <span className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{step.detail}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
