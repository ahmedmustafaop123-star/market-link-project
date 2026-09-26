import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications, users } from "@/db/schema";

/**
 * Notification service
 *  • in-app → stored in notifications
 *  • email → Resend when RESEND_API_KEY is configured (CID-embedded brand logo)
 *  • SMS → Twilio when its credentials are configured
 * Without provider keys, email/SMS go to the development server outbox.
 */
export const emailConfigured = () => !!process.env.RESEND_API_KEY;
export const smsConfigured = () => !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);

const APP_NAME = "MARKETLINK AGRI-HUB";
const LOGO_CID = "marketlink-brand";
let logoBase64: string | null | undefined;

async function loadEmailLogo() {
  if (logoBase64 !== undefined) return logoBase64;
  try {
    const file = join(/* turbopackIgnore: true */ process.cwd(), "public", "brand", "marketlink-email.png");
    logoBase64 = (await readFile(file)).toString("base64");
  } catch (error) {
    console.error("[notify] email brand asset missing", error);
    logoBase64 = null;
  }
  return logoBase64;
}

/** Don't interpolate user-provided review text or messages directly into email HTML. */
const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

function emailHtml(title: string, body: string, link: string | undefined, logoAttached: boolean) {
  const safeLink = link?.startsWith("/") && !link.startsWith("//") ? link : undefined;
  const base = process.env.APP_URL?.replace(/\/$/, "");
  const destination = safeLink && base ? escapeHtml(`${base}${safeLink}`) : null;
  const logo = logoAttached
    ? `<img src="cid:${LOGO_CID}" width="260" height="60" alt="${APP_NAME}" style="display:block;width:260px;max-width:100%;height:auto;border:0">`
    : `<span style="color:#073e2b;font-size:20px;font-weight:800;letter-spacing:1px">MARKETLINK <span style="color:#d69924">AGRI-HUB</span></span>`;

  return `<div style="background:#f6f8f4;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#172b24">
    <div style="max-width:520px;margin:auto;border:1px solid #dce9df;border-radius:16px;overflow:hidden;background:#fff">
      <div style="padding:18px 22px;background:#fff;border-bottom:3px solid #d69924">${logo}</div>
      <div style="padding:24px 22px;line-height:1.6">
        <h1 style="color:#01411c;font-size:19px;line-height:1.3;margin:0 0 12px">${escapeHtml(title)}</h1>
        <p style="margin:0;color:#334155;white-space:normal">${escapeHtml(body).replace(/\n/g, "<br>")}</p>
        ${destination ? `<p style="margin:20px 0 0"><a href="${destination}" style="display:inline-block;background:#117e48;color:#fff;text-decoration:none;padding:11px 18px;border-radius:9px;font-weight:700">View on MarketLink</a></p>` : ""}
      </div>
      <div style="padding:12px 22px;color:#64748b;font-size:12px;border-top:1px solid #edf2ee">You received this because you have a ${APP_NAME} account.</div>
    </div>
  </div>`;
}

export async function sendEmail(to: string, subject: string, text: string, link?: string): Promise<"sent" | "logged" | "failed"> {
  if (!emailConfigured()) {
    console.log(`[outbox:email] to=${to} subject="${subject}" | ${text.replace(/\n/g, " ")}`);
    return "logged";
  }
  try {
    const logo = await loadEmailLogo();
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || `${APP_NAME} <onboarding@resend.dev>`,
        to: [to],
        subject,
        text,
        html: emailHtml(subject, text, link, !!logo),
        ...(logo ? { attachments: [{ content: logo, filename: "marketlink-email.png", content_id: LOGO_CID }] } : {}),
      }),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return "sent";
  } catch (error) {
    console.error("[notify] email failed", error);
    return "failed";
  }
}

/** Normalise Pakistani numbers (03xx…) to E.164 (+923xx…). */
export function toE164(phone: string) {
  const d = phone.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return d;
  if (d.startsWith("92")) return `+${d}`;
  if (d.startsWith("0")) return `+92${d.slice(1)}`;
  return `+92${d}`;
}

export async function sendSms(phone: string, text: string): Promise<"sent" | "logged" | "failed"> {
  if (!smsConfigured()) {
    console.log(`[outbox:sms] to=${toE164(phone)} | ${text}`);
    return "logged";
  }
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: "Basic " + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: toE164(phone), From: process.env.TWILIO_FROM!, Body: text.slice(0, 480) }),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return "sent";
  } catch (error) {
    console.error("[notify] sms failed", error);
    return "failed";
  }
}

export type NotifyInput = { type: string; title: string; body: string; link?: string; email?: boolean; sms?: boolean };

/** Notification failure never rolls back bidding, order or review transactions. */
export async function notify(userId: number, n: NotifyInput) {
  try {
    const [user] = await db.select({ email: users.email, phone: users.phone }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return;
    const channels = ["in_app"];
    if (n.email) channels.push(`email:${await sendEmail(user.email, n.title, n.body, n.link)}`);
    if (n.sms && user.phone) channels.push(`sms:${await sendSms(user.phone, `${APP_NAME}: ${n.title}. ${n.body}`)}`);
    await db.insert(notifications).values({ userId, type: n.type, title: n.title, body: n.body, link: n.link, channels: channels.join(",") });
  } catch (error) {
    console.error("[notify] failed", error);
  }
}

export function notifyMany(list: [number, NotifyInput][]) {
  return Promise.all(list.map(([id, n]) => notify(id, n)));
}
