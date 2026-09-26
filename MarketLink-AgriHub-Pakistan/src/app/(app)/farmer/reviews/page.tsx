import { requirePageUser } from "@/lib/auth";
import { listReviews } from "@/lib/services/reviews";
import { FarmerReviewBoard } from "@/components/reviews/farmer-review-board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Buyer reviews" };

export default async function FarmerReviewsPage() {
  const farmer = await requirePageUser(["farmer"]);
  const reviews = await listReviews(farmer.id, 100);
  return (
    <FarmerReviewBoard
      initialReviews={reviews}
      trustScore={Number(farmer.trustScore)}
      ratingAverage={Number(farmer.ratingAvg)}
      ratingCount={farmer.ratingCount}
    />
  );
}
