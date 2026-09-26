/* eslint-disable */
// Generates public/MarketLink-AgriHub-Complete.pdf — the complete project book.
// Usage: NODE_PATH=/path/with/pdfkit/node_modules node scripts/generate-pdf.cjs [liveUrl]
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const fontkit = require("fontkit");
const ROOT = path.resolve(__dirname, "..");
const ts = require(path.join(ROOT, "node_modules/typescript"));

const OUT = path.join(ROOT, "public/MarketLink-AgriHub-Complete.pdf");
const LIVE_URL = process.argv[2] || "";
const F = "/usr/share/fonts/truetype/dejavu/";
const FONTS = { sans: F + "DejaVuSans.ttf", bold: F + "DejaVuSans-Bold.ttf", mono: F + "DejaVuSansMono.ttf", monoB: F + "DejaVuSansMono-Bold.ttf" };
const monoFont = fontkit.openSync(FONTS.mono);
const sansFont = fontkit.openSync(FONTS.sans);

function loadTs(file) {
  const src = fs.readFileSync(path.join(ROOT, file), "utf8");
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText;
  const m = { exports: {} };
  new Function("module", "exports", "require", js)(m, m.exports, require);
  return m.exports;
}
const docs = loadTs("src/lib/docs-content.ts");
const { POSTGRES_DDL } = loadTs("src/lib/ddl-postgres.ts");

/** Keep text renderable by DejaVu: Urdu → "[Urdu]", drop emoji / unsupported glyphs, keep newlines. */
function clean(text, font) {
  let out = "";
  let inUrdu = false;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    const isArabic = (cp >= 0x0600 && cp <= 0x06ff) || (cp >= 0xfb50 && cp <= 0xfefe);
    if (isArabic) { if (!inUrdu) { out += "[Urdu]"; inUrdu = true; } continue; }
    if (inUrdu && ch === " ") continue;
    inUrdu = false;
    if (ch === "\n") { out += "\n"; continue; }
    if (ch === "\t") { out += "  "; continue; }
    if (cp === 0xfe0f || cp === 0x200d || cp === 0x200c || cp === 0xfeff) continue;
    if (cp < 32 || cp >= 0x1f000) continue;
    if (font.hasGlyphForCodePoint(cp)) out += ch;
  }
  return out;
}

const GREEN = "#01411c", GOLD = "#d9a514", GREY = "#64748b", LIGHT = "#edfbf2";
const doc = new PDFDocument({
  size: "A4",
  margins: { top: 56, bottom: 56, left: 48, right: 48 },
  bufferPages: true,
  info: { Title: "MARKETLINK AGRI-HUB — Complete Project", Author: "MarketLink Agri-Hub", Subject: "B2B Agricultural Marketplace — hosting, source code, schema, API & workflows" },
});
Object.entries(FONTS).forEach(([k, v]) => doc.registerFont(k, v));
doc.pipe(fs.createWriteStream(OUT));
const W = doc.page.width - 96;

function ensure(h) { if (doc.y + h > doc.page.height - 60) doc.addPage(); }
function h1(title) {
  doc.addPage();
  doc.rect(0, 0, doc.page.width, 90).fill(GREEN);
  doc.rect(0, 90, doc.page.width, 4).fill(GOLD);
  doc.fillColor("white").font("bold").fontSize(22).text(title, 48, 36, { width: W });
  doc.fillColor("black").font("sans").fontSize(10);
  doc.x = 48; doc.y = 118;
  return doc.outline.addItem(title);
}
function h2(t) { doc.moveDown(0.6); ensure(40); doc.x = 48; doc.fillColor(GREEN).font("bold").fontSize(14).text(clean(t, sansFont), { width: W }); doc.moveTo(48, doc.y + 2).lineTo(108, doc.y + 2).lineWidth(2).strokeColor(GOLD).stroke(); doc.moveDown(0.5); }
function h3(t) { doc.moveDown(0.4); ensure(30); doc.x = 48; doc.fillColor("#0b5030").font("bold").fontSize(11.5).text(clean(t, sansFont), { width: W }); doc.moveDown(0.2); }
function p(t, o = {}) { doc.x = 48; doc.font(o.bold ? "bold" : "sans").fontSize(o.size || 10).fillColor(o.color || "#1e293b").text(clean(t, sansFont), { width: W, lineGap: 2 }); }
function bullet(t) { ensure(16); const y = doc.y; doc.circle(54, y + 5, 1.8).fill(GREEN); doc.fillColor("#1e293b").font("sans").fontSize(10).text(clean(t, sansFont), 62, y, { width: W - 14, lineGap: 2 }); doc.x = 48; }
function numbered(steps) {
  steps.forEach((s, i) => { ensure(20); const y = doc.y; doc.circle(56, y + 6, 7).fill(GREEN); doc.fillColor("white").font("bold").fontSize(8).text(String(i + 1), 49, y + 2.5, { width: 14, align: "center" }); doc.fillColor("#1e293b").font("sans").fontSize(10).text(clean(s, sansFont), 70, y, { width: W - 22, lineGap: 2 }); doc.x = 48; doc.moveDown(0.4); });
}
function codeBlock(text, { size = 7.2, numbers = true } = {}) {
  const lineH = size * 1.32, charW = size * 0.602, gutter = numbers ? 30 : 0;
  const maxChars = Math.floor((W - gutter - 8) / charW);
  const lines = clean(text.replace(/\r/g, ""), monoFont).split("\n");
  lines.forEach((raw, idx) => {
    const n = idx + 1;
    const parts = [];
    let rest = raw;
    if (!rest.length) parts.push("");
    while (rest.length) { parts.push(rest.slice(0, maxChars)); rest = rest.slice(maxChars); }
    parts.forEach((seg, i) => {
      if (doc.y + lineH > doc.page.height - 60) doc.addPage();
      const y = doc.y;
      if (n % 2 === 0) doc.rect(48, y - 1, W, lineH).fill("#f8faf8");
      if (numbers) doc.font("mono").fontSize(size - 0.8).fillColor("#94a3b8").text(i === 0 ? String(n).padStart(4, " ") : "   ↪", 48, y, { width: gutter - 4, lineBreak: false });
      doc.font("mono").fontSize(size).fillColor("#0f172a").text(seg || " ", 48 + gutter, y, { width: W - gutter, lineBreak: false });
      doc.y = y + lineH;
    });
  });
  doc.x = 48;
  doc.moveDown(0.5);
}

/* ---------------- Collect files ---------------- */
const files = [];
function walk(dir) {
  for (const f of fs.readdirSync(path.join(ROOT, dir)).sort()) {
    const rel = path.join(dir, f);
    if (fs.statSync(path.join(ROOT, rel)).isDirectory()) walk(rel);
    else if (/\.(ts|tsx|css|sql|mjs|cjs)$/.test(f) && rel !== "src/lib/ddl-postgres.ts") files.push(rel);
  }
}
["README.md", "schema.sql", "schema.mysql.sql", "package.json", "tsconfig.json", "next.config.ts", "drizzle.config.json", "postcss.config.mjs", "eslint.config.mjs", "Dockerfile", "docker-compose.yml", "render.yaml", ".env.example", "start-windows.bat", "start-docker.bat", "start.sh"].forEach((f) => fs.existsSync(path.join(ROOT, f)) && files.push(f));
walk("src");
walk("database");
walk("scripts");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const totalLines = files.reduce((s, f) => s + read(f).split("\n").length, 0);

/* ---------------- Cover ---------------- */
doc.rect(0, 0, doc.page.width, doc.page.height).fill(GREEN);
doc.rect(0, doc.page.height * 0.62, doc.page.width, 6).fill(GOLD);
doc.roundedRect(doc.page.width - 248, 83, 200, 80, 12).fill("white");
doc.image(path.join(ROOT, "public", "brand", "marketlink-email.png"), doc.page.width - 240, 92, { fit: [184, 62] });
doc.fillColor(GOLD).font("bold").fontSize(12).text("PROJECT 3 · SRS IMPLEMENTATION", 48, 150, { characterSpacing: 2 });
doc.fillColor("white").font("bold").fontSize(38).text("MARKETLINK", 48, 180);
doc.text("AGRI-HUB", 48, 226);
doc.fillColor("#d3f5df").font("sans").fontSize(14).text("B2B Agricultural Marketplace connecting Pakistani farmers (kisan) directly with wholesalers, supermarket chains, exporters and food processors.", 48, 290, { width: W - 60, lineGap: 4 });
doc.fillColor("white").font("bold").fontSize(12).text("Complete Project Book", 48, 380);
doc.font("sans").fontSize(11).fillColor("#d3f5df");
["Hosting guide: local, temporary public link and free cloud", "Database ERD & DDL (PostgreSQL + MySQL)", "REST API endpoint specification", "Business logic workflows (Bidding · Escrow · Mandi Sync)", "Full source code: Farmer, Buyer & Admin dashboards"].forEach((l, i) => doc.text("▸  " + l, 48, 402 + i * 18));
doc.fillColor("white").font("bold").fontSize(11).text("Tech stack", 48, doc.page.height * 0.62 + 30);
doc.font("sans").fontSize(10).fillColor("#d3f5df").text("Next.js 16 (React 19) · Tailwind CSS 4 · PostgreSQL · Drizzle ORM · Recharts · REST API · RBAC · Docker", 48, doc.y + 4, { width: W });
if (LIVE_URL) { doc.fillColor("white").font("bold").fontSize(11).text("Live preview (temporary)", 48, doc.y + 16); doc.font("sans").fontSize(10).fillColor(GOLD).text(LIVE_URL, 48, doc.y + 4, { link: LIVE_URL, underline: true }); }
doc.fillColor("white").font("bold").fontSize(11).text("Demo logins (password: password123)", 48, doc.y + 16);
doc.font("sans").fontSize(10).fillColor("#d3f5df").text("Farmer: farmer@marketlink.pk    Buyer: buyer@marketlink.pk    Admin: ahmed.mustafa@admin.com", 48, doc.y + 4);
doc.fillColor("#a9e9c3").fontSize(9).text("Generated " + new Date().toLocaleString("en-GB", { timeZone: "Asia/Karachi" }) + " PKT", 48, doc.page.height - 70);

/* ---------------- Contents ---------------- */
h1("Contents");
[["0", "Hosting Guide (local · temporary link · free cloud)"], ["1", "Project Overview & Features"], ["2", "Database: ERD & DDL Scripts"], ["3", "REST API Endpoint Specification"], ["4", "Business Logic Workflows"], ["5", "Project Structure"], ["6", `Complete Source Code (${files.length} files, ${totalLines.toLocaleString()} lines)`]].forEach(([n, t]) => {
  doc.x = 48; doc.font("bold").fontSize(13).fillColor(GREEN).text(n + "    ", { continued: true }).fillColor("#1e293b").font("sans").text(t); doc.moveDown(0.5);
});
doc.moveDown(1);
p("Tip: use your PDF viewer's bookmarks panel to jump to any section or source file.", { color: GREY, size: 9 });

/* ---------------- 0 Hosting ---------------- */
h1("0 · Hosting Guide");
h2("Why http://localhost:3000 does not open by itself");
p("localhost means 'this computer'. The link only works AFTER you start the MarketLink server on your own PC, and only while its server window stays open. Opening the link without starting the server always shows 'This site can't be reached'.");
h2("Option 1: Run on your PC (recommended, only Node.js needed)");
p("The app includes a built-in PostgreSQL-compatible database (PGlite) stored in the .data folder, so there's no PostgreSQL or Docker to install. Tables and demo data are created automatically.");
numbered(["Install Node.js 20 LTS or newer from nodejs.org (green LTS button, default options).", "Download MarketLink-AgriHub-Pakistan.zip from the /deploy page, right-click → Extract All. Don't run it from inside the zip.", "Windows: double-click start-windows.bat. Mac/Linux: run 'bash start.sh' in Terminal. The first run installs and builds (3-6 minutes).", "Wait for '✅ MarketLink is running!'. The browser opens http://localhost:3000 automatically. Keep the window open; press Ctrl+C to stop.", "Phone on the same Wi-Fi: open the 'Phone / same Wi-Fi' address printed in the window (allow Windows Firewall access if asked)."]);
h2("Option 1B: PostgreSQL installed on your laptop (pgAdmin)");
p("Use this instead of the built-in database if you need to inspect MarketLink tables through pgAdmin. The cloud preview, built-in PGlite folder, and your laptop PostgreSQL are three separate databases: changing the connection does not move existing records.");
numbered(["Install PostgreSQL and pgAdmin from postgresql.org/download. Choose a password for the postgres user and keep TCP port 5432.", "Edit .env in the extracted folder and set DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@127.0.0.1:5432/app_db (replace the password from the installer, NOT the website demo password). URL-encode special password characters.", "In the project folder run: node scripts/check-db.cjs --create. It tests the connection and creates app_db if your postgres user has permission.", "Run start-windows.bat, then open http://localhost:3000/login. After first visit, in pgAdmin expand Databases → app_db → Schemas → public → Tables and refresh. Inspect users or crops_inventory."]);
h3("Troubleshooting");
[["'node' is not recognized", "Install Node.js, restart the PC, try again."], ["Browser: can't be reached", "The server window was closed or is still starting. Wait for the ✅ message."], ["Port 3000 busy", "Handled automatically: the window shows the port used (e.g. 3001)."], ["Fresh demo data", "Stop the server, delete the .data folder, start again."], ["Updated code", "Run start-windows.bat --rebuild"], ["Own PostgreSQL", "Set DATABASE_URL in .env. The database is created automatically."]].forEach(([k, v]) => bullet(k + ": " + v));
h2("Option 2: Temporary public link from your PC");
numbered(["Keep Option 1 running.", "In a second terminal run:  npx cloudflared tunnel --url http://localhost:3000", "Share the printed https://xxxx.trycloudflare.com link. It works while your PC stays on. Alternative: npx localtunnel --port 3000"]);
h2("Option 3: Docker (with a real PostgreSQL server)");
numbered(["Install Docker Desktop.", "Double-click start-docker.bat, or run: docker compose up --build", "Open http://localhost:3000"]);
h2("Option 4: Free cloud hosting (24/7)");
bullet("Render.com: push to GitHub → New → Blueprint (render.yaml creates the web service + PostgreSQL). Free tier sleeps after 15 min idle.");
bullet("Vercel + Neon: free Neon Postgres, import the repo on Vercel, set DATABASE_URL, SESSION_SECRET, COOKIE_SECURE=true.");
bullet("Railway.app: deploy from GitHub + PostgreSQL plugin, set DATABASE_URL and SESSION_SECRET.");
h2("Admin panel access");
numbered(["Open /admin-login (e.g. http://localhost:3000/admin-login) and sign in: ahmed.mustafa@admin.com / password123.", "Change the default password right away: sidebar → Account settings. The admin dashboard shows a red warning until you do.", "Admin pages: /admin (analytics), /admin/users (create admins & inspectors, reset passwords, change roles), /admin/verification, /admin/mandi, /admin/orders.", "Own admin login from the first start: set ADMIN_EMAIL and ADMIN_PASSWORD in .env before the first run (or delete the .data folder to start over)."]);
h2("Environment variables (.env)");
[["DATABASE_URL", "empty = built-in database; or a PostgreSQL connection string"], ["ADMIN_EMAIL / ADMIN_PASSWORD", "admin login created on first start"], ["SESSION_SECRET", "long random text that signs login cookies"], ["COOKIE_SECURE", "'true' when served over HTTPS"], ["PORT", "preferred port (default 3000, auto-increments if busy)"]].forEach(([k, v]) => { ensure(14); doc.x = 48; doc.font("monoB").fontSize(9).fillColor(GREEN).text(k, { continued: true }).font("sans").fillColor("#1e293b").text("  " + v); });

/* ---------------- 1 Overview ---------------- */
h1("1 · Project Overview & Features");
p("MarketLink Agri-Hub is a hyper-local and regional B2B agri-commerce platform for Pakistan. It lets farmers sell graded produce directly to commercial buyers without arhti (commission agent) middlemen, with transparent mandi pricing, PKR escrow payments, quality inspection and truck tracking.");
h2("Pakistan localisation");
["Currency: Pakistani Rupee (Rs. / PKR), with Lakh / Crore short forms for large amounts.", "Mandi rates per kg and per maund (40 kg), the unit Pakistani farmers and arhtis use.", "38 cities across Punjab, Sindh, Khyber Pakhtunkhwa, Balochistan, Islamabad, Gilgit-Baltistan and Azad Kashmir, grouped by province.", "10 real wholesale mandis: Badami Bagh Lahore, Super Highway Karachi, Ghalla Mandi Multan, Faisalabad, I-11 Islamabad, Hyderabad, Peshawar, Quetta, Sukkur, Gujranwala.", "Local crops: Wheat, Basmati, Maize, Chana, Tomato, Potato, Onion, Chaunsa Mango, Kinnow, Khajoor, Cotton (Phutti), Sugarcane, Kunri Red Chilli.", "English / Urdu toggle with right-to-left layout, Pakistan Standard Time clock, CNIC validation (12345-1234567-1), JazzCash / Easypaisa / IBFT top-up (simulated)."].forEach(bullet);
h2("User roles (RBAC)");
h3("Farmer (Kisan / Seller)");
["Dashboard: inventory value, active listings, incoming bids, earnings & escrow, monthly sales chart, sales-by-crop donut.", "Crop listing: photos, grade A/B/C, harvest date, quantity in kg / maund / tons, price suggested from live mandi rates.", "Live Mandi Insights and Negotiation Hub: accept / reject / counter from a slide-in drawer with instant feedback.", "Order dispatch, transit checkpoints, escrow payouts wallet."].forEach(bullet);
h3("Buyer (Wholesaler / Supermarket / Exporter / Processor)");
["Marketplace filtered by category, grade, price and distance from any Pakistani city.", "Bidding & RFQ: price, quantity, target delivery date. Respond to counter-offers.", "Order pipeline with a 5-stage logistics stepper and checkpoint timeline.", "Escrow wallet: lock funds at deal time, release on delivery, raise disputes."].forEach(bullet);
h3("Admin / Quality Inspector");
["Verification portal: verify farmer CNIC/farm, upload inspection reports (grade, moisture %, soil pH, PDF/image).", "Mandi price controller: manual daily rates and a mock government feed sync.", "System analytics: volume, active bids, top regions, category mix, logistics pipeline, dispute log.", "Pre-dispatch quality inspection and dispute resolution (release to farmer / refund buyer)."].forEach(bullet);
h2("Architecture");
["Presentation: React Server Components + Client Components (drawers, modals, Recharts charts). Tailwind CSS 4, dark/light mode, mobile navigation.", "API: Next.js Route Handlers exposing REST endpoints with a { success, data | error } envelope.", "Domain: service modules (crops, bids, orders, mandi, analytics, admin) with transactional row locking.", "Data: PostgreSQL (server) or built-in PGlite (local, zero-setup) via Drizzle ORM. 9 tables, enums, foreign keys, indexes. Schema + demo data are created automatically on an empty database.", "Security: scrypt password hashing, HMAC-signed httpOnly session cookie, role checks on every endpoint and page."].forEach(bullet);

/* ---------------- 2 Database ---------------- */
h1("2 · Database: ERD & DDL Scripts");
h2("Entity relationships");
codeBlock(docs.ERD, { numbers: false, size: 8.5 });
h2("PostgreSQL DDL (runtime, generated from src/db/schema.ts)");
codeBlock(POSTGRES_DDL.replace(/--> statement-breakpoint/g, ""));
h2("MySQL 8 DDL (portable equivalent)");
codeBlock(docs.MYSQL_DDL);

/* ---------------- 3 API ---------------- */
const apiItem = h1("3 · REST API Endpoint Specification");
p('Authentication uses the httpOnly ml_session cookie set by /api/auth/login. Responses: { "success": true, "data": ... } or { "success": false, "error": "message" }.');
p("Errors: 400 bad JSON · 401 unauthenticated · 402 insufficient balance · 403 wrong role / not owner · 404 not found · 409 invalid state transition · 422 validation.", { color: GREY, size: 9 });
const METHOD_COLOR = { GET: "#0284c7", POST: "#059669", PATCH: "#d97706", DELETE: "#e11d48" };
for (const g of docs.API_GROUPS) {
  apiItem.addItem(g.name);
  h2(g.name);
  for (const e of g.endpoints) {
    ensure(50);
    const y = doc.y;
    doc.roundedRect(48, y, 50, 14, 3).fill(METHOD_COLOR[e.method]);
    doc.fillColor("white").font("monoB").fontSize(8).text(e.method, 48, y + 3, { width: 50, align: "center" });
    doc.fillColor("#0f172a").font("monoB").fontSize(8.5).text(e.path, 104, y + 2.5, { width: W - 56 });
    doc.x = 48;
    doc.font("sans").fontSize(8.5).fillColor(GREY).text("Roles: " + e.roles, 48, doc.y + 2);
    p(e.desc, { size: 9.5 });
    if (e.request) { doc.font("bold").fontSize(8).fillColor(GREEN).text("REQUEST", 48, doc.y + 2); codeBlock(e.request, { numbers: false, size: 7.5 }); }
    if (e.response) { doc.font("bold").fontSize(8).fillColor(GREEN).text("RESPONSE", 48, doc.y); codeBlock(e.response, { numbers: false, size: 7.5 }); }
    doc.moveTo(48, doc.y).lineTo(48 + W, doc.y).lineWidth(0.5).strokeColor("#e2e8f0").stroke();
    doc.moveDown(0.6);
  }
}

/* ---------------- 4 Workflows ---------------- */
h1("4 · Business Logic Workflows");
for (const w of docs.WORKFLOWS) { h2(w.title); numbered(w.steps); }
h2("State machines");
codeBlock(`BID
pending ──farmer:accept──────────▶ accepted ──▶ order (awaiting_escrow)
pending ──farmer:counter─────────▶ countered
countered ──buyer:accept_counter─▶ accepted ──▶ order @ counter price
countered ──buyer:reject_counter─▶ rejected
countered ──buyer:revise─────────▶ pending (new price)
pending ──farmer:reject──────────▶ rejected
pending|countered ──buyer:withdraw▶ withdrawn

ORDER / LOGISTICS
confirmed ─(buyer locks escrow)─▶ quality_checked [inspector]
          ─▶ dispatched [farmer] ─▶ in_transit [farmer, checkpoints]
          ─▶ delivered [buyer]  ⇒  escrow released: farmer gets total − 1.5% fee

PAYMENT
awaiting_escrow ─▶ escrow_locked ─▶ released
escrow_locked ─(dispute)─▶ disputed ─(admin)─▶ released | refunded`, { numbers: false, size: 8 });

/* ---------------- 5 Structure ---------------- */
h1("5 · Project Structure");
p("All files reproduced in section 6. (src/lib/ddl-postgres.ts is auto-generated from the schema and appears in section 2.)", { color: GREY, size: 9 });
doc.moveDown(0.5);
codeBlock(files.map((f) => "  ".repeat(f.split("/").length - 1) + "├─ " + f + "   (" + read(f).split("\n").length + " lines)").join("\n"), { numbers: false, size: 7.5 });

/* ---------------- 6 Source ---------------- */
const srcItem = h1("6 · Complete Source Code");
p(`${files.length} files · ${totalLines.toLocaleString()} lines, with line numbers. Long lines wrap with ↪.`, { color: GREY, size: 9 });
const groups = {};
for (const f of files) {
  const group = f.startsWith("src/app/api") ? "API route handlers" : f.startsWith("src/app") ? "Pages & layouts" : f.startsWith("src/components") ? "UI components" : f.startsWith("src/lib") || f.startsWith("src/db") ? "Backend services, DB & libraries" : f.startsWith("database") ? "Database scripts" : "Hosting, scripts & configuration";
  groups[group] = groups[group] || srcItem.addItem(group);
  ensure(90);
  if (doc.y > 140) doc.moveDown(0.8);
  groups[group].addItem(f);
  const y = doc.y;
  doc.rect(48, y, W, 20).fill(LIGHT);
  doc.rect(48, y, 3, 20).fill(GREEN);
  doc.fillColor(GREEN).font("monoB").fontSize(9.5).text(f, 58, y + 5.5, { width: W - 20 });
  doc.y = y + 26; doc.x = 48;
  codeBlock(read(f));
}

/* ---------------- Page footers ---------------- */
const range = doc.bufferedPageRange();
for (let i = 1; i < range.count; i++) {
  doc.switchToPage(i);
  const mb = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.font("sans").fontSize(7.5).fillColor(GREY).text("MARKETLINK AGRI-HUB · Complete Project Book", 48, doc.page.height - 34, { width: W / 2, lineBreak: false });
  doc.text(`Page ${i + 1} of ${range.count}`, 48 + W / 2, doc.page.height - 34, { width: W / 2, align: "right", lineBreak: false });
  doc.page.margins.bottom = mb;
}
doc.end();
console.log("PDF written:", OUT, "| pages:", range.count, "| files:", files.length, "| lines:", totalLines);
