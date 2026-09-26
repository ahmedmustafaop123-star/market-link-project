import { handle, num, oneOf, readJson, str } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { MANDI_MARKETS } from "@/lib/constants";
import { latestRates, platformComparison, rateTrend, upsertRate } from "@/lib/services/mandi";

export const dynamic = "force-dynamic";

/**
 * GET /api/mandi-rates?view=latest|trend|compare&crop=&market=&days=
 *  latest  – latest rate per crop x market with day-on-day change
 *  trend   – daily avg per market for one crop (chart series)
 *  compare – mandi avg vs platform ask vs platform deal price
 */
export async function GET(req: Request) {
  return handle(async () => {
    const sp = new URL(req.url).searchParams; // public market data
    const view = sp.get("view") ?? "latest";
    if (view === "trend") return rateTrend(sp.get("crop") || "Wheat", Math.min(60, Number(sp.get("days") || 14)));
    if (view === "compare") return platformComparison();
    return latestRates({ crop: sp.get("crop") || undefined, market: sp.get("market") || undefined });
  });
}

/** POST /api/mandi-rates – admin manual daily rate entry (upsert by crop+market+date) */
export async function POST(req: Request) {
  return handle(async () => {
    await requireUser(["admin"]);
    const b = await readJson(req);
    return upsertRate({
      cropName: str(b, "cropName", { required: true, max: 80 })!,
      marketLocation: oneOf(b, "marketLocation", MANDI_MARKETS, true)!,
      minPricePerKg: num(b, "minPricePerKg", { required: true, min: 0.1 })!,
      maxPricePerKg: num(b, "maxPricePerKg", { required: true, min: 0.1 })!,
      avgPricePerKg: num(b, "avgPricePerKg", { min: 0.1 }),
      dateUpdated: str(b, "dateUpdated"),
    });
  }, 201);
}
