import Link from "next/link";
import { Brand } from "@/components/app-shell";
import { API_GROUPS, ERD, MYSQL_DDL, WORKFLOWS } from "@/lib/docs-content";
import { POSTGRES_DDL } from "@/lib/ddl-postgres";
import { DdlTabs } from "./ddl-tabs";

export const metadata = { title: "API & Schema" };

const METHOD_STYLE: Record<string, string> = {
  GET: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  POST: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  PATCH: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  DELETE: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
};

export default function DocsPage() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Brand />
          <nav className="flex gap-1 text-sm">
            {["erd", "ddl", "api", "workflows"].map((s) => (
              <a key={s} href={`#${s}`} className="hidden rounded-lg px-3 py-1.5 font-medium text-slate-600 uppercase hover:bg-slate-100 sm:block dark:text-slate-300 dark:hover:bg-slate-800">{s}</a>
            ))}
            <Link href="/login" className="btn-primary ml-2 py-1.5">Open app</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-14 px-4 py-10 sm:px-6">
        <section>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Technical Specification</h1>
          <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-400">
            Architecture: Next.js App Router (React 19 + Tailwind CSS) front-end · Route Handlers as a REST API layer · service modules containing business logic with transactional row locking · PostgreSQL via Drizzle ORM · Recharts for visualization. All responses follow <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">{`{ success, data | error }`}</code>.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            {[["Presentation", "React Server + Client Components, Tailwind, dark mode, EN/اردو"], ["API", "REST route handlers · RBAC via signed session cookie"], ["Domain", "Bids state machine · escrow ledger · logistics · mandi sync"], ["Data", "PostgreSQL · 9 tables · FKs, enums, unique & secondary indexes"]].map(([t, d]) => (
              <div key={t} className="card p-4"><p className="text-xs font-bold tracking-wider text-brand-600 uppercase">{t}</p><p className="mt-1 text-sm">{d}</p></div>
            ))}
          </div>
        </section>

        <section id="erd">
          <h2 className="text-2xl font-bold">1 · Entity Relationship Diagram</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <pre className="card overflow-x-auto p-5 text-xs leading-6">{ERD}</pre>
            <div className="card grid grid-cols-2 gap-2 p-5 text-xs sm:grid-cols-3">
              {["users", "crops_inventory", "mandi_rates", "bids_negotiations", "orders_logistics", "quality_inspections", "order_events", "wallet_transactions", "disputes"].map((t, i) => (
                <div key={t} className={`rounded-xl border p-3 font-mono ${i < 6 ? "border-brand-300 bg-brand-50 dark:border-brand-800 dark:bg-brand-950/30" : "border-slate-200 dark:border-slate-700"}`}>
                  <p className="font-bold">{t}</p>
                  <p className="mt-1 text-[10px] text-slate-500">{i < 6 ? "SRS core" : "supporting"}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="ddl">
          <h2 className="text-2xl font-bold">2 · Database DDL</h2>
          <p className="mt-1 text-sm text-slate-500">PostgreSQL DDL is generated directly from the Drizzle schema (<code>src/db/schema.ts</code>) and is what runs in production. A MySQL 8 equivalent is provided for portability. Files: <code>database/schema.sql</code>, <code>database/mysql_schema.sql</code>.</p>
          <DdlTabs postgres={POSTGRES_DDL} mysql={MYSQL_DDL} />
        </section>

        <section id="api">
          <h2 className="text-2xl font-bold">3 · REST API Endpoints</h2>
          <p className="mt-1 text-sm text-slate-500">Auth: httpOnly HMAC-signed <code>ml_session</code> cookie. Errors: 400 bad JSON · 401 unauthenticated · 403 wrong role/ownership · 404 · 409 invalid state transition · 402 insufficient funds · 422 validation.</p>
          <div className="mt-5 space-y-8">
            {API_GROUPS.map((g) => (
              <div key={g.name}>
                <h3 className="mb-3 text-lg font-semibold">{g.name}</h3>
                <div className="space-y-3">
                  {g.endpoints.map((e) => (
                    <details key={e.method + e.path} className="card group overflow-hidden">
                      <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3">
                        <span className={`badge w-16 justify-center font-mono ${METHOD_STYLE[e.method]}`}>{e.method}</span>
                        <code className="text-sm font-semibold break-all">{e.path}</code>
                        <span className="ml-auto text-xs text-slate-500">{e.roles}</span>
                      </summary>
                      <div className="space-y-3 border-t border-slate-100 px-4 py-3 text-sm dark:border-slate-800">
                        <p>{e.desc}</p>
                        {e.request && (<div><p className="label">Request body</p><pre className="overflow-x-auto rounded-xl bg-slate-950 p-3 text-xs text-emerald-300">{e.request}</pre></div>)}
                        {e.response && (<div><p className="label">Response</p><pre className="overflow-x-auto rounded-xl bg-slate-950 p-3 text-xs text-sky-300">{e.response}</pre></div>)}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="workflows">
          <h2 className="text-2xl font-bold">4 · Business Logic Workflows</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {WORKFLOWS.map((w) => (
              <div key={w.title} className="card p-5">
                <h3 className="font-semibold">{w.icon} {w.title}</h3>
                <ol className="mt-3 space-y-2">
                  {w.steps.map((s, i) => (
                    <li key={i} className="flex gap-3 text-sm text-slate-600 dark:text-slate-300">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">{i + 1}</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
          <div className="card mt-4 overflow-x-auto p-5">
            <p className="label">Bid state machine</p>
            <pre className="text-xs leading-6">{`pending ──farmer:accept──────────▶ accepted ──▶ order(awaiting_escrow)
pending ──farmer:counter─────────▶ countered ──buyer:accept_counter──▶ accepted
pending ──farmer:reject──────────▶ rejected    countered ──buyer:reject_counter──▶ rejected
pending|countered ──buyer:withdraw▶ withdrawn  countered ──buyer:revise──▶ pending

order: confirmed ─(escrow_locked)─▶ quality_checked[admin] ─▶ dispatched[farmer] ─▶ in_transit[farmer] ─▶ delivered[buyer ⇒ escrow released]
                      any locked stage ──dispute──▶ disputed ──admin──▶ released | refunded`}</pre>
          </div>
        </section>
      </main>
    </div>
  );
}
