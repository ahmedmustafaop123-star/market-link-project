"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, PageHeader, Spinner } from "@/components/ui";
import { useToast } from "@/components/providers";

type Column = { name: string; type: string; nullable: boolean; default: string | null; pk: boolean; fk: string | null };
type Table = { name: string; rows: number; columns: Column[]; indexes: { name: string; def: string }[] };
type Schema = { engine: string; tables: Table[]; audit: { id: number; mode: string; query: string; durationMs: number | null; error: string | null; at: string; admin: string | null }[] };
type Result = { columns: string[]; rows: (string | number | boolean | null)[][]; rowCount: number; affected: number; truncated: boolean; command: string; durationMs: number };

const SAMPLES: { label: string; sql: string }[] = [
  { label: "Top sellers by trust", sql: "SELECT id, full_name, business_name, city, trust_score, rating_avg, rating_count\nFROM users WHERE role = 'farmer'\nORDER BY trust_score DESC" },
  { label: "Revenue by month", sql: "SELECT to_char(created_at, 'YYYY-MM') AS month, count(*) AS orders, sum(total_amount) AS volume_pkr\nFROM orders_logistics WHERE payment_status <> 'refunded'\nGROUP BY 1 ORDER BY 1 DESC" },
  { label: "Escrow exposure", sql: "SELECT payment_status, count(*) AS orders, sum(total_amount) AS amount_pkr\nFROM orders_logistics GROUP BY 1 ORDER BY 3 DESC" },
  { label: "Open disputes", sql: "SELECT d.dispute_id, o.tracking_number, d.status, d.reason, d.created_at\nFROM disputes d JOIN orders_logistics o ON o.order_id = d.order_id\nWHERE d.status IN ('open','investigating')" },
  { label: "Latest reviews", sql: "SELECT r.rating, r.comment, u.business_name AS seller, r.created_at\nFROM reviews r JOIN users u ON u.id = r.farmer_id\nORDER BY r.created_at DESC LIMIT 20" },
  { label: "Pending payments", sql: "SELECT reference, provider, amount, status, created_at FROM payment_intents ORDER BY created_at DESC LIMIT 50" },
];

export default function DbExplorerPage() {
  const { push } = useToast();
  const [schema, setSchema] = useState<Schema | null>(null);
  const [filter, setFilter] = useState("");
  const [openTable, setOpenTable] = useState<string | null>(null);
  const [sqlText, setSqlText] = useState(SAMPLES[0].sql);
  const [mode, setMode] = useState<"read" | "write">("read");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"results" | "schema" | "audit">("results");

  const loadSchema = useCallback(() => api<Schema>("/api/db/schema").then(setSchema).catch((e) => push({ kind: "error", title: (e as Error).message })), [push]);
  useEffect(() => { loadSchema(); }, [loadSchema]);

  const run = useCallback(async (q = sqlText, m = mode) => {
    if (m === "write" && !confirm("Run this WRITE statement against the live database? This is audited and cannot be undone.")) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<Result>("/api/db/query", { method: "POST", json: { sql: q, mode: m, confirm: m === "write" } });
      setResult(r);
      setTab("results");
      if (m === "write") { push({ kind: "success", title: `${r.command} · ${r.affected} row(s) affected` }); loadSchema(); }
    } catch (e) {
      setError((e as Error).message);
      setResult(null);
      setTab("results");
    } finally {
      setBusy(false);
    }
  }, [sqlText, mode, push, loadSchema]);

  function browse(t: Table) {
    const pk = t.columns.find((c) => c.pk)?.name;
    const q = `SELECT * FROM "${t.name}"${pk ? ` ORDER BY "${pk}" DESC` : ""} LIMIT 100`;
    setSqlText(q);
    setMode("read");
    run(q, "read");
  }

  function exportCsv() {
    if (!result) return;
    const esc = (v: unknown) => (v === null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const csv = [result.columns.join(","), ...result.rows.map((r) => r.map(esc).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `query-${Date.now()}.csv`;
    a.click();
  }

  const tables = useMemo(() => (schema?.tables ?? []).filter((t) => t.name.includes(filter.toLowerCase())), [schema, filter]);
  const selected = schema?.tables.find((t) => t.name === openTable);

  return (
    <div className="space-y-5">
      <PageHeader title="Database Explorer" urdu="ڈیٹا بیس" subtitle={schema ? `${schema.engine} · ${schema.tables.length} tables · every query is audited` : "Loading schema…"} />

      <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
        {/* Schema tree */}
        <aside className="card h-fit overflow-hidden xl:sticky xl:top-24">
          <div className="border-b border-slate-100 p-3 dark:border-white/5"><input className="input" placeholder="Filter tables…" value={filter} onChange={(e) => setFilter(e.target.value)} /></div>
          <ul className="max-h-[60vh] overflow-y-auto p-2 text-sm">
            {tables.map((t) => (
              <li key={t.name}>
                <div className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 ${openTable === t.name ? "bg-brand-50 dark:bg-brand-500/10" : "hover:bg-slate-50 dark:hover:bg-white/5"}`}>
                  <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => { setOpenTable(openTable === t.name ? null : t.name); setTab("schema"); }}>
                    <span className="text-xs text-slate-400">{openTable === t.name ? "▾" : "▸"}</span>
                    <span className="truncate font-mono text-xs font-semibold">{t.name}</span>
                  </button>
                  <span className="text-[10px] text-slate-400 tabular-nums">{t.rows.toLocaleString()}</span>
                  <button onClick={() => browse(t)} className="rounded px-1.5 text-[10px] font-bold text-brand-700 opacity-0 group-hover:opacity-100 hover:bg-brand-100 dark:text-brand-300" title="Browse rows">▶</button>
                </div>
                {openTable === t.name && (
                  <ul className="mb-1 ml-6 border-l border-slate-200 pl-2 dark:border-white/10">
                    {t.columns.map((c) => (
                      <li key={c.name} className="flex items-center gap-1.5 py-0.5 font-mono text-[11px]">
                        <span className={c.pk ? "text-gold-500" : c.fk ? "text-sky-600" : "text-slate-400"}>{c.pk ? "🔑" : c.fk ? "🔗" : "·"}</span>
                        <span className="truncate">{c.name}</span>
                        <span className="ml-auto shrink-0 text-slate-400">{c.type}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </aside>

        <div className="min-w-0 space-y-4">
          {/* Editor */}
          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5 dark:border-white/5">
              <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs font-semibold dark:border-white/10" role="group" aria-label="Mode">
                <button onClick={() => setMode("read")} className={`rounded-md px-3 py-1 ${mode === "read" ? "bg-brand-900 text-white" : "text-slate-500"}`}>🔒 Read-only</button>
                <button onClick={() => setMode("write")} className={`rounded-md px-3 py-1 ${mode === "write" ? "bg-rose-600 text-white" : "text-slate-500"}`}>✏️ Write</button>
              </div>
              <select className="input w-auto py-1 text-xs" value="" onChange={(e) => { const s = SAMPLES.find((x) => x.label === e.target.value); if (s) { setSqlText(s.sql); setMode("read"); } }} aria-label="Sample queries">
                <option value="">Sample queries…</option>
                {SAMPLES.map((s) => <option key={s.label}>{s.label}</option>)}
              </select>
              <span className="ml-auto hidden text-[11px] text-slate-400 sm:block">Ctrl + Enter to run</span>
              <button className={mode === "write" ? "btn-danger py-1.5" : "btn-primary py-1.5"} disabled={busy || !sqlText.trim()} onClick={() => run()}>{busy ? <Spinner /> : "▶"} Run</button>
            </div>
            <textarea value={sqlText} onChange={(e) => setSqlText(e.target.value)} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); run(); } }}
              spellCheck={false} rows={7} aria-label="SQL query"
              className={`block w-full resize-y bg-brand-950 p-4 font-mono text-[13px] leading-6 text-emerald-100 outline-none ${mode === "write" ? "ring-2 ring-rose-500 ring-inset" : ""}`} />
            {mode === "write" && <p className="bg-rose-50 px-4 py-2 text-xs text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">Write mode: INSERT / UPDATE / DELETE / DDL run for real after confirmation. Dangerous statements (DROP DATABASE, GRANT, file access…) are blocked.</p>}
          </section>

          {/* Output */}
          <section className="card overflow-hidden">
            <div className="flex items-center gap-1 border-b border-slate-100 px-3 pt-2 dark:border-white/5">
              {(["results", "schema", "audit"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`rounded-t-lg px-3 py-2 text-xs font-semibold capitalize ${tab === t ? "border-b-2 border-brand-600 text-brand-800 dark:text-brand-300" : "text-slate-500"}`}>{t === "schema" ? `Schema${selected ? ` · ${selected.name}` : ""}` : t === "audit" ? "Audit log" : "Results"}</button>
              ))}
              {tab === "results" && result && (
                <div className="ml-auto flex items-center gap-3 pb-1 text-[11px] text-slate-500">
                  <span>{result.command} · {result.rowCount} row(s){result.truncated ? " (first 500 shown)" : ""} · {result.durationMs} ms</span>
                  {result.rows.length > 0 && <button onClick={exportCsv} className="rounded-md border border-slate-200 px-2 py-0.5 font-semibold hover:bg-slate-50 dark:border-white/10">⬇ CSV</button>}
                </div>
              )}
            </div>
            {tab === "results" && (
              error ? <pre className="m-4 overflow-x-auto rounded-xl bg-rose-50 p-4 text-xs whitespace-pre-wrap text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">{error}</pre>
              : !result ? <p className="p-8 text-center text-sm text-slate-500">Run a query or click ▶ next to a table to browse its rows.</p>
              : result.columns.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">{result.command} completed · {result.affected} row(s) affected.</p>
              : (
                <div className="max-h-[520px] overflow-auto">
                  <table className="w-full font-mono text-xs">
                    <thead className="table-head sticky top-0"><tr><th className="px-3 py-2 text-slate-400">#</th>{result.columns.map((c) => <th key={c} className="px-3 py-2 whitespace-nowrap normal-case">{c}</th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {result.rows.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                          <td className="px-3 py-1.5 text-slate-400">{i + 1}</td>
                          {r.map((v, j) => <td key={j} className={`max-w-[320px] truncate px-3 py-1.5 whitespace-nowrap ${v === null ? "text-slate-400 italic" : typeof v === "number" ? "text-right tabular-nums" : ""}`} title={v === null ? "NULL" : String(v)}>{v === null ? "NULL" : String(v)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
            {tab === "schema" && (
              !selected ? <p className="p-8 text-center text-sm text-slate-500">Select a table on the left to inspect its structure.</p> : (
                <div className="space-y-4 p-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="table-head"><tr><th className="px-3 py-2">Column</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Null</th><th className="px-3 py-2">Default</th><th className="px-3 py-2">Key</th></tr></thead>
                      <tbody className="divide-y divide-slate-100 font-mono dark:divide-white/5">
                        {selected.columns.map((c) => (
                          <tr key={c.name}><td className="px-3 py-1.5 font-semibold">{c.name}</td><td className="px-3 py-1.5">{c.type}</td><td className="px-3 py-1.5">{c.nullable ? "YES" : "NO"}</td><td className="max-w-[220px] truncate px-3 py-1.5 text-slate-500">{c.default ?? ""}</td><td className="px-3 py-1.5">{c.pk ? "PK" : c.fk ? `FK → ${c.fk}` : ""}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <p className="label">Indexes</p>
                    <ul className="space-y-1 font-mono text-[11px] text-slate-600 dark:text-slate-400">{selected.indexes.map((i) => <li key={i.name}>{i.def}</li>)}</ul>
                  </div>
                </div>
              )
            )}
            {tab === "audit" && (
              <ul className="max-h-[520px] divide-y divide-slate-100 overflow-y-auto text-xs dark:divide-white/5">
                {schema?.audit.map((a) => (
                  <li key={a.id} className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${a.mode === "write" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"}`}>{a.mode}</span>
                      <span className="text-slate-500">{a.admin} · {new Date(a.at).toLocaleString("en-GB")} · {a.durationMs} ms</span>
                      {a.error && <span className="text-rose-600">error</span>}
                    </div>
                    <pre className="mt-1 truncate font-mono text-slate-700 dark:text-slate-300">{a.query}</pre>
                  </li>
                ))}
                {!schema?.audit.length && <li className="p-6 text-center text-slate-500">No queries yet</li>}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
