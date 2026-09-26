"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, Spinner } from "@/components/ui";
import { useToast } from "@/components/providers";

type Item = { orderId: number; trackingNumber: string; cropName: string; farmer: string };

/** Post-delivery feedback loop: buyers rate sellers 1-5 and leave a review (updates the seller's trust score). */
export function ReviewPrompts({ items }: { items: Item[] }) {
  const { push } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(items[0]?.orderId ?? null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number[]>([]);
  const list = items.filter((i) => !done.includes(i.orderId));
  if (!list.length) return null;

  async function submit(orderId: number) {
    if (!rating) return push({ kind: "error", title: "Choose a star rating" });
    setBusy(true);
    try {
      const r = await api<{ trust: { trustScore: number } }>("/api/reviews", { method: "POST", json: { orderId, rating, comment: comment || undefined } });
      push({ kind: "success", title: "Thanks for your review!", body: `Seller trust score is now ${r.trust.trustScore.toFixed(2)}/5.` });
      setDone((d) => [...d, orderId]);
      setRating(0);
      setComment("");
      setOpen(list.find((i) => i.orderId !== orderId)?.orderId ?? null);
      router.refresh();
    } catch (e) {
      push({ kind: "error", title: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gold-400/40 bg-gold-300/10 p-4">
      <p className="text-sm font-bold">⭐ Rate your recent deliveries ({list.length})</p>
      <ul className="mt-3 space-y-2">
        {list.map((i) => (
          <li key={i.orderId} className="rounded-xl bg-white p-3 dark:bg-white/5">
            <button className="flex w-full items-center justify-between text-left text-sm" onClick={() => setOpen(open === i.orderId ? null : i.orderId)}>
              <span><b>{i.farmer}</b> · {i.cropName} <span className="font-mono text-xs text-slate-500">{i.trackingNumber}</span></span>
              <span className="text-xs font-semibold text-brand-700 dark:text-brand-400">{open === i.orderId ? "Close" : "Rate"}</span>
            </button>
            {open === i.orderId && (
              <div className="animate-fade-in mt-3 space-y-3">
                <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onMouseEnter={() => setHover(n)} onClick={() => setRating(n)}
                      className={`text-3xl leading-none transition ${(hover || rating) >= n ? "text-gold-500" : "text-slate-300 dark:text-slate-600"}`}>★</button>
                  ))}
                  <span className="ml-2 text-xs text-slate-500">{["", "Poor", "Fair", "Good", "Very good", "Excellent"][hover || rating]}</span>
                </div>
                <textarea className="input" rows={2} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Quality, weight accuracy, packing, communication…" />
                <button className="btn-primary" disabled={busy} onClick={() => submit(i.orderId)}>{busy && <Spinner />} Submit review</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
