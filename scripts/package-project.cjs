#!/usr/bin/env node
/* eslint-disable */
/**
 * Builds the complete, organised project folder and zips it:
 *   public/MarketLink-AgriHub-Pakistan.zip  →  MarketLink-AgriHub-Pakistan/
 *
 * Usage: node scripts/package-project.cjs [liveUrl]
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const NAME = "MarketLink-AgriHub-Pakistan";
const STAGE_PARENT = path.join(require("os").tmpdir(), "ml-package");
const STAGE = path.join(STAGE_PARENT, NAME);
const OUT_ZIP = path.join(ROOT, "public", `${NAME}.zip`);
const LIVE_URL = process.argv[2] || "";
const ts = require(path.join(ROOT, "node_modules/typescript"));

function loadTs(file) {
  const src = fs.readFileSync(path.join(ROOT, file), "utf8");
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText;
  const m = { exports: {} };
  new Function("module", "exports", "require", js)(m, m.exports, require);
  return m.exports;
}
const docs = loadTs("src/lib/docs-content.ts");
const { POSTGRES_DDL } = loadTs("src/lib/ddl-postgres.ts");
const C = loadTs("src/lib/constants.ts");

/* ---------------- helpers ---------------- */
function copy(src, dest, filter = () => true) {
  const s = path.join(ROOT, src);
  if (!fs.existsSync(s)) return;
  const st = fs.statSync(s);
  if (st.isDirectory()) {
    for (const f of fs.readdirSync(s)) {
      const rel = path.join(src, f);
      if (filter(rel)) copy(rel, path.join(dest, f), filter);
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(s, dest);
  }
}
const write = (rel, content) => {
  const p = path.join(STAGE, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
};
const countFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((n, d) => n + (d.isDirectory() ? countFiles(path.join(dir, d.name)) : 1), 0);

/* ---------------- 1. fresh stage ---------------- */
fs.rmSync(STAGE_PARENT, { recursive: true, force: true });
fs.mkdirSync(STAGE, { recursive: true });

/* ---------------- 2. application source (runs from the folder root) ---------------- */
// Keep the database-only package (public/MarketLink-Database.zip) inside the folder so the /deploy
// page's download button also works offline; never copy a previously built full-project zip.
const skip = (rel) => !/MarketLink-AgriHub-Pakistan\.zip$/.test(rel) && !rel.includes("node_modules") && !rel.startsWith(".next") && !rel.startsWith(".data");
["src", "public", "database", "scripts"].forEach((d) => copy(d, path.join(STAGE, d), skip));
[
  "package.json", "package-lock.json", "tsconfig.json", "next.config.ts", "drizzle.config.json", "postcss.config.mjs", "eslint.config.mjs",
  "Dockerfile", ".dockerignore", "docker-compose.yml", "render.yaml", ".env.example", "README.md", "schema.sql", "schema.mysql.sql",
  "start-windows.bat", "start-docker.bat", "start.sh",
].forEach((f) => copy(f, path.join(STAGE, f)));
write(".gitignore", "node_modules\n.next\n.data\n.env\n*.log\n");
try { fs.chmodSync(path.join(STAGE, "start.sh"), 0o755); } catch {}

/* ---------------- 3. Documentation folder ---------------- */
const DOC = "Documentation";
copy("Documentation", path.join(STAGE, DOC)); // hand-written reports (final audit etc.)
copy("public/MarketLink-AgriHub-Complete.pdf", path.join(STAGE, DOC, "1-MarketLink-Complete-Project-Book.pdf"));
write(`${DOC}/2-Database-Schema-PostgreSQL.sql`, POSTGRES_DDL.replace(/--> statement-breakpoint\n?/g, ""));
write(`${DOC}/3-Database-Schema-MySQL.sql`, docs.MYSQL_DDL);

// API spec
let api = `# MarketLink Agri-Hub Pakistan: REST API Endpoints\n\nAuthentication: httpOnly \`ml_session\` cookie set by \`POST /api/auth/login\`.\nResponses: \`{ "success": true, "data": ... }\` or \`{ "success": false, "error": "message" }\`.\n\nErrors: 400 bad JSON · 401 unauthenticated · 402 insufficient balance · 403 wrong role · 404 not found · 409 invalid state · 422 validation.\n`;
for (const g of docs.API_GROUPS) {
  api += `\n## ${g.name}\n`;
  for (const e of g.endpoints) {
    api += `\n### \`${e.method} ${e.path}\`\n**Roles:** ${e.roles}\n\n${e.desc}\n`;
    if (e.request) api += `\n**Request**\n\`\`\`json\n${e.request}\n\`\`\`\n`;
    if (e.response) api += `\n**Response**\n\`\`\`json\n${e.response}\n\`\`\`\n`;
  }
}
api += `\n## Account & admin (user management)\n\n### \`PATCH /api/account/password\`\n**Roles:** any signed-in user\n\n\`\`\`json\n{ "currentPassword": "password123", "newPassword": "MyNewPass#2025" }\n\`\`\`\n\n### \`POST /api/admin/users\`\n**Roles:** admin: create admin / inspector / farmer / buyer accounts\n\n\`\`\`json\n{ "fullName": "Inspector Kamran", "email": "kamran@marketlink.pk", "password": "Inspect@2025", "phone": "+92 300 5556677", "role": "admin", "city": "Multan" }\n\`\`\`\n\n### \`PATCH /api/admin/users/:id\`\n**Roles:** admin: \`{ "isVerified": true }\` · \`{ "newPassword": "..." }\` · \`{ "role": "admin" }\`\n`;
write(`${DOC}/4-API-Endpoints.md`, api);

// Workflows
let wf = `# MarketLink Agri-Hub Pakistan: Business Logic Workflows\n`;
for (const w of docs.WORKFLOWS) wf += `\n## ${w.title}\n\n${w.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n`;
wf += `\n## State machines\n\n\`\`\`\nBID\npending ──farmer:accept──────────▶ accepted ──▶ order (awaiting_escrow)\npending ──farmer:counter─────────▶ countered\ncountered ──buyer:accept_counter─▶ accepted ──▶ order @ counter price\ncountered ──buyer:reject_counter─▶ rejected\ncountered ──buyer:revise─────────▶ pending (new price)\npending ──farmer:reject──────────▶ rejected\npending|countered ──buyer:withdraw▶ withdrawn\n\nORDER / LOGISTICS\nconfirmed ─(buyer locks escrow)─▶ quality_checked [inspector]\n          ─▶ dispatched [farmer] ─▶ in_transit [farmer]\n          ─▶ delivered [buyer] ⇒ escrow released (farmer gets total − 1.5% fee)\n\nPAYMENT\nawaiting_escrow ─▶ escrow_locked ─▶ released\nescrow_locked ─(dispute)─▶ disputed ─(admin)─▶ released | refunded\n\`\`\`\n`;
write(`${DOC}/5-Business-Workflows.md`, wf);

// ERD
write(`${DOC}/6-Database-ERD.md`, `# Database: Entity Relationship Diagram\n\n\`\`\`\n${docs.ERD}\n\`\`\`\n\n| Table | Purpose |\n|---|---|\n| users | Farmers, buyers, admins; CNIC, city, verification, wallet & escrow balances |\n| crops_inventory | Produce listings: grade, quantity, price, harvest date, images, location, status |\n| mandi_rates | Daily min/max/avg per crop × mandi (unique per day) |\n| bids_negotiations | Offers & counter-offers (status state machine) |\n| orders_logistics | Orders from accepted bids: payment status, delivery stage, tracking no. |\n| quality_inspections | Inspector grade, moisture %, soil pH, notes, report file |\n| order_events | Tracking history for the logistics stepper |\n| wallet_transactions | Escrow ledger: deposit, lock, release, payout, refund, fee |\n| disputes | Dispute resolution log |\n`);

// Admin guide
write(`${DOC}/7-Admin-Guide.md`, `# Admin Panel Guide\n\n## Sign in\n- Open **/admin-login** (e.g. http://localhost:3000/admin-login)\n- Default: **ahmed.mustafa@admin.com** / **password123**\n- **Change it immediately:** sidebar → ⚙️ Account settings\n\n## Admin pages\n| Page | URL | What you can do |\n|---|---|---|\n| Analytics | /admin | Trade volume (PKR), active bids, top regions, logistics pipeline, dispute log |\n| Users & Access | /admin/users | Create admins/inspectors, reset passwords, verify users, change roles |\n| Verification | /admin/verification | Verify farmer CNIC, upload soil/crop inspection reports |\n| Price Controller | /admin/mandi | Enter daily mandi rates, sync the mock government feed |\n| Shipments & Disputes | /admin/orders | Record quality inspection, resolve disputes (release / refund) |\n\n## Custom admin login on first start\nSet in \`.env\` **before the first run**:\n\`\`\`\nADMIN_EMAIL=you@yourcompany.pk\nADMIN_PASSWORD=YourStrongPassword\n\`\`\`\nAlready started once? Stop the server, delete the \`.data\` folder, start again (demo data is recreated).\n\n## Forgot the admin password (local install)\nSame steps: set ADMIN_PASSWORD in .env → delete .data → restart.\n`);

// Demo accounts
write(`${DOC}/8-Demo-Accounts.txt`, `MarketLink Agri-Hub Pakistan: demo accounts (password for all: password123)\n\nADMIN\n  ahmed.mustafa@admin.com        Ahmed Mustafa (Super Admin)     → /admin-login\n\nQUALITY INSPECTOR\n  inspector@marketlink.pk    Dr. Farhan Malik (Faisalabad)   → /inspector/dashboard\n\nFARMERS (KISAN)\n  farmer@marketlink.pk       Muhammad Aslam (Multan)         wheat, Chaunsa mango, cotton\n  rasool@marketlink.pk       Ghulam Rasool (Sahiwal)         basmati, maize, potato\n  tariq@marketlink.pk        Rana Tariq (Faisalabad)         sugarcane, wheat, chana (unverified)\n  bashir@marketlink.pk       Bashir Ahmed Soomro (Hyderabad) tomato, onion, mango, red chilli\n  nasreen@marketlink.pk      Nasreen Bibi (Okara)            potato, kinnow (unverified)\n  wahid@marketlink.pk        Abdul Wahid Baloch (Turbat)     dates (khajoor)\n\nBUYERS\n  buyer@marketlink.pk        Qureshi Wholesale Traders (Lahore)\n  metro@marketlink.pk        FreshMart Supermarket Supply (Karachi)\n  exports@marketlink.pk      Indus Agro Exports (Karachi)\n  processor@marketlink.pk    Punjab Food Processors Ltd (Faisalabad)\n`);

/* ---------------- 4. START-HERE.html (offline guide) ---------------- */
const tree = [
  ["📄 START-HERE.html", "This page"],
  ["▶️ start-windows.bat", "Double-click to run on Windows"],
  ["▶️ start.sh", "Run on Mac / Linux: bash start.sh"],
  ["🐳 start-docker.bat", "Run with Docker (optional)"],
  ["📘 README.md", "Full setup & hosting instructions"],
  ["📁 Documentation/", "PDF project book, SQL scripts, API, workflows, ERD, admin guide, demo accounts"],
  ["📁 src/", "Application source code: pages, dashboards, REST API, business logic"],
  ["📁 database/", "Database DDL scripts (PostgreSQL + MySQL)"],
  ["📁 public/", "Images and downloadable files"],
  ["📁 scripts/", "Local server launcher, PDF & package generators"],
  ["🗄️ schema.sql / schema.mysql.sql", "Database DDL: PostgreSQL (runtime) and MySQL 8, all 15 tables"],
  ["⚙️ .env.example", "Settings: database, admin login, payment gateways, email/SMS, AI keys"],
  ["⚙️ package.json …", "Project configuration (Next.js, Tailwind, Drizzle)"],
  ["☁️ Dockerfile, docker-compose.yml, render.yaml", "Docker & free cloud hosting"],
];
const docsList = fs.readdirSync(path.join(STAGE, DOC)).sort();
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>START HERE: MarketLink Agri-Hub Pakistan</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:Segoe UI,Roboto,Arial,sans-serif;background:#f6f8f4;color:#0f172a;line-height:1.55}
header{background:#01411c;color:#fff;padding:36px 24px 44px;border-bottom:6px solid #f1c232}
.wrap{max-width:980px;margin:0 auto}h1{margin:0;font-size:34px}header p{color:#d3f5df;margin:.4em 0 0}
.ur{font-size:20px;color:#f7d774;direction:rtl;margin-top:8px}
main{padding:28px 24px 60px}.card{background:#fff;border:1px solid #e3ebe5;border-radius:18px;padding:22px 24px;margin:0 0 18px;box-shadow:0 4px 16px -8px rgba(1,65,28,.15)}
h2{margin:0 0 12px;color:#01411c;font-size:20px}.warn{background:#fffbeb;border-color:#fcd34d}
ol{padding-left:22px}li{margin:6px 0}code,kbd{background:#edfbf2;border:1px solid #cfe9d8;border-radius:6px;padding:1px 6px;font-family:Consolas,monospace;font-size:13px}
table{width:100%;border-collapse:collapse;font-size:14px}td{padding:8px 6px;border-bottom:1px solid #eef2ef;vertical-align:top}td:first-child{font-weight:600;white-space:nowrap;padding-right:18px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.pill{background:#01411c;color:#fff;border-radius:14px;padding:14px 16px}
.pill b{color:#f1c232;display:block}.pill span{font-size:13px;color:#d3f5df}a{color:#0d653b;font-weight:600}
.term{background:#002611;color:#a9e9c3;border-radius:12px;padding:14px 16px;font-family:Consolas,monospace;font-size:13px;white-space:pre;overflow:auto}
footer{text-align:center;color:#64748b;font-size:13px;padding:20px}
</style></head><body>
<header><div class="wrap">
<div style="display:inline-flex;align-items:center;gap:12px;background:white;border-radius:14px;padding:8px 16px;margin-bottom:18px"><img src="public/brand/marketlink-logo.svg" width="305" height="72" alt="MARKETLINK AGRI-HUB" style="display:block;max-width:78vw;height:auto"></div>
<h1>MARKETLINK AGRI-HUB</h1>
<p>B2B agricultural marketplace: farmers ↔ wholesalers, supermarkets, exporters & food processors. PKR · per-maund mandi rates · escrow · truck tracking.</p>
<div class="ur">کسان سے خریدار تک — براہِ راست</div>
</div></header>
<main class="wrap">

<div class="card warn"><h2>⚠️ Important</h2>
<b>http://localhost:3000</b> only works <b>after</b> you start the server (steps below) and <b>while its black window stays open</b>.
Also: extract this folder from the zip first, because it can't run from inside the zip.</div>

<div class="card"><h2>▶️ Run the website on this PC (4 steps)</h2>
<ol>
<li>Install <b>Node.js 20 LTS</b> or newer from <a href="https://nodejs.org" target="_blank">nodejs.org</a> (one time, default options).</li>
<li><b>Windows:</b> double-click <code>start-windows.bat</code> &nbsp;·&nbsp; <b>Mac/Linux:</b> open Terminal here and run <code>bash start.sh</code></li>
<li>First run installs & builds (3-6 minutes). Wait for <b>✅ MarketLink is running!</b></li>
<li>Your browser opens <a href="http://localhost:3000">http://localhost:3000</a> automatically. Keep the window open; press <kbd>Ctrl</kbd>+<kbd>C</kbd> to stop.</li>
</ol>
<div class="term">══════════════════════════════════════════
  ✅ MarketLink is running!
  On this computer:   http://localhost:3000
  Phone / same Wi-Fi: http://192.168.x.x:3000
══════════════════════════════════════════</div>
<p style="font-size:14px;color:#475569">No PostgreSQL needed: a built-in database is created automatically in the <code>.data</code> folder, with Pakistani demo data.</p>
</div>

<div class="card"><h2>🔑 Logins (password: <code>password123</code>)</h2>
<div class="grid">
<div class="pill"><b>🛡️ Admin panel</b>ahmed.mustafa@admin.com<br><span>Open <a style="color:#f7d774" href="http://localhost:3000/admin-login">localhost:3000/admin-login</a></span></div>
<div class="pill"><b>🔬 Inspector</b>inspector@marketlink.pk<br><span>Quality lab desk</span></div>
<div class="pill"><b>🧑‍🌾 Farmer</b>farmer@marketlink.pk<br><span>Muhammad Aslam · Multan</span></div>
<div class="pill"><b>🏢 Buyer</b>buyer@marketlink.pk<br><span>Qureshi Wholesale · Lahore</span></div>
</div>
<p style="font-size:14px">After signing in as admin, change the password in <b>⚙️ Account settings</b>. All demo accounts: <a href="Documentation/8-Demo-Accounts.txt">Documentation/8-Demo-Accounts.txt</a></p>
</div>

<div class="card"><h2>📁 What's in this folder</h2><table>
${tree.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join("\n")}
</table></div>

<div class="card"><h2>📚 Documentation</h2><table>
${docsList.map((f) => `<tr><td><a href="Documentation/${f}">${f}</a></td><td>${
  f.endsWith(".pdf") ? "Complete project book: hosting guide, features, ERD & DDL, REST API, workflows, full source code" :
  f.includes("PostgreSQL") ? "PostgreSQL DDL (used by the app)" : f.includes("MySQL") ? "MySQL 8 DDL (portable version)" :
  f.includes("API") ? "REST API endpoints with request/response JSON" : f.includes("Workflows") ? "Bidding, escrow/order progression, mandi rate sync" :
  f.includes("ERD") ? "Entity relationship diagram & table purposes" : f.includes("Admin") ? "Admin panel: login, pages, custom admin password" : "All demo logins"
}</td></tr>`).join("\n")}
</table></div>

<div class="card"><h2>🌍 Share it online</h2>
<table>
<tr><td>Temporary public link</td><td>While running, in a 2nd terminal: <code>npx cloudflared tunnel --url http://localhost:3000</code> → share the https://….trycloudflare.com link</td></tr>
<tr><td>Phone (same Wi-Fi)</td><td>Open the "Phone / same Wi-Fi" address shown in the black window</td></tr>
<tr><td>Free cloud 24/7</td><td>Upload folder to GitHub → render.com → New → Blueprint (uses <code>render.yaml</code>)</td></tr>
<tr><td>Docker</td><td>Double-click <code>start-docker.bat</code> (includes PostgreSQL)</td></tr>
</table>
<p style="font-size:14px">Full details: <a href="README.md">README.md</a></p>
</div>

<div class="card"><h2>🛠 Troubleshooting</h2><table>
<tr><td>'node' is not recognized</td><td>Install Node.js, restart the PC, try again</td></tr>
<tr><td>"This site can't be reached"</td><td>The server window is closed or still starting. Wait for ✅</td></tr>
<tr><td>Port 3000 busy</td><td>Automatic: the window shows the port used (e.g. 3001)</td></tr>
<tr><td>Fresh demo data</td><td>Stop the server, delete the <code>.data</code> folder, start again</td></tr>
<tr><td>Edited the code</td><td>Run <code>start-windows.bat --rebuild</code></td></tr>
</table></div>
${LIVE_URL ? `<div class="card"><h2>🔗 Online preview (temporary)</h2><a href="${LIVE_URL}" target="_blank">${LIVE_URL}</a></div>` : ""}
</main>
<footer>MarketLink Agri-Hub Pakistan · Next.js · Tailwind CSS · PostgreSQL / PGlite · Drizzle ORM · Recharts · packaged ${new Date().toLocaleString("en-GB", { timeZone: "Asia/Karachi" })} PKT</footer>
</body></html>`;
write("START-HERE.html", html);

/* ---------------- 5. zip ---------------- */
fs.rmSync(OUT_ZIP, { force: true });
for (const old of ["MarketLink-AgriHub-Source.zip"]) fs.rmSync(path.join(ROOT, "public", old), { force: true });
const r = spawnSync("zip", ["-rq", "-X", OUT_ZIP, NAME], { cwd: STAGE_PARENT, stdio: "inherit" });
if (r.status !== 0) { console.error("zip failed"); process.exit(1); }
console.log(`Package ready: ${OUT_ZIP} | ${countFiles(STAGE)} files | ${(fs.statSync(OUT_ZIP).size / 1024 / 1024).toFixed(2)} MB`);
console.log(`Folder preview: ${STAGE}`);
