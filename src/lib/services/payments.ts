import { createCipheriv, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { paymentIntents, payoutRequests, users, walletTransactions } from "@/db/schema";
import { ApiError } from "@/lib/api";
import { absoluteUrl, isValidHttpUrl, publicOrigin } from "@/lib/base-url";
import type { SessionUser } from "@/lib/auth";
import { notify } from "@/lib/notify";

export type Provider = "stripe" | "jazzcash" | "easypaisa" | "sandbox";
const r2 = (n: number) => Math.round(n * 100) / 100;
const live = () => process.env.PAYMENTS_MODE === "live";

export function providerStatus(): Record<Provider, { enabled: boolean; label: string; mode: string }> {
  return {
    stripe: { enabled: !!process.env.STRIPE_SECRET_KEY, label: "Card (Stripe)", mode: process.env.STRIPE_SECRET_KEY?.startsWith("sk_live") ? "live" : "test" },
    jazzcash: { enabled: !!(process.env.JAZZCASH_MERCHANT_ID && process.env.JAZZCASH_PASSWORD && process.env.JAZZCASH_INTEGRITY_SALT), label: "JazzCash", mode: live() ? "live" : "sandbox" },
    easypaisa: { enabled: !!(process.env.EASYPAISA_STORE_ID && process.env.EASYPAISA_HASH_KEY), label: "Easypaisa", mode: live() ? "live" : "sandbox" },
    sandbox: { enabled: process.env.PAYMENTS_SANDBOX !== "false", label: "Test gateway (no real money)", mode: "test" },
  };
}

export type Checkout = { reference: string; redirectUrl?: string; form?: { action: string; fields: Record<string, string> } };

/**
 * Step 1: create a pending payment intent and hand the browser to the gateway.
 * The wallet is credited ONLY by a verified callback.
 * Every URL returned here is validated: it must be an absolute http(s) URL, so a bad request host
 * or proxy header can never send the buyer to a bind address (ERR_ADDRESS_INVALID).
 */
export async function createCheckout(user: SessionUser, provider: Provider, amount: number, req: Request): Promise<Checkout> {
  const checkout = await buildCheckout(user, provider, amount, req);
  if (checkout.redirectUrl && !isValidHttpUrl(checkout.redirectUrl)) {
    throw new ApiError(500, "Could not build a valid payment redirect URL. Please check the server's APP_URL / forwarded host headers.");
  }
  if (checkout.form && !isValidHttpUrl(checkout.form.action)) {
    throw new ApiError(500, "Could not build a valid gateway address. Please check the server's APP_URL / forwarded host headers.");
  }
  return checkout;
}

async function buildCheckout(user: SessionUser, provider: Provider, amount: number, req: Request): Promise<Checkout> {
  if (!providerStatus()[provider]?.enabled) throw new ApiError(400, `${provider} is not configured on this server`);
  if (amount < 1000 || amount > 50_000_000) throw new ApiError(422, "Amount must be between Rs. 1,000 and Rs. 5 Crore");
  const reference = `MLT${Date.now()}${randomBytes(3).toString("hex").toUpperCase()}`;
  await db.insert(paymentIntents).values({ reference, userId: user.id, provider, amount: r2(amount) });
  // The visitor's own host (x-forwarded-host / host) decides the origin — never the bind address
  // the server listens on, and never a hardcoded localhost:3000.
  const base = publicOrigin(req);
  const successUrl = `${base}/wallet?payment=${reference}`;

  if (provider === "sandbox") return { reference, redirectUrl: absoluteUrl(req, `/pay/sandbox/${reference}`) };

  if (provider === "stripe") {
    const body = new URLSearchParams({
      mode: "payment",
      success_url: successUrl,
      cancel_url: `${base}/wallet?payment=${reference}&cancelled=1`,
      client_reference_id: reference,
      "metadata[reference]": reference,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "pkr",
      "line_items[0][price_data][unit_amount]": String(Math.round(amount * 100)),
      "line_items[0][price_data][product_data][name]": "MarketLink wallet top-up",
      customer_email: user.email,
    });
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as { id?: string; url?: string; error?: { message: string } };
    if (!res.ok || !data.url) throw new ApiError(502, `Stripe error: ${data.error?.message ?? res.status}`);
    if (!isValidHttpUrl(data.url)) throw new ApiError(502, "Stripe returned an invalid checkout URL");
    await db.update(paymentIntents).set({ providerRef: data.id }).where(eq(paymentIntents.reference, reference));
    return { reference, redirectUrl: data.url };
  }

  if (provider === "jazzcash") {
    const now = new Date(Date.now() + 5 * 3600_000); // PKT
    const fmt = (d: Date) => d.toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const fields: Record<string, string> = {
      pp_Version: "1.1",
      pp_TxnType: "",
      pp_Language: "EN",
      pp_MerchantID: process.env.JAZZCASH_MERCHANT_ID!,
      pp_SubMerchantID: "",
      pp_Password: process.env.JAZZCASH_PASSWORD!,
      pp_BankID: "",
      pp_ProductID: "",
      pp_TxnRefNo: reference,
      pp_Amount: String(Math.round(amount * 100)),
      pp_TxnCurrency: "PKR",
      pp_TxnDateTime: fmt(now),
      pp_BillReference: "walletTopup",
      pp_Description: "MarketLink wallet top-up",
      pp_TxnExpiryDateTime: fmt(new Date(now.getTime() + 60 * 60_000)),
      pp_ReturnURL: `${base}/api/payments/callback/jazzcash`,
      ppmpf_1: String(user.id),
    };
    fields.pp_SecureHash = jazzcashHash(fields);
    return { reference, form: { action: live() ? "https://payments.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/" : "https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/", fields } };
  }

  // Easypaisa hosted checkout
  const expiry = new Date(Date.now() + 5 * 3600_000 + 60 * 60_000).toISOString().replace(/[-:]/g, "").replace("T", " ").slice(0, 15);
  const params: Record<string, string> = {
    amount: amount.toFixed(1),
    autoRedirect: "1",
    emailAddr: user.email,
    expiryDate: expiry,
    mobileNum: user.phone.replace(/\D/g, "").replace(/^92/, "0"),
    orderRefNum: reference,
    paymentMethod: "MA_PAYMENT_METHOD",
    postBackURL: `${base}/api/payments/callback/easypaisa`,
    storeId: process.env.EASYPAISA_STORE_ID!,
  };
  const plain = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
  const cipher = createCipheriv("aes-128-ecb", Buffer.from(process.env.EASYPAISA_HASH_KEY!, "utf8").subarray(0, 16), null);
  params.merchantHashedReq = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]).toString("base64");
  return { reference, form: { action: live() ? "https://easypay.easypaisa.com.pk/easypay/Index.jsf" : "https://easypaystg.easypaisa.com.pk/easypay/Index.jsf", fields: params } };
}

/** JazzCash pp_SecureHash: HMAC-SHA256(salt, salt&v1&v2… of non-empty pp_* fields sorted by key). */
export function jazzcashHash(fields: Record<string, string>) {
  const salt = process.env.JAZZCASH_INTEGRITY_SALT!;
  const values = Object.keys(fields).filter((k) => k.startsWith("pp") && k !== "pp_SecureHash" && fields[k] !== "").sort().map((k) => fields[k]);
  return createHmac("sha256", salt).update([salt, ...values].join("&")).digest("hex").toUpperCase();
}

/** Stripe-Signature verification: t=<ts>,v1=<hmac(secret, `${t}.${rawBody}`)>, 5-minute tolerance. */
export function verifyStripeSignature(rawBody: string, header: string | null) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  return sigs.some((s) => s.length === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}

/** Sandbox callbacks are HMAC-signed server-side so they can't be forged from the browser. */
export function sandboxSignature(reference: string, outcome: string) {
  return createHmac("sha256", process.env.SESSION_SECRET || "marketlink-agri-hub-dev-secret-change-me").update(`sandbox:${reference}:${outcome}`).digest("hex");
}

/** Step 2 (webhook / callback): idempotently settle the intent and credit the wallet on success. */
export async function completeIntent(reference: string, success: boolean, providerRef?: string, raw?: unknown) {
  const result = await db.transaction(async (tx) => {
    const [pi] = await tx.select().from(paymentIntents).where(eq(paymentIntents.reference, reference)).for("update").limit(1);
    if (!pi) throw new ApiError(404, "Unknown payment reference");
    if (pi.status !== "pending") return { intent: pi, changed: false };
    await tx
      .update(paymentIntents)
      .set({ status: success ? "succeeded" : "failed", providerRef: providerRef ?? pi.providerRef, rawCallback: raw ? JSON.stringify(raw).slice(0, 4000) : null, completedAt: new Date() })
      .where(eq(paymentIntents.intentId, pi.intentId));
    if (success) {
      await tx.update(users).set({ walletBalance: sql`${users.walletBalance} + ${pi.amount}` }).where(eq(users.id, pi.userId));
      await tx.insert(walletTransactions).values({ userId: pi.userId, type: "deposit", amount: pi.amount, description: `Top-up via ${pi.provider} · ref ${reference}` });
    }
    return { intent: { ...pi, status: success ? "succeeded" : "failed" }, changed: true };
  });
  if (result.changed) {
    const pi = result.intent;
    await notify(pi.userId, success
      ? { type: "payment", title: "Wallet funded", body: `Rs. ${pi.amount.toLocaleString("en-US")} was added to your MarketLink wallet (ref ${reference}).`, link: "/wallet", email: true }
      : { type: "payment", title: "Payment failed", body: `Your top-up of Rs. ${pi.amount.toLocaleString("en-US")} did not go through (ref ${reference}). No money was deducted.`, link: "/wallet" });
  }
  return result.intent;
}

export async function getIntent(user: SessionUser, reference: string) {
  const [pi] = await db.select().from(paymentIntents).where(eq(paymentIntents.reference, reference)).limit(1);
  if (!pi || (pi.userId !== user.id && user.role !== "admin")) throw new ApiError(404, "Payment not found");
  return { reference: pi.reference, provider: pi.provider, amount: pi.amount, status: pi.status, createdAt: pi.createdAt, completedAt: pi.completedAt };
}

/** Easypaisa: confirm the final status server-to-server before crediting (callback params alone are not trusted). */
export async function easypaisaInquire(reference: string): Promise<boolean> {
  const { EASYPAISA_USERNAME: u, EASYPAISA_PASSWORD: p, EASYPAISA_ACCOUNT_NUM: acc, EASYPAISA_STORE_ID: store } = process.env;
  if (!u || !p || !acc) return false;
  const url = live() ? "https://easypay.easypaisa.com.pk/easypay-service/rest/v4/inquire-transaction" : "https://easypaystg.easypaisa.com.pk/easypay-service/rest/v4/inquire-transaction";
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Credentials: Buffer.from(`${u}:${p}`).toString("base64") }, body: JSON.stringify({ orderId: reference, storeId: store, accountNum: acc }) });
  const data = (await res.json().catch(() => ({}))) as { transactionStatus?: string };
  return data.transactionStatus === "PAID";
}

/* ------------------------------------------------------------------ */
/* Farmer payouts                                                      */
/* ------------------------------------------------------------------ */
export async function requestPayout(farmer: SessionUser, input: { amount: number; method: "bank" | "jazzcash" | "easypaisa"; accountTitle: string; accountNumber: string }) {
  if (input.amount < 1000) throw new ApiError(422, "Minimum payout is Rs. 1,000");
  const row = await db.transaction(async (tx) => {
    const [u] = await tx.select().from(users).where(eq(users.id, farmer.id)).for("update");
    if (u.walletBalance < input.amount) throw new ApiError(402, `Insufficient balance. Available: Rs. ${u.walletBalance.toLocaleString("en-US")}`);
    const [p] = await tx.insert(payoutRequests).values({ farmerId: farmer.id, ...input }).returning();
    await tx.update(users).set({ walletBalance: r2(u.walletBalance - input.amount) }).where(eq(users.id, u.id));
    await tx.insert(walletTransactions).values({ userId: u.id, type: "withdrawal", amount: input.amount, description: `Payout request #${p.payoutId} to ${input.method.toUpperCase()} ${input.accountNumber.slice(-4).padStart(8, "•")}` });
    return p;
  });
  const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
  await Promise.all(admins.map((a) => notify(a.id, { type: "payout", title: "New payout request", body: `${farmer.fullName} requested Rs. ${input.amount.toLocaleString("en-US")} via ${input.method}.`, link: "/admin/dashboard" })));
  return row;
}

export async function listPayouts(user: SessionUser) {
  const q = db
    .select({ p: payoutRequests, farmerName: users.fullName, farmName: users.businessName })
    .from(payoutRequests)
    .innerJoin(users, eq(users.id, payoutRequests.farmerId))
    .orderBy(sql`case when ${payoutRequests.status} = 'pending' then 0 else 1 end`, desc(payoutRequests.createdAt))
    .limit(100);
  const rows = user.role === "admin" ? await q : await q.where(eq(payoutRequests.farmerId, user.id));
  return rows.map(({ p, ...rest }) => ({ ...p, ...rest }));
}

export async function processPayout(admin: SessionUser, payoutId: number, status: "paid" | "rejected", note?: string) {
  const p = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(payoutRequests).where(eq(payoutRequests.payoutId, payoutId)).for("update");
    if (!row) throw new ApiError(404, "Payout not found");
    if (row.status !== "pending") throw new ApiError(409, `Payout already ${row.status}`);
    await tx.update(payoutRequests).set({ status, adminNote: note ?? null, processedAt: new Date() }).where(eq(payoutRequests.payoutId, payoutId));
    if (status === "rejected") {
      await tx.update(users).set({ walletBalance: sql`${users.walletBalance} + ${row.amount}` }).where(eq(users.id, row.farmerId));
      await tx.insert(walletTransactions).values({ userId: row.farmerId, type: "refund", amount: row.amount, description: `Payout #${payoutId} rejected, funds returned` });
    }
    return row;
  });
  await notify(p.farmerId, status === "paid"
    ? { type: "payout", title: "Payout sent", body: `Rs. ${p.amount.toLocaleString("en-US")} was transferred to your ${p.method} account ${p.accountNumber}.`, link: "/wallet", email: true, sms: true }
    : { type: "payout", title: "Payout rejected", body: `Your payout of Rs. ${p.amount.toLocaleString("en-US")} was rejected${note ? `: ${note}` : ""}. The amount is back in your wallet.`, link: "/wallet", email: true });
  return { payoutId, status, processedBy: admin.id };
}
