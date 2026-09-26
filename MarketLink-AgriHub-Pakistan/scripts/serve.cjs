#!/usr/bin/env node
/* eslint-disable */
/**
 * MarketLink Agri-Hub Pakistan: one-command local server.
 *
 *   node scripts/serve.cjs            build (if needed) → start → open browser
 *   node scripts/serve.cjs --rebuild  force a fresh build
 *   NO_OPEN=1 node scripts/serve.cjs  don't open the browser
 *   PORT=4000 node scripts/serve.cjs  preferred port (auto-increments if busy)
 *
 * Works on Windows, macOS and Linux. Needs only Node.js 20.9+; uses the built-in
 * database automatically unless DATABASE_URL is set in .env.
 */
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const http = require("http");

const ROOT = path.resolve(__dirname, "..");
process.chdir(ROOT);
const isWin = process.platform === "win32";
const npm = isWin ? "npm.cmd" : "npm";
const G = (s) => `\x1b[32m${s}\x1b[0m`, Y = (s) => `\x1b[33m${s}\x1b[0m`, R = (s) => `\x1b[31m${s}\x1b[0m`, B = (s) => `\x1b[1m${s}\x1b[0m`;

function fail(msg) {
  console.error("\n" + R("✖ " + msg) + "\n");
  process.exit(1);
}

// 1. Node version
const [maj, min] = process.versions.node.split(".").map(Number);
if (maj < 20 || (maj === 20 && min < 9)) fail(`Node.js ${process.versions.node} is too old. Install Node.js 20 LTS or newer from https://nodejs.org`);

console.log(B("\n🌾  MarketLink Agri-Hub Pakistan: local server\n"));

// 2. .env (optional). Without DATABASE_URL the built-in database is used.
if (!fs.existsSync(".env") && fs.existsSync(".env.example")) {
  fs.copyFileSync(".env.example", ".env");
  console.log(G("✔ Created .env (using built-in database, no PostgreSQL needed)"));
}

// 3. Dependencies
if (!fs.existsSync("node_modules/next")) {
  console.log(Y("• Installing packages (first run only, 2-5 minutes)…"));
  const r = spawnSync(npm, ["install", "--no-audit", "--no-fund"], { stdio: "inherit", shell: isWin });
  if (r.status !== 0) fail("npm install failed. Check your internet connection and try again.");
}

// 3b. Check the configured database before spending time on a production build.
// `--create` creates app_db if the local postgres user has CREATE DATABASE permission.
console.log(Y("• Checking database connection…"));
const dbCheck = spawnSync(process.execPath, [path.join(ROOT, "scripts", "check-db.cjs"), "--create"], {
  cwd: ROOT,
  env: process.env,
  stdio: "inherit",
});
if (dbCheck.status !== 0) {
  fail("Database connection failed. Check that PostgreSQL is running and the password in .env is correct. Leave DATABASE_URL blank to use the built-in database.");
}

// 4. Build
const needBuild = process.argv.includes("--rebuild") || !fs.existsSync(".next/BUILD_ID");
if (needBuild) {
  console.log(Y("• Building the website (1-2 minutes)…"));
  const r = spawnSync(npm, ["run", "build"], { stdio: "inherit", shell: isWin });
  if (r.status !== 0) fail("Build failed. See the messages above.");
}

// 5. Free port
function portFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port, "0.0.0.0");
  });
}
async function findPort(start) {
  for (let p = start; p < start + 20; p++) if (await portFree(p)) return p;
  fail(`No free port found between ${start} and ${start + 19}.`);
}

function get(url, timeout = 60000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout }, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode));
    });
    req.on("error", () => resolve(0));
    req.on("timeout", () => { req.destroy(); resolve(0); });
  });
}

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family === "IPv4" && !a.internal) out.push(a.address);
  return out;
}

function openBrowser(url) {
  if (process.env.NO_OPEN) return;
  try {
    if (isWin) spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    else if (process.platform === "darwin") spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    else spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
  } catch {}
}

(async () => {
  const preferred = Number(process.env.PORT) || 3000;
  // Already running? (e.g. the start file was double-clicked twice) → just open it.
  for (let p = preferred; p < preferred + 5; p++) {
    const running = await new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${p}/api/health`, { timeout: 1500 }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve(res.statusCode === 200 && body.includes('"ok":true')));
      });
      req.on("error", () => resolve(false));
      req.on("timeout", () => { req.destroy(); resolve(false); });
    });
    if (running) {
      console.log(G(`✔ MarketLink is already running → http://localhost:${p}`) + "  (opening browser)");
      openBrowser(`http://localhost:${p}`);
      process.exit(0);
    }
  }
  const port = await findPort(preferred);
  if (port !== preferred) console.log(Y(`• Port ${preferred} is busy, using ${port} instead`));

  const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "start", "-p", String(port), "-H", "0.0.0.0"], { stdio: ["ignore", "pipe", "pipe"], env: process.env });
  child.stdout.on("data", (d) => process.stdout.write(d));
  child.stderr.on("data", (d) => process.stderr.write(d));
  child.on("exit", (code) => { if (code) console.error(R(`Server stopped (exit code ${code}).`)); process.exit(code || 0); });
  const stop = () => { child.kill(); process.exit(0); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  // 6. Wait until the server answers, then warm up (creates tables + demo data on first run)
  const local = `http://localhost:${port}`;
  let ok = false;
  for (let i = 0; i < 120 && !ok; i++) {
    ok = (await get(`http://127.0.0.1:${port}/api/health`, 3000)) === 200;
    if (!ok) await new Promise((r) => setTimeout(r, 1000));
  }
  if (!ok) fail("Server did not become healthy. If you set DATABASE_URL in .env, check PostgreSQL is running, or remove that line to use the built-in database.");
  console.log(Y("• Preparing database & demo data (first run takes ~10 s)…"));
  await get(`http://127.0.0.1:${port}/login`, 120000);

  const lan = lanAddresses();
  console.log("\n" + G("═".repeat(58)));
  console.log(B(G("  ✅ MarketLink is running!")));
  console.log(`  On this computer:   ${B(local)}`);
  lan.forEach((ip) => console.log(`  Phone / same Wi-Fi: ${B(`http://${ip}:${port}`)}`));
  console.log(`  Demo login:         farmer@marketlink.pk / password123`);
  console.log(`  Stop the server:    press Ctrl + C (keep this window open while using the site)`);
  console.log(G("═".repeat(58)) + "\n");
  openBrowser(local);
})();
