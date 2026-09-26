import { handle, num, oneOf, readJson, str } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listPayouts, requestPayout } from "@/lib/services/payments";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => listPayouts(await requireUser(["farmer", "admin"])));
}

/** POST { amount, method, accountTitle, accountNumber }: farmer withdraws wallet balance */
export async function POST(req: Request) {
  return handle(async () => {
    const farmer = await requireUser(["farmer"]);
    const b = await readJson(req);
    return requestPayout(farmer, {
      amount: num(b, "amount", { required: true, min: 1000 })!,
      method: oneOf(b, "method", ["bank", "jazzcash", "easypaisa"] as const, true)!,
      accountTitle: str(b, "accountTitle", { required: true, max: 120 })!,
      accountNumber: str(b, "accountNumber", { required: true, max: 60 })!,
    });
  }, 201);
}
