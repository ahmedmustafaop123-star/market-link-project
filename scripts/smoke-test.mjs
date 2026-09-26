#!/usr/bin/env node
/**
 * MarketLink Agri-Hub · end-to-end function audit (smoke test).
 *
 * Exercises every role and API surface against a running server:
 *   node scripts/smoke-test.mjs                    # http://127.0.0.1:3000
 *   node scripts/smoke-test.mjs http://localhost:4000
 *   SMOKE_HOST=3000-abc.e2b.app node scripts/smoke-test.mjs   # simulate a public proxy host
 *
 * Safe to run repeatedly: it creates its own throw-away farmer account and its own listings,
 * and it never changes demo passwords (the reset-flow test runs on the account it just created).
 * Needs only Node.js 20+ (uses global fetch) and a running MarketLink server.
 */
const BASE = (process.argv[2] || process.env.SMOKE_BASE || "http://127.0.0.1:3000").replace(/\/$/, "");
const HOST = process.env.SMOKE_HOST || null; // optional Host header to simulate the proxy
const PW = "password123";
const stamp = Date.now().toString().slice(-7);

let pass = 0, fail = 0, skipped = 0;
const failures = [];
const ok = (m) => { pass++; console.log(`  ✅ ${m}`); };
const bad = (m, extra) => { fail++; failures.push(m); console.log(`  ❌ ${m}${extra ? ` → ${extra}` : ""}`); };
const chk = (cond, m, extra) => (cond ? ok(m) : bad(m, extra));
const head = (t) => console.log(`\n─ ${t}`);

/** Tiny cookie-jar client; a custom Host header keeps the proxy scenario realistic. */
function makeClient() {
  let cookie = "";
  return async function call(method, path, body, opts = {}) {
    const headers = { accept: "application/json" };
    if (HOST && !opts.noHost) { headers.host = HOST; headers["x-forwarded-proto"] = "https"; }
    if (body !== undefined) headers["content-type"] = "application/json";
    if (cookie && !opts.noCookie) headers.cookie = cookie;
    const res = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      if (pair.split("=")[0].trim() === "ml_session") cookie = /ml_session=;/.test(pair) ? "" : pair;
    }
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* html page */ }
    return { status: res.status, json, text, headers: res.headers, location: res.headers.get("location") };
  };
}

const login = async (c, email, password = PW) => {
  const r = await c("POST", "/api/auth/login", { email, password });
  return r.status === 200 && r.json?.success;
};

const run = async () => {
  const admin = makeClient(), farmer = makeClient(), buyer = makeClient(), inspector = makeClient(), guest = makeClient();
  const newUser = makeClient();

  head("Public endpoints");
  const health = await guest("GET", "/api/health");
  chk(health.json?.ok === true, "GET /api/health returns ok");
  const crops = await guest("GET", "/api/crops");
  chk(Array.isArray(crops.json?.data) && crops.json.data.length > 0, `GET /api/crops lists the marketplace (${crops.json?.data?.length ?? 0} listings)`);
  chk((await guest("GET", "/api/mandi-rates")).json?.success === true, "GET /api/mandi-rates returns market rates");
  chk((await guest("GET", "/api/crops?category=grains&sort=price_asc")).json?.success === true, "GET /api/crops with filters/sorting works");
  chk((await guest("GET", "/api/crops?q=wheat")).json?.success === true, "GET /api/crops?q= search works");

  head("Authentication & registration");
  const dupe = await newUser("POST", "/api/auth/register", { fullName: "Test", email: "buyer@marketlink.pk", password: "Password123", phone: "03001234567", role: "buyer", city: "Lahore" });
  chk(dupe.status === 409, "register rejects a duplicate email (409)");
  const badPhone = await newUser("POST", "/api/auth/register", { fullName: "Test", email: `bad${stamp}@x.pk`, password: "Password123", phone: "12345", role: "farmer", city: "Lahore" });
  chk(badPhone.status === 422, "register validates the Pakistani mobile number (422)");
  const email = `smoke${stamp}@marketlink.pk`;
  const reg = await newUser("POST", "/api/auth/register", { fullName: "Smoke Farmer", email, password: "Password123", phone: "03001234567", role: "farmer", city: "Multan", cnicId: "36302-1234567-1" });
  chk(reg.status === 201 && reg.json?.data?.needsVerification === true, "register creates an unverified farmer account");
  const code = reg.json?.data?.devCode;
  chk((await newUser("POST", "/api/auth/verify-email", { email, code: "000000" })).status >= 400, "wrong email OTP is rejected");
  const verify = await newUser("POST", "/api/auth/verify-email", { email, code });
  chk(verify.json?.data?.verified === true, "correct email OTP verifies the account and signs in");
  chk((await newUser("GET", "/api/auth/me")).json?.data?.role === "farmer", "GET /api/auth/me returns the new session's role");

  for (const [name, c, mail] of [["admin", admin, "ahmed.mustafa@admin.com"], ["farmer", farmer, "farmer@marketlink.pk"], ["buyer", buyer, "buyer@marketlink.pk"], ["inspector", inspector, "inspector@marketlink.pk"]]) {
    chk(await login(c, mail), `login as ${name} (${mail})`);
  }
  chk((await makeClient()("POST", "/api/auth/login", { email: "farmer@marketlink.pk", password: "wrong-password" })).status === 401, "login with a wrong password is rejected (401)");

  head("RBAC / access control");
  chk((await makeClient()("GET", "/api/wallet")).status === 401, "unauthenticated /api/wallet → 401");
  chk((await buyer("GET", "/api/admin/users")).status === 403, "buyer cannot read /api/admin/users → 403");
  chk((await farmer("GET", "/api/wallet")).status === 200, "farmer has a wallet");
  chk((await inspector("GET", "/api/wallet")).status === 403, "inspector cannot access the wallet → 403");
  chk((await buyer("POST", "/api/crops", { cropName: "x", category: "grains", qualityGrade: "A", totalQuantityKg: 10, basePricePerKg: 10, harvestDate: "2026-01-01", farmLocation: "Multan" })).status === 403, "buyer cannot create a listing → 403");

  head("Farmer: listing management");
  const createCrop = await farmer("POST", "/api/crops", {
    cropName: "Smoke Test Wheat", category: "grains", qualityGrade: "A", totalQuantityKg: 5000,
    basePricePerKg: 95, harvestDate: new Date().toISOString().slice(0, 10), farmLocation: "Multan",
    description: "Automated audit listing", isOrganic: true,
  });
  const cropId = createCrop.json?.data?.cropId ?? createCrop.json?.data?.crop?.cropId;
  chk(createCrop.status === 201 && !!cropId, `farmer creates a listing (cropId ${cropId})`, createCrop.text?.slice(0, 160));
  chk((await farmer("PATCH", `/api/crops/${cropId}`, { basePricePerKg: 99 })).status === 200, "farmer edits the listing price");
  chk(((await farmer("GET", "/api/crops?mine=1")).json?.data ?? []).some((c) => c.cropId === cropId), "farmer sees the listing in 'my listings'");
  chk((await guest("GET", `/api/crops/${cropId}`)).status === 200, "public listing detail data loads");

  head("Buyer: bidding");
  const bid = await buyer("POST", "/api/bids", { cropId, bidPricePerKg: 92, bidQuantityKg: 1000, message: "Audit offer" });
  const bidId = bid.json?.data?.bidId ?? bid.json?.data?.bid?.bidId;
  chk(bid.status === 201 && !!bidId, `buyer places a bid (bidId ${bidId})`, bid.text?.slice(0, 160));
  chk((await farmer("GET", "/api/bids")).json?.data?.some((b) => b.bidId === bidId) ?? false, "farmer sees the incoming bid");
  chk((await farmer("PATCH", `/api/bids/${bidId}`, { action: "counter", counterPrice: 98 })).status === 200, "farmer sends a counter-offer");
  const acceptCounter = await buyer("PATCH", `/api/bids/${bidId}`, { action: "accept_counter" });
  chk(acceptCounter.status === 200, "buyer accepts the counter-offer");
  const orderId = acceptCounter.json?.data?.orderId ?? acceptCounter.json?.data?.order?.orderId;
  chk(!!orderId, `accepted bid produced an order (orderId ${orderId})`, acceptCounter.text?.slice(0, 200));

  head("Escrow funding");
  const ordersBuyer = await buyer("GET", "/api/orders");
  const myOrder = (ordersBuyer.json?.data ?? []).find((o) => o.orderId === orderId);
  chk(myOrder?.paymentStatus === "awaiting_escrow", "order starts awaiting escrow");
  const trackingNumber = myOrder?.trackingNumber;
  chk((await inspector("PATCH", `/api/orders/${orderId}`, { action: "advance" })).status === 409, "order cannot progress before escrow is funded (409)");
  const topUp = await buyer("POST", "/api/payments/checkout", { provider: "sandbox", amount: 500000 });
  const ref = topUp.json?.data?.reference;
  chk(topUp.status === 201 && !!ref, "buyer starts a sandbox wallet top-up");
  chk(/^https?:\/\//.test(topUp.json?.data?.redirectUrl ?? ""), "top-up returns an absolute redirect URL", topUp.json?.data?.redirectUrl);
  chk((await buyer("POST", `/api/payments/sandbox/${ref}`, { outcome: "success" })).json?.data?.status === "succeeded", "gateway callback settles the top-up");
  const walletBeforeLock = (await buyer("GET", "/api/wallet")).json?.data?.escrowBalance ?? 0;
  const lock = await buyer("PATCH", `/api/orders/${orderId}`, { action: "lock_escrow" });
  chk(lock.status === 200, "buyer locks funds in escrow", lock.text?.slice(0, 160));
  chk(((await buyer("GET", "/api/wallet")).json?.data?.escrowBalance ?? 0) > walletBeforeLock, "escrow balance increases after locking");

  head("Delivery pipeline");
  chk((await buyer("PATCH", `/api/orders/${orderId}`, { action: "advance" })).status === 403, "buyer cannot run the inspector's quality-check step (403)");
  const qc = await inspector("PATCH", `/api/orders/${orderId}`, { action: "advance", grade: "A", moisture: 11.5, note: "Audit inspection" });
  chk(qc.status === 200, "inspector marks the order quality-checked", qc.text?.slice(0, 160));
  chk((await farmer("PATCH", `/api/orders/${orderId}`, { action: "advance", location: "Multan" })).status === 200, "farmer dispatches the shipment");
  chk((await farmer("PATCH", `/api/orders/${orderId}`, { action: "advance", location: "Sahiwal" })).status === 200, "farmer moves it to in-transit");
  chk((await farmer("PATCH", `/api/orders/${orderId}`, { action: "update_location", location: "Lahore Ring Road" })).status === 200, "farmer records a transit checkpoint");
  const buyerJump = await buyer("PATCH", `/api/orders/${orderId}`, { action: "advance" });
  chk(buyerJump.status === 200 && buyerJump.json?.data?.paymentStatus === "released", "buyer confirms delivery → escrow released", buyerJump.text?.slice(0, 200));
  chk((await buyer("GET", `/api/orders/${orderId}`)).json?.data?.deliveryStage === "delivered" || (await buyer("GET", `/api/orders/${orderId}`)).json?.data?.order?.deliveryStage === "delivered", "order detail shows delivered");
  chk((await guest("GET", `/api/tracking/${trackingNumber}`)).status === 200, `public tracking lookup works (${trackingNumber})`);

  head("Wallet, payouts, reporting");
  chk(((await buyer("GET", "/api/wallet")).json?.data?.escrowBalance ?? -1) === walletBeforeLock, "escrow balance returns to its previous value after release");
  chk(((await buyer("GET", "/api/wallet")).json?.data?.transactions ?? []).some((t) => t.type === "escrow_lock"), "ledger contains the escrow lock entry");
  chk(((await farmer("GET", "/api/wallet")).json?.data?.walletBalance ?? 0) > 0, "farmer wallet received the payout");
  const payoutReq = await farmer("POST", "/api/payouts", { amount: 5000, method: "jazzcash", accountTitle: "Muhammad Aslam", accountNumber: "03014455667" });
  const payoutId = payoutReq.json?.data?.payoutId;
  chk(payoutReq.status === 201 && !!payoutId, `farmer requests a payout (id ${payoutId})`, payoutReq.text?.slice(0, 160));
  chk((await farmer("POST", "/api/payouts", { amount: 100, method: "bank", accountTitle: "x", accountNumber: "1" })).status === 422, "payout below the Rs. 1,000 minimum is rejected");
  chk(Array.isArray((await admin("GET", "/api/payouts")).json?.data), "admin lists payout requests");
  chk((await admin("PATCH", `/api/payouts/${payoutId}`, { status: "paid" })).status === 200, "admin marks the payout as paid");
  chk((await farmer("GET", "/api/reports/summary")).status === 200, "farmer report summary loads");

  head("Reviews");
  const review = await buyer("POST", "/api/reviews", { orderId, rating: 5, comment: "Audit: excellent wheat, on time." });
  const reviewId = review.json?.data?.review?.reviewId;
  chk(review.status === 201 && !!reviewId, `buyer reviews the delivered order (reviewId ${reviewId})`, review.text?.slice(0, 160));
  chk((await buyer("POST", "/api/reviews", { orderId, rating: 4 })).status === 409, "duplicate review is rejected (409)");
  chk((await buyer("GET", "/api/reviews?pending=1")).status === 200, "buyer pending-review list loads");
  const reply = await farmer("POST", `/api/reviews/${reviewId}/reply`, { reply: "Shukriya! Always welcome." });
  chk(reply.status === 200 || reply.status === 201, "farmer replies to the review", reply.text?.slice(0, 160));

  head("Disputes");
  const crop2 = await farmer("POST", "/api/crops", { cropName: "Smoke Test Cotton", category: "cash_crops", qualityGrade: "B", totalQuantityKg: 2000, basePricePerKg: 250, harvestDate: new Date().toISOString().slice(0, 10), farmLocation: "Multan" });
  const crop2Id = crop2.json?.data?.cropId ?? crop2.json?.data?.crop?.cropId;
  const bid2 = await buyer("POST", "/api/bids", { cropId: crop2Id, bidPricePerKg: 250, bidQuantityKg: 500 });
  const bid2Id = bid2.json?.data?.bidId ?? bid2.json?.data?.bid?.bidId;
  const accept2 = await farmer("PATCH", `/api/bids/${bid2Id}`, { action: "accept" });
  const order2 = accept2.json?.data?.orderId ?? accept2.json?.data?.order?.orderId;
  chk(!!order2, `second order created for the dispute test (orderId ${order2})`, accept2.text?.slice(0, 160));
  chk((await buyer("PATCH", `/api/orders/${order2}`, { action: "lock_escrow" })).status === 200, "escrow funded on the second order");
  const dispute = await buyer("POST", `/api/orders/${order2}/dispute`, { reason: "Audit: quality mismatch on arrival" });
  chk(dispute.status === 201 || dispute.status === 200, "buyer raises a dispute", dispute.text?.slice(0, 160));
  chk((await farmer("PATCH", `/api/orders/${order2}`, { action: "advance" })).status === 409, "order progression freezes while disputed (409)");
  const disputes = await admin("GET", "/api/admin/disputes");
  chk(Array.isArray(disputes.json?.data), "admin lists disputes");
  const disputeId = (disputes.json?.data ?? [])[0]?.disputeId;
  chk((await admin("PATCH", `/api/admin/disputes/${disputeId}`, { outcome: "investigating", resolution: "Audit: under review" })).status === 200, "admin marks the dispute as investigating");
  const refund = await admin("PATCH", `/api/admin/disputes/${disputeId}`, { outcome: "refund", resolution: "Audit: refunded to buyer" });
  chk(refund.status === 200, "admin refunds the buyer", refund.text?.slice(0, 160));
  chk(((await buyer("GET", "/api/wallet")).json?.data?.transactions ?? []).some((t) => t.type === "refund"), "refund appears in the buyer's ledger");

  head("Admin console");
  chk(((await admin("GET", "/api/admin/users")).json?.data ?? []).length > 5, "admin lists users");
  const newInspector = await admin("POST", "/api/admin/users", { fullName: "Smoke Inspector", email: `insp${stamp}@marketlink.pk`, password: "Inspect@2026", phone: "03009998877", role: "inspector", city: "Multan" });
  chk(newInspector.status === 201, "admin creates an inspector account", newInspector.text?.slice(0, 160));
  const inspectorId = newInspector.json?.data?.id ?? newInspector.json?.data?.user?.id;
  chk((await admin("PATCH", `/api/admin/users/${inspectorId}`, { isVerified: true })).status === 200, "admin verifies a user");
  chk((await admin("PATCH", `/api/admin/users/${inspectorId}`, { newPassword: "Inspect@2027" })).status === 200, "admin resets a user password");
  chk((await admin("GET", "/api/analytics")).status === 200, "admin analytics load");
  chk((await admin("GET", "/api/reports/summary")).status === 200, "admin report summary loads");
  const ratePost = await admin("POST", "/api/mandi-rates", { cropName: "Wheat", marketLocation: "Lahore", minPricePerKg: 88, maxPricePerKg: 96, avgPricePerKg: 92 });
  chk(ratePost.status === 201 || ratePost.status === 200, "admin enters a mandi rate", ratePost.text?.slice(0, 160));
  chk(((await guest("GET", "/api/mandi-rates")).json?.data ?? []).length > 0, "updated mandi rates are public");
  chk((await admin("GET", "/api/db/schema")).status === 200, "admin DB schema explorer loads");
  const query = await admin("POST", "/api/db/query", { sql: "select count(*) as users from users", mode: "read" });
  chk(query.status === 200, "admin read-only SQL console works", query.text?.slice(0, 160));
  const blocked = await admin("POST", "/api/db/query", { sql: "drop table users", mode: "write", confirm: true });
  chk(blocked.status === 400 || blocked.status === 403, "dangerous SQL is blocked by the console");
  chk((await inspector("GET", "/api/inspections")).status === 200, "inspector lists inspections");
  const inspectNew = await inspector("POST", "/api/inspections", { cropId, gradeAssigned: "A", moistureLevelPercentage: 11, soilPh: 7.2, inspectionNotes: "Audit inspection", status: "passed", reportFileName: "audit-report.txt", reportAttachment: "MarketLink audit inspection report" });
  chk(inspectNew.status === 201 || inspectNew.status === 200, "inspector files an inspection report", inspectNew.text?.slice(0, 160));
  const inspId = inspectNew.json?.data?.inspectionId ?? inspectNew.json?.data?.inspection?.inspectionId ?? inspectNew.json?.data?.id;
  chk((await inspector("GET", `/api/inspections/${inspId}/report`)).status === 200, "inspection report file downloads");

  head("Notifications, account, assistant");
  const notifs = await buyer("GET", "/api/notifications");
  const notifItems = notifs.json?.data?.items ?? [];
  chk(notifItems.length > 0, `buyer has notifications (${notifItems.length}, unread ${notifs.json?.data?.unread})`);
  chk((await buyer("PATCH", "/api/notifications", {})).status === 200, "mark all notifications read");
  chk((await buyer("PATCH", "/api/account/profile", { fullName: "Imran Qureshi", phone: "+92 321 1234567", city: "Lahore", businessName: "Qureshi Wholesale Traders", address: "Badami Bagh Grain Market, Lahore" })).status === 200, "account profile update saves");
  chk((await buyer("PATCH", "/api/account/password", { currentPassword: PW, newPassword: "NewPass12345" })).status === 200, "password change works");
  chk(await login(makeClient(), "buyer@marketlink.pk", "NewPass12345"), "login with the new password works");
  chk((await buyer("PATCH", "/api/account/password", { currentPassword: "NewPass12345", newPassword: PW })).status === 200, "password reverted for repeatable tests");
  chk((await buyer("PATCH", "/api/account/password", { currentPassword: PW, newPassword: "short" })).status === 422, "weak password is rejected");
  const chat = await guest("POST", "/api/assistant", { message: "How does escrow work?" });
  chk(chat.status === 200 && typeof chat.json?.data?.reply === "string", "AI assistant answers (rule-based fallback when no key)");

  head("Password reset flow (on the freshly registered account — demo logins stay untouched)");
  const forgot = await guest("POST", "/api/auth/forgot-password", { email });
  const token = (forgot.json?.data?.devResetUrl ?? "").split("token=")[1];
  if (forgot.status === 429) {
    skipped++;
    console.log("  ⏭ skipped reset-flow checks — per-IP throttle active (8 requests / 10 min); restart the server for a clean run");
  } else {
    chk(!!token, "forgot-password issues a reset link", forgot.text?.slice(0, 160));
    chk(!forgot.json?.data?.devResetUrl || forgot.json.data.devResetUrl.startsWith("/"), "reset link is a relative path (never a bind address)");
    chk((await guest("GET", `/api/auth/reset-password?token=${token}`)).json?.data?.valid === true, "reset link validates");
    chk((await guest("POST", "/api/auth/reset-password", { token, newPassword: "ResetPass123" })).status === 200, "password reset succeeds");
    chk(await login(makeClient(), email, "ResetPass123"), "the account logs in with the reset password");
    chk((await guest("POST", "/api/auth/reset-password", { token, newPassword: "Another12345" })).status >= 400, "reset token is single-use");
  }
  const unknownEmail = await guest("POST", "/api/auth/forgot-password", { email: `nobody${stamp}@marketlink.pk` });
  chk(unknownEmail.status === 429 || (unknownEmail.json?.data?.sent === true && !unknownEmail.json?.data?.devResetUrl),
    `forgot-password does not reveal unknown accounts (status ${unknownEmail.status})`);

  head("Pages (server-rendered routes)");
  const pages = [
    ["/", guest], ["/login", guest], ["/register", guest], ["/marketplace", guest], ["/mandi-rates", guest],
    ["/docs", guest], ["/deploy", guest], ["/forgot-password", guest], ["/tracking", guest],
    ["/buyer/dashboard", buyer], ["/buyer/orders", buyer], ["/buyer/bids", buyer], ["/wallet", buyer],
    ["/notifications", buyer], ["/account", buyer],
    ["/farmer/dashboard", farmer], ["/farmer/listings", farmer], ["/farmer/orders", farmer], ["/farmer/bids", farmer], ["/farmer/reviews", farmer],
    ["/inspector/dashboard", inspector],
    ["/admin/dashboard", admin], ["/admin/users", admin], ["/admin/verification", admin], ["/admin/mandi", admin], ["/admin/orders", admin], ["/admin/db-explorer", admin],
  ];
  for (const [path, client] of pages) {
    const r = await client("GET", path);
    chk(r.status === 200, `page ${path} renders (200)`, `got ${r.status}`);
  }
  const adminIndex = await admin("GET", "/admin");
  chk(adminIndex.status === 307 && (adminIndex.location ?? "").includes("/admin/dashboard"), "/admin redirects to /admin/dashboard (307)");
  const redirect = await guest("GET", "/wallet");
  chk(redirect.status === 307 && (redirect.location ?? "").includes("/login"), "guest visiting /wallet is redirected to /login (307, relative)");

  console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} passed, ${fail} failed${skipped ? `, ${skipped} skipped` : ""}`);
  if (fail) console.log(failures.map((f) => `   • ${f}`).join("\n"));
  process.exit(fail ? 1 : 0);
};

run().catch((e) => { console.error("smoke run crashed:", e); process.exit(2); });
