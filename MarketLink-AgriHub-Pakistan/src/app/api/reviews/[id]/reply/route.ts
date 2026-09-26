import { ApiError, handle, readJson, str } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { respondToReview } from "@/lib/services/reviews";

type Context = { params: Promise<{ id: string }> };

/** POST /api/reviews/:id/reply { reply } — farmer responds once to a verified buyer review. */
export async function POST(request: Request, { params }: Context) {
  return handle(async () => {
    const farmer = await requireUser(["farmer"]);
    const reviewId = Number((await params).id);
    if (!Number.isSafeInteger(reviewId) || reviewId < 1) throw new ApiError(422, "Invalid review ID");
    const body = await readJson(request);
    return respondToReview(farmer, reviewId, str(body, "reply", { required: true, max: 600 })!);
  }, 201);
}
