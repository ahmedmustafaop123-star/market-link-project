"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, EmptyState, PageHeader, Spinner, StatCard } from "@/components/ui";
import { useToast } from "@/components/providers";
import { formatDate } from "@/lib/constants";
import type { listReviews } from "@/lib/services/reviews";

type Review = Awaited<ReturnType<typeof listReviews>>[number];

type Props = {
  initialReviews: Review[];
  trustScore: number;
  ratingAverage: number;
  ratingCount: number;
};

export function FarmerReviewBoard({ initialReviews, trustScore, ratingAverage, ratingCount }: Props) {
  const router = useRouter();
  const { push } = useToast();
  const [reviews, setReviews] = useState(initialReviews);
  const [filter, setFilter] = useState<"all" | "waiting" | "answered">("all");
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);

  const unanswered = reviews.filter((review) => !review.farmerReply).length;
  const shown = useMemo(() => reviews.filter((review) => {
    if (filter === "waiting") return !review.farmerReply;
    if (filter === "answered") return !!review.farmerReply;
    return true;
  }), [reviews, filter]);

  async function respond(reviewId: number) {
    const reply = (drafts[reviewId] ?? "").trim();
    if (reply.length < 2 || reply.length > 600) return;
    setSaving(reviewId);
    try {
      const updated = await api<{ farmerReply: string; repliedAt: string }>(`/api/reviews/${reviewId}/reply`, { method: "POST", json: { reply } });
      setReviews((current) => current.map((item) => item.reviewId === reviewId ? { ...item, farmerReply: updated.farmerReply, repliedAt: new Date(updated.repliedAt) } : item));
      setDrafts((current) => ({ ...current, [reviewId]: "" }));
      push({ kind: "success", title: "Reply published", body: "The buyer has been notified." });
      router.refresh();
    } catch (error) {
      push({ kind: "error", title: "Could not publish reply", body: (error as Error).message });
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Buyer reviews" urdu="خریدار کے تجزیے" subtitle="Respond to feedback from completed orders" actions={<Link href="/account" className="btn-secondary">⚙️ Manage profile</Link>} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Trust score" value={ratingCount ? `${trustScore.toFixed(2)} / 5` : "New"} icon="🤝" sub="Verified sales & feedback" />
        <StatCard label="Buyer rating" value={ratingCount ? `${ratingAverage.toFixed(1)} / 5` : "—"} icon="⭐" tone="amber" sub={`${ratingCount} verified ${ratingCount === 1 ? "review" : "reviews"}`} />
        <StatCard label="Awaiting response" value={unanswered} icon="💬" tone="sky" sub="Reply once per review" />
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter reviews">
        {([
          ["all", "All", reviews.length],
          ["waiting", "Needs reply", unanswered],
          ["answered", "Replied", reviews.length - unanswered],
        ] as const).map(([key, label, count]) => (
          <button key={key} type="button" onClick={() => setFilter(key)} aria-pressed={filter === key} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${filter === key ? "bg-brand-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-brand-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700"}`}>
            {label} <span className="opacity-70">({count})</span>
          </button>
        ))}
      </div>

      {!shown.length ? (
        <EmptyState icon="⭐" title={filter === "all" ? "No reviews yet" : "Nothing here"} body={filter === "all" ? "Buyer feedback appears after an order is delivered and paid." : "Try another filter to see more feedback."} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {shown.map((review) => (
            <article key={review.reviewId} className="card flex flex-col gap-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{review.buyerName ?? review.buyerFullName}</p>
                  <p className="text-xs text-slate-500">
                    ✔ Verified purchase · <Link href={`/crop/${review.cropId}`} className="font-medium text-brand-700 hover:underline dark:text-brand-400">{review.cropName}</Link> · {formatDate(review.createdAt)}
                  </p>
                </div>
                <span className="text-gold-500" aria-label={`${review.rating} out of 5 stars`}>
                  {"★".repeat(review.rating)}<span className="text-slate-300 dark:text-slate-700">{"★".repeat(5 - review.rating)}</span>
                </span>
              </div>
              {review.comment && <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">&ldquo;{review.comment}&rdquo;</p>}
              {review.farmerReply ? (
                <div className="rounded-xl border-l-2 border-brand-600 bg-brand-50/60 px-4 py-3 text-sm dark:bg-brand-950/30">
                  <p className="text-xs font-semibold tracking-wide text-brand-800 uppercase dark:text-brand-300">Your response · {formatDate(review.repliedAt)}</p>
                  <p className="mt-1 whitespace-pre-wrap">{review.farmerReply}</p>
                </div>
              ) : (
                <div className="mt-auto space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <label htmlFor={`reply-${review.reviewId}`} className="label">Reply to this buyer</label>
                  <textarea
                    id={`reply-${review.reviewId}`}
                    rows={2}
                    maxLength={600}
                    value={drafts[review.reviewId] ?? ""}
                    onChange={(event) => setDrafts((current) => ({ ...current, [review.reviewId]: event.target.value }))}
                    placeholder="Thank you for your feedback."
                    className="input resize-y"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-500">Visible to buyers · {(drafts[review.reviewId] ?? "").length}/600</p>
                    <button type="button" className="btn-primary" disabled={saving !== null || (drafts[review.reviewId] ?? "").trim().length < 2} onClick={() => respond(review.reviewId)}>
                      {saving === review.reviewId && <Spinner />} Publish reply
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
