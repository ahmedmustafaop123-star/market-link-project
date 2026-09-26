import Link from "next/link";
import { Brand } from "@/components/app-shell";

export const metadata = { title: "Run locally / Hosting" };

function Code({ children }: { children: string }) {
  return <pre className="mt-2 overflow-x-auto rounded-xl bg-brand-950 p-3 text-xs leading-6 text-emerald-200">{children}</pre>;
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-900 font-extrabold text-gold-400">{n}</span>
      <div className="pt-1">
        <p className="font-semibold">{title}</p>
        <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">{children}</div>
      </div>
    </li>
  );
}

function Option({ tag, title, time, children }: { tag: string; title: string; time: string; children: React.ReactNode }) {
  return (
    <section className="card p-6">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 font-bold text-brand-900 dark:bg-white/10 dark:text-gold-400">{tag}</span>
        <div>
          <h3 className="font-bold">{title}</h3>
          <p className="text-xs text-slate-500">⏱ {time}</p>
        </div>
      </div>
      <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">{children}</div>
    </section>
  );
}

export default function DeployPage() {
  return (
    <div className="min-h-screen">
      <header className="pk-pattern relative bg-brand-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Brand light />
          <Link href="/login" className="btn bg-gold-400 text-brand-950 hover:bg-gold-300">Open app</Link>
        </div>
        <div className="mx-auto max-w-5xl px-4 pt-6 pb-12 text-white sm:px-6">
          <h1 className="text-3xl font-extrabold sm:text-4xl">Run MarketLink on your own PC</h1>
          <p className="mt-2 max-w-2xl text-white/80">You only need Node.js. The database is built in, so there&apos;s no PostgreSQL or Docker to install. Tables and Pakistani demo data are created automatically.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="/MarketLink-AgriHub-Pakistan.zip" className="btn bg-gold-400 px-5 py-3 text-base text-brand-950 hover:bg-gold-300">⬇ Download complete project folder (.zip)</a>
            <a href="https://nodejs.org" target="_blank" rel="noreferrer" className="btn bg-white/10 px-5 py-3 text-base text-white ring-1 ring-white/30 hover:bg-white/20">⬇ Get Node.js (LTS)</a>
            <a href="/MarketLink-AgriHub-Complete.pdf" target="_blank" className="btn bg-white/10 px-5 py-3 text-base text-white ring-1 ring-white/30 hover:bg-white/20">📄 Project PDF</a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6">
        <div className="card border-amber-300 bg-amber-50 p-5 dark:border-amber-700 dark:bg-amber-950/30">
          <p className="font-bold text-amber-900 dark:text-amber-200">⚠️ Why &ldquo;http://localhost:3000&rdquo; shows &ldquo;This site can&apos;t be reached&rdquo;</p>
          <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-200/80">
            <b>localhost</b> means &ldquo;this computer&rdquo;. The link only works <b>after</b> you start the MarketLink server on your PC (steps below) and only <b>while its black window stays open</b>. Opening the link without starting the server always fails.
          </p>
        </div>

        <section className="card relative overflow-hidden p-6 sm:p-8">
          <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-900 to-gold-400" />
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-extrabold">Local hosting in 4 steps</h2>
            <span className="badge bg-gold-400 text-brand-950">Recommended</span>
          </div>
          <ol className="mt-6 space-y-5">
            <Step n={1} title="Install Node.js 20 LTS (one time)">
              Go to <a className="font-semibold text-brand-700 underline" href="https://nodejs.org" target="_blank" rel="noreferrer">nodejs.org</a>, click the green <b>LTS</b> button and install with the default options.
            </Step>
            <Step n={2} title="Download and extract the source code">
              Download the <a className="font-semibold text-brand-700 underline" href="/MarketLink-AgriHub-Pakistan.zip">complete project folder (.zip)</a>, right-click it and choose <b>Extract All</b>. You get one folder, <b>MarketLink-AgriHub-Pakistan</b>, with the source code, start files, PDF, SQL scripts and guides. Open <b>START-HERE.html</b> inside it first.
            </Step>
            <Step n={3} title="Double-click the start file">
              <b>Windows:</b> <code>start-windows.bat</code> · <b>Mac / Linux:</b> run <code>bash start.sh</code> in Terminal. The first run installs and builds (3-6 min); later runs take a few seconds.
            </Step>
            <Step n={4} title="Wait for ✅ MarketLink is running!">
              Your browser opens <b>http://localhost:3000</b> automatically. <b>Keep the black window open</b> while using the site, and press <kbd>Ctrl</kbd>+<kbd>C</kbd> in it to stop. On your phone (same Wi-Fi), open the &ldquo;Phone&rdquo; address shown in the window.
            </Step>
          </ol>
          <div className="mt-6 overflow-hidden rounded-xl bg-brand-950 p-4 font-mono text-xs leading-6 text-emerald-200">
            <p>══════════════════════════════════════════</p>
            <p>  ✅ MarketLink is running!</p>
            <p>  On this computer:   http://localhost:3000</p>
            <p>  Phone / same Wi-Fi: http://192.168.1.5:3000</p>
            <p>  Demo login:         farmer@marketlink.pk / password123</p>
            <p>══════════════════════════════════════════</p>
          </div>
        </section>

        <section className="card p-6">
          <h2 className="text-lg font-bold">🛠 Troubleshooting</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {[
                  ["'node' is not recognized", "Node.js isn't installed. Install it, restart the PC, and try again."],
                  ["Browser: \"can't be reached\"", "The server window was closed or hasn't finished starting. Wait for ✅ MarketLink is running!"],
                  ["Port 3000 already in use", "Handled automatically: the window shows the port it picked (e.g. 3001)."],
                  ["Fresh demo data", "Stop the server, delete the .data folder, start again."],
                  ["Use my own PostgreSQL", "Set DATABASE_URL in .env. The database is created automatically."],
                ].map(([a, b]) => (
                  <tr key={a}><td className="py-2.5 pr-4 font-semibold whitespace-nowrap">{a}</td><td className="py-2.5 text-slate-600 dark:text-slate-400">{b}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <h2 className="pt-2 text-lg font-bold">Other hosting options</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Option tag="B" title="Temporary public link" time="1 min · free · no account">
            <p>While the site runs on your PC, open a second terminal:</p>
            <Code>npx cloudflared tunnel --url http://localhost:3000</Code>
            <p>You get a public <code>https://….trycloudflare.com</code> link for anyone to open while your PC is on.</p>
          </Option>
          <Option tag="C" title="Docker + PostgreSQL" time="~5 min">
            <p>Install Docker Desktop, then double-click <b>start-docker.bat</b> or run:</p>
            <Code>docker compose up --build</Code>
          </Option>
          <Option tag="D" title="Free cloud (24/7)" time="~15 min · GitHub account">
            <p>Push the folder to GitHub, then on <b>render.com</b> choose <b>New → Blueprint</b>. <code>render.yaml</code> sets up everything.</p>
            <p className="text-xs text-slate-500">Or Vercel + Neon: set <code>DATABASE_URL</code>, <code>SESSION_SECRET</code>, <code>COOKIE_SECURE=true</code>.</p>
          </Option>
        </div>

        <div className="card flex flex-wrap items-center gap-3 p-4 text-sm">
          <span className="text-xl">🔑</span>
          <p>Demo logins (password <b>password123</b>): <code>farmer@marketlink.pk</code> · <code>buyer@marketlink.pk</code> · <code>ahmed.mustafa@admin.com</code></p>
        </div>
      </main>
    </div>
  );
}
