import { and, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { users, cropsInventory, qualityInspections } from "@/db/schema";
import { ApiError } from "@/lib/api";
import type { SessionUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

export async function listUsers(role?: "farmer" | "buyer" | "admin" | "inspector") {
  return db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
      role: users.role,
      cnicId: users.cnicId,
      businessName: users.businessName,
      city: users.city,
      address: users.address,
      isVerified: users.isVerified,
      walletBalance: users.walletBalance,
      createdAt: users.createdAt,
      trustScore: users.trustScore,
      ratingAvg: users.ratingAvg,
      ratingCount: users.ratingCount,
      emailVerified: users.emailVerified,
      listings: sql<number>`(select count(*) from crops_inventory c where c.farmer_id = ${users.id})`.mapWith(Number),
      orders: sql<number>`(select count(*) from orders_logistics o where o.farmer_id = ${users.id} or o.buyer_id = ${users.id})`.mapWith(Number),
    })
    .from(users)
    .where(role ? eq(users.role, role) : undefined)
    .orderBy(users.isVerified, desc(users.createdAt));
}

/** Verifying a farmer activates their listings that were held for verification. */
export async function setVerified(userId: number, verified: boolean) {
  return db.transaction(async (tx) => {
    const [u] = await tx.update(users).set({ isVerified: verified }).where(eq(users.id, userId)).returning({ id: users.id, role: users.role, isVerified: users.isVerified, fullName: users.fullName });
    if (!u) throw new ApiError(404, "User not found");
    let activated = 0;
    if (u.role === "farmer" && verified) {
      const res = await tx
        .update(cropsInventory)
        .set({ status: "active" })
        .where(and(eq(cropsInventory.farmerId, userId), eq(cropsInventory.status, "pending_inspection")))
        .returning({ id: cropsInventory.cropId });
      activated = res.length;
    }
    return { ...u, listingsActivated: activated };
  });
}

export async function listInspections() {
  const inspector = alias(users, "inspector");
  const farmer = alias(users, "farmer");
  const rows = await db
    .select({
      inspection: qualityInspections,
      cropName: cropsInventory.cropName,
      farmLocation: cropsInventory.farmLocation,
      farmerName: farmer.fullName,
      inspectorName: inspector.fullName,
    })
    .from(qualityInspections)
    .innerJoin(cropsInventory, eq(cropsInventory.cropId, qualityInspections.cropId))
    .innerJoin(farmer, eq(farmer.id, cropsInventory.farmerId))
    .innerJoin(inspector, eq(inspector.id, qualityInspections.inspectorId))
    .orderBy(desc(qualityInspections.inspectionId))
    .limit(100);
  return rows.map(({ inspection, ...rest }) => ({ ...inspection, reportAttachment: inspection.reportAttachment ? "attached" : null, ...rest }));
}

export type InspectionInput = {
  cropId: number;
  gradeAssigned: "A" | "B" | "C";
  moistureLevelPercentage: number;
  soilPh?: number;
  inspectionNotes?: string;
  reportAttachment?: string;
  reportFileName?: string;
  status: "pending" | "passed" | "failed";
};

/**
 * Recording an inspection:
 *  passed  -> listing grade updated to assigned grade & listing activated
 *  failed  -> listing archived and open bids rejected
 *  pending -> listing held in pending_inspection
 */
export async function createInspection(inspector: SessionUser, input: InspectionInput) {
  if (input.reportAttachment && input.reportAttachment.length > 2_000_000) throw new ApiError(422, "Report attachment too large (max ~1.5MB)");
  return db.transaction(async (tx) => {
    const [crop] = await tx.select().from(cropsInventory).where(eq(cropsInventory.cropId, input.cropId)).for("update");
    if (!crop) throw new ApiError(404, "Crop not found");
    const [row] = await tx
      .insert(qualityInspections)
      .values({ ...input, inspectorId: inspector.id, certificateNo: input.status === "passed" ? `QC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}` : null, verifiedAt: input.status === "pending" ? null : new Date() })
      .returning();
    if (input.status === "passed") {
      await tx
        .update(cropsInventory)
        .set({ qualityGrade: input.gradeAssigned, status: crop.status === "sold_out" ? "sold_out" : crop.status === "archived" ? "archived" : "active" })
        .where(eq(cropsInventory.cropId, crop.cropId));
    } else if (input.status === "failed") {
      await tx.update(cropsInventory).set({ status: "archived" }).where(eq(cropsInventory.cropId, crop.cropId));
      await tx.execute(sql`update bids_negotiations set status = 'rejected', counter_note = 'Listing failed quality inspection', updated_at = now() where crop_id = ${crop.cropId} and status in ('pending','countered')`);
    } else if (crop.status === "active") {
      await tx.update(cropsInventory).set({ status: "pending_inspection" }).where(eq(cropsInventory.cropId, crop.cropId));
    }
    return row;
  });
}

export async function getInspectionReport(id: number) {
  const [r] = await db.select({ a: qualityInspections.reportAttachment }).from(qualityInspections).where(eq(qualityInspections.inspectionId, id));
  if (!r?.a) throw new ApiError(404, "No report attached");
  return r.a;
}

export type NewUserInput = {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  role: "farmer" | "buyer" | "admin" | "inspector";
  city: string;
  cnicId?: string;
  businessName?: string;
};

/** Admin creates any account (e.g. extra admins / quality inspectors). */
export async function createUserByAdmin(input: NewUserInput) {
  if (input.password.length < 8) throw new ApiError(422, "Password must be at least 8 characters");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email)) throw new ApiError(422, "Invalid email address");
  if (input.cnicId && !/^\d{5}-\d{7}-\d$/.test(input.cnicId)) throw new ApiError(422, "CNIC must be in format 12345-1234567-1");
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
  if (exists) throw new ApiError(409, "An account with this email already exists");
  const [u] = await db
    .insert(users)
    .values({
      fullName: input.fullName,
      email: input.email,
      passwordHash: hashPassword(input.password),
      phone: input.phone,
      role: input.role,
      city: input.city,
      cnicId: input.cnicId,
      businessName: input.businessName,
      isVerified: true,
      emailVerified: true,
      walletBalance: input.role === "buyer" ? 1000000 : 0,
    })
    .returning({ id: users.id, fullName: users.fullName, email: users.email, role: users.role });
  return u;
}

export async function resetUserPassword(userId: number, newPassword: string) {
  if (newPassword.length < 8) throw new ApiError(422, "Password must be at least 8 characters");
  const [u] = await db.update(users).set({ passwordHash: hashPassword(newPassword) }).where(eq(users.id, userId)).returning({ id: users.id, email: users.email });
  if (!u) throw new ApiError(404, "User not found");
  return { ...u, passwordReset: true };
}

export async function changeRole(actor: SessionUser, userId: number, role: "farmer" | "buyer" | "admin" | "inspector") {
  if (actor.id === userId && role !== "admin") throw new ApiError(409, "You cannot remove your own admin access");
  const [u] = await db.update(users).set({ role }).where(eq(users.id, userId)).returning({ id: users.id, role: users.role });
  if (!u) throw new ApiError(404, "User not found");
  return u;
}
