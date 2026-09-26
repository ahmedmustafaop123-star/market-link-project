import { and, desc, eq, gte, ilike, inArray, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { cropsInventory, users, qualityInspections, ordersLogistics } from "@/db/schema";
import { ApiError } from "@/lib/api";
import { CITIES, distanceKm, type Category, type Grade } from "@/lib/constants";
import type { SessionUser } from "@/lib/auth";

export type CropFilters = {
  category?: Category;
  grade?: Grade;
  minPrice?: number;
  maxPrice?: number;
  q?: string;
  originCity?: string;
  radiusKm?: number;
  farmerId?: number;
  minQty?: number;
  province?: string;
  status?: "active" | "all";
  sort?: "newest" | "price_asc" | "price_desc" | "distance";
};

export async function listCrops(f: CropFilters) {
  const where: SQL[] = [];
  if (f.category) where.push(eq(cropsInventory.category, f.category));
  if (f.grade) where.push(eq(cropsInventory.qualityGrade, f.grade));
  if (f.minPrice !== undefined) where.push(gte(cropsInventory.basePricePerKg, f.minPrice));
  if (f.minQty !== undefined) where.push(gte(cropsInventory.totalQuantityKg, f.minQty));
  if (f.province) where.push(inArray(cropsInventory.farmLocation, Object.keys(CITIES).filter((c) => CITIES[c].province === f.province)));
  if (f.maxPrice !== undefined) where.push(lte(cropsInventory.basePricePerKg, f.maxPrice));
  if (f.q) where.push(ilike(cropsInventory.cropName, `%${f.q}%`));
  if (f.farmerId) where.push(eq(cropsInventory.farmerId, f.farmerId));
  if (f.status !== "all") where.push(eq(cropsInventory.status, "active"));
  else where.push(inArray(cropsInventory.status, ["active", "pending_inspection", "sold_out"]));

  const rows = await db
    .select({
      crop: cropsInventory,
      farmerName: users.fullName,
      farmName: users.businessName,
      farmerVerified: users.isVerified,
      trustScore: users.trustScore,
      ratingCount: users.ratingCount,
      openBids: sql<number>`(select count(*) from bids_negotiations b where b.crop_id = ${cropsInventory.cropId} and b.status in ('pending','countered'))`.mapWith(Number),
      highestBid: sql<number | null>`(select max(b.bid_price_per_kg) from bids_negotiations b where b.crop_id = ${cropsInventory.cropId} and b.status in ('pending','countered'))`.mapWith((v) => (v === null ? null : Number(v))),
      inspectionGrade: sql<string | null>`(select qi.grade_assigned from quality_inspections qi where qi.crop_id = ${cropsInventory.cropId} and qi.status = 'passed' order by qi.verified_at desc limit 1)`,
    })
    .from(cropsInventory)
    .innerJoin(users, eq(users.id, cropsInventory.farmerId))
    .where(and(...where))
    .orderBy(desc(cropsInventory.createdAt));

  const origin = f.originCity ? CITIES[f.originCity] : undefined;
  let result = rows.map((r) => {
    const dist =
      origin && r.crop.latitude !== null && r.crop.longitude !== null
        ? Math.round(distanceKm(origin, { lat: r.crop.latitude, lng: r.crop.longitude }))
        : null;
    return { ...r.crop, farmerName: r.farmerName, farmName: r.farmName, farmerVerified: r.farmerVerified, trustScore: r.trustScore, ratingCount: r.ratingCount, openBids: r.openBids, highestBid: r.highestBid, inspectionGrade: r.inspectionGrade, distanceKm: dist };
  });
  if (origin && f.radiusKm) result = result.filter((c) => c.distanceKm === null || c.distanceKm <= f.radiusKm!);
  if (f.sort === "price_asc") result.sort((a, b) => a.basePricePerKg - b.basePricePerKg);
  if (f.sort === "price_desc") result.sort((a, b) => b.basePricePerKg - a.basePricePerKg);
  if (f.sort === "distance") result.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
  return result;
}

export async function getCrop(cropId: number) {
  const [row] = await db
    .select({ crop: cropsInventory, farmerName: users.fullName, farmName: users.businessName, farmerVerified: users.isVerified, phone: users.phone, farmerCity: users.city, trustScore: users.trustScore, ratingAvg: users.ratingAvg, ratingCount: users.ratingCount, memberSince: users.createdAt })
    .from(cropsInventory)
    .innerJoin(users, eq(users.id, cropsInventory.farmerId))
    .where(eq(cropsInventory.cropId, cropId))
    .limit(1);
  if (!row) throw new ApiError(404, "Crop listing not found");
  const inspections = await db
    .select()
    .from(qualityInspections)
    .where(eq(qualityInspections.cropId, cropId))
    .orderBy(desc(qualityInspections.inspectionId));
  return { ...row.crop, farmerName: row.farmerName, farmName: row.farmName, farmerVerified: row.farmerVerified, farmerCity: row.farmerCity, trustScore: row.trustScore, ratingAvg: row.ratingAvg, ratingCount: row.ratingCount, memberSince: row.memberSince, inspections: inspections.map((i) => ({ ...i, reportAttachment: i.reportAttachment ? "attached" : null })) };
}

export type CropInput = {
  cropName: string;
  category: Category;
  qualityGrade: Grade;
  totalQuantityKg: number;
  basePricePerKg: number;
  harvestDate: string;
  farmLocation: string;
  description?: string;
  imagesJson?: string[];
};

function validateImages(images: unknown): string[] {
  if (!images) return [];
  if (!Array.isArray(images)) throw new ApiError(422, "imagesJson must be an array");
  if (images.length > 4) throw new ApiError(422, "Maximum 4 images per listing");
  for (const i of images) {
    if (typeof i !== "string") throw new ApiError(422, "Invalid image");
    if (!(i.startsWith("data:image/") || i.startsWith("https://"))) throw new ApiError(422, "Images must be uploaded files or https URLs");
    if (i.length > 1_500_000) throw new ApiError(422, "Image too large (max ~1MB after compression)");
  }
  return images as string[];
}

export async function createCrop(farmer: SessionUser, input: CropInput) {
  if (new Date(input.harvestDate) > new Date(Date.now() + 86400000)) throw new ApiError(422, "Harvest date cannot be in the future");
  const loc = CITIES[input.farmLocation];
  const [row] = await db
    .insert(cropsInventory)
    .values({
      farmerId: farmer.id,
      cropName: input.cropName,
      category: input.category,
      qualityGrade: input.qualityGrade,
      totalQuantityKg: input.totalQuantityKg,
      basePricePerKg: input.basePricePerKg,
      harvestDate: input.harvestDate,
      farmLocation: input.farmLocation,
      latitude: loc?.lat ?? null,
      longitude: loc?.lng ?? null,
      description: input.description,
      imagesJson: validateImages(input.imagesJson),
      // Business rule: listings from unverified farmers require inspection before going live
      status: farmer.isVerified ? "active" : "pending_inspection",
    })
    .returning();
  return row;
}

export async function updateCrop(user: SessionUser, cropId: number, patch: Partial<CropInput> & { status?: "active" | "archived" }) {
  const [existing] = await db.select().from(cropsInventory).where(eq(cropsInventory.cropId, cropId)).limit(1);
  if (!existing) throw new ApiError(404, "Crop listing not found");
  if (user.role !== "admin" && existing.farmerId !== user.id) throw new ApiError(403, "You can only edit your own listings");
  if (patch.status === "active" && existing.status === "pending_inspection" && user.role !== "admin")
    throw new ApiError(409, "Listing is awaiting quality inspection");
  const loc = patch.farmLocation ? CITIES[patch.farmLocation] : undefined;
  const [row] = await db
    .update(cropsInventory)
    .set({
      ...(patch.cropName && { cropName: patch.cropName }),
      ...(patch.category && { category: patch.category }),
      ...(patch.qualityGrade && { qualityGrade: patch.qualityGrade }),
      ...(patch.totalQuantityKg !== undefined && { totalQuantityKg: patch.totalQuantityKg, ...(existing.status === "sold_out" && patch.totalQuantityKg > 0 ? { status: "active" as const } : {}) }),
      ...(patch.basePricePerKg !== undefined && { basePricePerKg: patch.basePricePerKg }),
      ...(patch.harvestDate && { harvestDate: patch.harvestDate }),
      ...(patch.description !== undefined && { description: patch.description }),
      ...(patch.imagesJson && { imagesJson: validateImages(patch.imagesJson) }),
      ...(patch.farmLocation && { farmLocation: patch.farmLocation, latitude: loc?.lat ?? null, longitude: loc?.lng ?? null }),
      ...(patch.status && { status: patch.status }),
    })
    .where(eq(cropsInventory.cropId, cropId))
    .returning();
  return row;
}

export async function deleteCrop(user: SessionUser, cropId: number) {
  const [existing] = await db.select().from(cropsInventory).where(eq(cropsInventory.cropId, cropId)).limit(1);
  if (!existing) throw new ApiError(404, "Crop listing not found");
  if (user.role !== "admin" && existing.farmerId !== user.id) throw new ApiError(403, "You can only delete your own listings");
  const [{ n }] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(ordersLogistics).where(eq(ordersLogistics.cropId, cropId));
  if (n > 0) {
    // Soft-delete: orders reference this crop
    await db.update(cropsInventory).set({ status: "archived" }).where(eq(cropsInventory.cropId, cropId));
    await db.execute(sql`update bids_negotiations set status = 'rejected', updated_at = now() where crop_id = ${cropId} and status in ('pending','countered')`);
    return { archived: true };
  }
  await db.delete(cropsInventory).where(eq(cropsInventory.cropId, cropId));
  return { deleted: true };
}
