import { completeIntent, verifyStripeSignature } from "@/lib/services/payments";

export const dynamic = "force-dynamic";

/** Stripe webhook (configure endpoint: /api/payments/webhook/stripe, events: checkout.session.*) */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyStripeSignature(raw, req.headers.get("stripe-signature"))) return new Response("Invalid signature", { status: 400 });
  const event = JSON.parse(raw) as { type: string; data: { object: { id: string; client_reference_id?: string; payment_status?: string; metadata?: { reference?: string } } } };
  const s = event.data.object;
  const reference = s.client_reference_id || s.metadata?.reference;
  if (!reference) return Response.json({ received: true });
  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      if (s.payment_status === "paid") await completeIntent(reference, true, s.id, { type: event.type, id: s.id });
    } else if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      await completeIntent(reference, false, s.id, { type: event.type, id: s.id });
    }
  } catch (e) {
    console.error("[stripe webhook]", e);
    return new Response("Error", { status: 500 });
  }
  return Response.json({ received: true });
}
