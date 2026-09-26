import { timingSafeEqual } from "crypto";
import { completeIntent, jazzcashHash } from "@/lib/services/payments";

export const dynamic = "force-dynamic";

/** JazzCash posts the transaction result (form-encoded) to pp_ReturnURL. The secure hash is verified before settling. */
export async function POST(req: Request) {
  const form = await req.formData();
  const fields = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  const base = (process.env.APP_URL || new URL(req.url).origin).replace(/\/$/, "");
  const ref = fields.pp_TxnRefNo ?? "";
  const expected = process.env.JAZZCASH_INTEGRITY_SALT ? jazzcashHash(fields) : "";
  const got = (fields.pp_SecureHash ?? "").toUpperCase();
  if (!expected || expected.length !== got.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(got))) {
    return Response.redirect(`${base}/wallet?payment=${encodeURIComponent(ref)}&error=signature`, 303);
  }
  try {
    await completeIntent(ref, fields.pp_ResponseCode === "000", fields.pp_RetreivalReferenceNo || fields.pp_TxnRefNo, { code: fields.pp_ResponseCode, message: fields.pp_ResponseMessage });
  } catch (e) {
    console.error("[jazzcash callback]", e);
  }
  return Response.redirect(`${base}/wallet?payment=${encodeURIComponent(ref)}`, 303);
}
