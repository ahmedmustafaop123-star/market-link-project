import { handle, num, oneOf, readJson, str } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { CITY_NAMES } from "@/lib/constants";
import { deleteCrop, getCrop, updateCrop } from "@/lib/services/crops";

type Ctx = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    return getCrop(Number((await params).id));
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireUser(["farmer", "admin"]);
    const b = await readJson(req);
    return updateCrop(user, Number((await params).id), {
      cropName: str(b, "cropName", { max: 80 }),
      category: oneOf(b, "category", ["grains", "vegetables", "fruits", "cash_crops"] as const),
      qualityGrade: oneOf(b, "qualityGrade", ["A", "B", "C"] as const),
      totalQuantityKg: num(b, "totalQuantityKg", { min: 0 }),
      basePricePerKg: num(b, "basePricePerKg", { min: 0.5 }),
      harvestDate: str(b, "harvestDate"),
      farmLocation: oneOf(b, "farmLocation", CITY_NAMES),
      description: str(b, "description", { max: 1000 }),
      imagesJson: Array.isArray(b.imagesJson) ? (b.imagesJson as string[]) : undefined,
      status: oneOf(b, "status", ["active", "archived"] as const),
    });
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireUser(["farmer", "admin"]);
    return deleteCrop(user, Number((await params).id));
  });
}
