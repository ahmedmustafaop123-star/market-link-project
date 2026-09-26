import { absoluteUrl } from "@/lib/base-url";
import { completeIntent, easypaisaInquire } from "@/lib/services/payments";

export const dynamic = "force-dynamic";

/**
 * Easypaisa redirects the customer here (GET with orderRefNumber & status, or POST with auth_token on step 1).
 * The result is confirmed server-to-server via the Inquire Transaction API before the wallet is credited.
 */
async function handleCallback(req: Request, params: URLSearchParams) {
  const ref = params.get("orderRefNumber") || params.get("orderRefNum") || "";
  const authToken = params.get("auth_token");
  if (authToken) {
    // Step 1 of the hosted flow: forward the token to Easypaisa's confirm page
    const confirm = process.env.PAYMENTS_MODE === "live" ? "https://easypay.easypaisa.com.pk/easypay/Confirm.jsf" : "https://easypaystg.easypaisa.com.pk/easypay/Confirm.jsf";
    const postBackURL = absoluteUrl(req, "/api/payments/callback/easypaisa");
    return Response.redirect(`${confirm}?auth_token=${encodeURIComponent(authToken)}&postBackURL=${encodeURIComponent(postBackURL)}`, 303);
  }
  if (ref) {
    try {
      const paid = await easypaisaInquire(ref);
      if (paid) await completeIntent(ref, true, ref, { status: params.get("status") });
      else if (params.get("status") && params.get("status") !== "0000") await completeIntent(ref, false, ref, { status: params.get("status"), desc: params.get("desc") });
    } catch (e) {
      console.error("[easypaisa callback]", e);
    }
  }
  return Response.redirect(absoluteUrl(req, `/wallet?payment=${encodeURIComponent(ref)}`), 303);
}

export async function GET(req: Request) {
  return handleCallback(req, new URL(req.url).searchParams);
}
export async function POST(req: Request) {
  const form = await req.formData();
  return handleCallback(req, new URLSearchParams([...form.entries()].map(([k, v]) => [k, String(v)])));
}
