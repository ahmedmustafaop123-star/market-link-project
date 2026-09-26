"use client";

import { useState } from "react";

export function DdlTabs({ postgres, mysql }: { postgres: string; mysql: string }) {
  const [tab, setTab] = useState<"pg" | "mysql">("pg");
  const [copied, setCopied] = useState(false);
  const text = tab === "pg" ? postgres : mysql;
  return (
    <div className="card mt-4 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-800">
        {(["pg", "mysql"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === t ? "bg-brand-600 text-white" : "text-slate-500"}`}>
            {t === "pg" ? "PostgreSQL (runtime)" : "MySQL 8"}
          </button>
        ))}
        <button
          className="btn-secondary ml-auto py-1 text-xs"
          onClick={() => {
            navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "✓ Copied" : "Copy SQL"}
        </button>
      </div>
      <pre className="max-h-[520px] overflow-auto bg-slate-950 p-4 text-xs leading-5 text-slate-200">{text}</pre>
    </div>
  );
}
