"use client";

import Link from "next/link";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="card max-w-lg p-8 text-center">
        <div className="text-5xl">🌾</div>
        <h1 className="mt-4 text-xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          The server couldn&apos;t complete this request. If you are hosting MarketLink on your own computer, the most common cause is the database connection.
        </p>
        <ul className="mt-4 space-y-1.5 text-left text-sm text-slate-600 dark:text-slate-400">
          <li>• Simplest fix: open <code>.env</code> and leave <code>DATABASE_URL=</code> empty to use the built-in database, then restart.</li>
          <li>• Using PostgreSQL? Make sure it is running and the password in <code>DATABASE_URL</code> is correct.</li>
        </ul>
        {error.digest && <p className="mt-3 font-mono text-xs text-slate-400">Error ID: {error.digest}</p>}
        <div className="mt-6 flex justify-center gap-2">
          <button className="btn-primary" onClick={reset}>Try again</button>
          <Link href="/" className="btn-secondary">Home</Link>
        </div>
      </div>
    </div>
  );
}
