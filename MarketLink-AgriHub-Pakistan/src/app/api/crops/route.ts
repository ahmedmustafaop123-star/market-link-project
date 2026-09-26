import { handle, num, oneOf, readJson, str } from "@/lib/api";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { CITY_NAMES } from "@/lib/constants";
import { createCrop, listCrops } from "@/lib/services/crops";

export const dynamic = "force-dynamic";
const CATS = ["grains", "vegetables", "fruits", "cash_crops"] as const;
const GRADES = ["A", "B", "C"] as const;

/** GET /api/crops?category=&grade=&minPrice=&maxPrice=&q=&originCity=&radiusKm=&sort=&mine=1 */
export async function GET(req: Request) {
  return handle(async () => {
    const user = await getCurrentUser(); // public catalogue; "mine" requires a farmer session
    const sp = Object.fromEntries(new URL(req.url).searchParams.entries());
    const mine = sp.mine === "1" && user?.role === "farmer";
    return listCrops({
      category: oneOf(sp, "category", CATS),
      grade: oneOf(sp, "grade", GRADES),
      minPrice: num(sp, "minPrice", { min: 0 }),
      maxPrice: num(sp, "maxPrice", { min: 0 }),
      q: str(sp, "q", { max: 80 }),
      originCity: oneOf(sp, "originCity", CITY_NAMES),
      radiusKm: num(sp, "radiusKm", { min: 1 }),
      sort: oneOf(sp, "sort", ["newest", "price_asc", "price_desc", "distance"] as const),
      farmerId: mine ? user!.id : sp.farmerId ? Number(sp.farmerId) : undefined,
      minQty: num(sp, "minQty", { min: 0 }),
      province: str(sp, "province", { max: 40 }),
      status: mine || user?.role === "admin" || user?.role === "inspector" ? "all" : "active",
    });
  });
}

/** POST /api/crops – farmer creates a produce listing */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser(["farmer"]);
    const b = await readJson(req);
    return createCrop(user, {
      cropName: str(b, "cropName", { required: true, max: 80 })!,
      category: oneOf(b, "category", CATS, true)!,
      qualityGrade: oneOf(b, "qualityGrade", GRADES, true)!,
      totalQuantityKg: num(b, "totalQuantityKg", { required: true, min: 1, max: 10_000_000 })!,
      basePricePerKg: num(b, "basePricePerKg", { required: true, min: 0.5, max: 100_000 })!,
      harvestDate: str(b, "harvestDate", { required: true })!,
      farmLocation: oneOf(b, "farmLocation", CITY_NAMES, true)!,
      description: str(b, "description", { max: 1000 }),
      imagesJson: Array.isArray(b.imagesJson) ? (b.imagesJson as string[]) : [],
    });
  }, 201);
}
