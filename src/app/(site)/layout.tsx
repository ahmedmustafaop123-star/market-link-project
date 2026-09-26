import Link from "next/link";
import type { ReactNode } from "react";
import { SiteNav } from "@/components/nav/site-nav";
import { ChatBot } from "@/components/ChatBot";
import { MandiTicker } from "@/components/mandi-ticker";
import { getViewer } from "@/lib/viewer";
import { getTicker } from "@/lib/ticker";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const [viewer, ticker] = await Promise.all([getViewer(), getTicker()]);
  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav viewer={viewer} />
      <MandiTicker items={ticker} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <footer className="border-t border-brand-900/10 dark:border-white/5">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} MarketLink Agri-Hub Pakistan</p>
          <nav className="flex gap-5">
            <Link href="/marketplace" className="hover:text-brand-700">Marketplace</Link>
            <Link href="/mandi-rates" className="hover:text-brand-700">Mandi rates</Link>
            <Link href="/tracking" className="hover:text-brand-700">Tracking</Link>
            <Link href="/deploy" className="hover:text-brand-700">Developers</Link>
          </nav>
        </div>
      </footer>
      {(!viewer || viewer.role === "buyer") && <ChatBot placement="public" />}
    </div>
  );
}
