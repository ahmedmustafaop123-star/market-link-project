import { ApiError, handle, num, readJson, str } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createReview, listReviews, pendingReviews } from "@/lib/services/reviews";

export const dynamic = "force-dynamic";

/** GET ?farmerId=: public seller reviews · GET ?pending=1: buyer's delivered orders awaiting a review */
export async function GET(req: Request) {
  return handle(async () => {
    const sp = new URL(req.url).searchParams;
    if (sp.get("pending") === "1") return pendingReviews((await requireUser(["buyer"])).id);
    const farmerId = Number(sp.get("farmerId"));
    if (!farmerId) throw new ApiError(422, "farmerId is required");
    return listReviews(farmerId);
  });
}

/** POST { orderId, rating 1-5, comment? }: buyer reviews a delivered order (one per order) */
export async function POST(req: Request) {
  return handle(async () => {
    const buyer = await requireUser(["buyer"]);
    const b = await readJson(req);
    return createReview(buyer, num(b, "orderId", { required: true, min: 1 })!, num(b, "rating", { required: true, min: 1, max: 5 })!, str(b, "comment", { max: 1000 }));
  }, 201);
}
