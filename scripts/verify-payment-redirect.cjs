#!/usr/bin/env node
/* eslint-disable */
/**
 * Checks that the escrow/buyer checkout redirect is a usable absolute HTTPS URL.
 *
 *   node scripts/verify-payment-redirect.cjs                       # against http://127.0.0.1:3000
 *   node scripts/verify-payment-redirect.cjs --base=https://my.app
 *   node scripts/verify-payment-redirect.cjs --host=3000-abc.e2b.app   # simulate the public Host header
 *   node scripts/verify-payment-redirect.cjs --host=3000-abc.e2b.app --full
 *
 * Regression guard for ERR_ADDRESS_INVALID: a redirect URL must never point at a bind or loopback
 * address (0.0.0.0, ::, *) and must be a well-formed absolute http(s) URL.
 *
 * Uses the demo buyer account (buyer@marketlink.pk / password123) — see .env.example / README.
 * Requires a running server; no dependencies beyond Node.js 20+.
 */
const http = require("http");
const https = require("https");
const { URL } = require("url");

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const value = hit.includes("=") ? hit.slice(hit.indexOf("=") + 1) : "";
  return value || true;
};

const BASE = String(arg("base", process.env.BASE_URL || "http://127.0.0.1:3000")).replace(/\/$/, "");
const HOST_HEADER = arg("host", "");
const FULL = !!arg("full", false);
const EMAIL = String(arg("email", "buyer@marketlink.pk"));
const PASSWORD = String(arg("password", "password123"));
const AMOUNT = Number(arg("amount", 250000));

let failures = 0;
const pass = (msg) => console.log(`  ✅ ${msg}`);
const fail = (msg) => { failures++; console.log(`  ❌ ${msg}`); };
const check = (ok, msg) => (ok ? pass(msg) : fail(msg));

/** Minimal request helper: node:http is used so a custom Host header can be sent (fetch forbids it). */
function request(method, path, { body, cookie, hostHeader } = {}) {
  const url = new URL(path, BASE);
  const payload = body === undefined ? null : JSON.stringify(body);
  const headers = { accept: "application/json" };
  if (payload) { headers["content-type"] = "application/json"; headers["content-length"] = Buffer.byteLength(payload); }
  if (cookie) headers.cookie = cookie;
  if (hostHeader) { headers.host = hostHeader; headers["x-forwarded-proto"] = url.protocol === "https:" ? "https" : "http"; }
  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.request({ method, protocol: url.protocol, hostname: url.hostname, port: url.port || undefined, path: url.pathname + url.search, headers }, (res) => {
      let text = "";
      res.on("data", (c) => (text += c));
      res.on("end", () => {
        let json = null;
        try { json = JSON.parse(text); } catch { /* non-JSON page */ }
        resolve({ status: res.statusCode, headers: res.headers, text, json });
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const isBindHost = (hostname) => /^(0\.0\.0\.0|0|::|\*|\[::\])$/i.test(hostname);

(async () => {
  const suffix = HOST_HEADER ? ` (Host: ${HOST_HEADER})` : "";
  console.log(`\n🔎 Escrow payment redirect check — ${BASE}${suffix}\n`);

  const health = await request("GET", "/api/health", { hostHeader: HOST_HEADER }).catch((e) => e);
  if (!health || health.status !== 200) {
    console.error(`✖ Server not reachable at ${BASE}. Start it first (npm run dev / npm start).\n`);
    process.exit(1);
  }

  const login = await request("POST", "/api/auth/login", { body: { email: EMAIL, password: PASSWORD }, hostHeader: HOST_HEADER });
  const setCookie = login.headers["set-cookie"] || [];
  const cookie = (Array.isArray(setCookie) ? setCookie : [setCookie]).map((c) => c.split(";")[0]).join("; ");
  if (!login.json?.success) {
    console.error(`✖ Login failed for ${EMAIL}: ${login.json?.error || login.status}. Use --email/--password for another account.\n`);
    process.exit(1);
  }
  pass(`signed in as ${EMAIL}`);

  const walletBefore = await request("GET", "/api/wallet", { cookie, hostHeader: HOST_HEADER });
  const balanceBefore = walletBefore.json?.data?.walletBalance ?? 0;

  const checkout = await request("POST", "/api/payments/checkout", { cookie, hostHeader: HOST_HEADER, body: { provider: "sandbox", amount: AMOUNT } });
  const data = checkout.json?.data;
  if (!data?.redirectUrl) { fail(`checkout did not return a redirect URL: ${checkout.text.slice(0, 200)}`); process.exit(1); }

  const target = new URL(data.redirectUrl);
  const looksAbsolute = /^https?:\/\//i.test(data.redirectUrl);
  check(looksAbsolute, `redirect URL is an absolute ${target.protocol.replace(":", "")} URL: ${data.redirectUrl}`);
  check(!isBindHost(target.hostname), `redirect host "${target.hostname}" is not a bind address (0.0.0.0 / :: / *)`);
  const localHost = target.hostname === "localhost" || /^127\./.test(target.hostname) || /^\d+\.\d+\.\d+\.\d+$/.test(target.hostname) || target.hostname.endsWith(".local");
  check(target.protocol === "https:" || localHost, "scheme matches the host (https for public hosts)");
  if (HOST_HEADER) check(target.host.split(":")[0] === HOST_HEADER.split(":")[0], `redirect host matches the requested host "${HOST_HEADER}"`);

  const page = await request("GET", `${target.pathname}${target.search}`, { cookie, hostHeader: HOST_HEADER });
  check(page.status === 200 && page.text.includes(data.reference), `checkout page opens and shows reference ${data.reference}`);

  if (FULL) {
    const pay = await request("POST", `/api/payments/sandbox/${data.reference}`, { cookie, hostHeader: HOST_HEADER, body: { outcome: "success" } });
    check(pay.json?.data?.status === "succeeded", "signed gateway callback settled the payment");
    const walletAfter = await request("GET", "/api/wallet", { cookie, hostHeader: HOST_HEADER });
    const balanceAfter = walletAfter.json?.data?.walletBalance ?? 0;
    check(balanceAfter === balanceBefore + AMOUNT, `wallet credited Rs. ${AMOUNT.toLocaleString("en-US")} (${balanceBefore} → ${balanceAfter})`);
  }

  console.log(failures === 0 ? "\n✅ Payment redirect resolution looks correct.\n" : `\n❌ ${failures} check(s) failed.\n`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error(`\n✖ ${e.message}\n`);
  process.exit(1);
});
