import { ApiError, handle } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getWallet } from "@/lib/services/orders";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => getWallet(await requireUser(["buyer", "farmer"])));
}

/** Direct top-ups are disabled: funds can only enter through a verified payment gateway callback (/api/payments/*). */
export async function POST() {
  return handle(async () => {
    throw new ApiError(410, "Direct top-ups are disabled. Use POST /api/payments/checkout.");
  });
}
