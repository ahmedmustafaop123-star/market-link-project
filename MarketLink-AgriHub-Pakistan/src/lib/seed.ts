import { sql } from "drizzle-orm";
import { db, ensureDatabaseExists } from "@/db";
import {
  users,
  cropsInventory,
  mandiRates,
  bidsNegotiations,
  ordersLogistics,
  orderEvents,
  qualityInspections,
  walletTransactions,
  disputes,
  reviews,
} from "@/db/schema";
import { CITIES, CROP_CATALOGUE, MANDI_MARKETS, DELIVERY_STAGES, PLATFORM_FEE_RATE, type DeliveryStage, type PaymentStatus } from "@/lib/constants";
import { hashPassword } from "@/lib/password";
import { POSTGRES_DDL } from "@/lib/ddl-postgres";
import { SUPER_ADMIN, backfillData, needsUpgrade, upgradeSchema } from "@/lib/migrate";
import { recomputeAllTrust } from "@/lib/services/reviews";

let seedPromise: Promise<void> | null = null;

export function ensureSeeded() {
  if (!seedPromise) {
    seedPromise = runSeed().catch((e) => {
      seedPromise = null;
      console.error("[seed] failed", e);
    });
  }
  return seedPromise;
}

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Creates all tables/enums/indexes on an empty database (fresh local or cloud Postgres). */
async function ensureSchema() {
  await ensureDatabaseExists();
  const res = await db.execute(sql`select to_regclass('public.users') is not null as ok`);
  if ((res.rows[0] as { ok: boolean }).ok) return;
  console.log("[bootstrap] empty database detected – creating MarketLink schema");
  // Run statements one by one (prepared-statement drivers reject multi-statement strings).
  const statements = POSTGRES_DDL.split(/;\s*(?:\n|$)/).map((s) => s.trim()).filter(Boolean);
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(424241)`);
    const again = await tx.execute(sql`select to_regclass('public.users') is not null as ok`);
    if ((again.rows[0] as { ok: boolean }).ok) return;
    for (const stmt of statements) await tx.execute(sql.raw(stmt));
  });
  console.log("[bootstrap] schema created");
}

async function runSeed() {
  await ensureSchema();
  const [{ count }] = (await db.execute(sql`select count(*)::int as count from users`)).rows as { count: number }[];
  if (count > 0) {
    if (await needsUpgrade()) await upgradeSchema();
    await backfillData();
    const [{ n }] = (await db.execute(sql`select count(*)::int as n from reviews`)).rows as { n: number }[];
    if (Number(n) === 0) {
      await seedReviewsIfEmpty();
      await recomputeAllTrust();
    }
    return;
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(424242)`);
    const again = (await tx.execute(sql`select count(*)::int as count from users`)).rows as { count: number }[];
    if (again[0].count > 0) return;

    const rand = rng(20240611);
    const pw = hashPassword("password123");
    // Self-hosters can set their own admin login in .env before the first start.
    const adminEmail = (process.env.ADMIN_EMAIL || SUPER_ADMIN.email).trim().toLowerCase();
    const adminPw = process.env.ADMIN_PASSWORD ? hashPassword(process.env.ADMIN_PASSWORD) : pw;

    /* ---------------- Users ---------------- */
    const u = await tx
      .insert(users)
      .values([
        { fullName: SUPER_ADMIN.fullName, email: adminEmail, passwordHash: adminPw, phone: "+92 300 1112233", role: "admin" as const, cnicId: "35202-1234567-1", city: "Lahore", address: "MarketLink HQ, Gulberg III, Lahore", isVerified: true, businessName: "MarketLink Platform Management", title: SUPER_ADMIN.title, userCode: SUPER_ADMIN.userCode },
        { fullName: "Dr. Farhan Malik", email: "inspector@marketlink.pk", passwordHash: pw, phone: "+92 300 7788990", role: "inspector" as const, cnicId: "35202-9988776-3", city: "Faisalabad", address: "Ayub Agricultural Research Institute, Faisalabad", isVerified: true, businessName: "MarketLink Quality Lab" },
        { fullName: "Muhammad Aslam", email: "farmer@marketlink.pk", passwordHash: pw, phone: "+92 301 4455667", role: "farmer" as const, cnicId: "36302-7654321-3", city: "Multan", address: "Chak 5 Faiz, Shujabad Road, Multan", isVerified: true, businessName: "Aslam Agri Farms" },
        { fullName: "Ghulam Rasool", email: "rasool@marketlink.pk", passwordHash: pw, phone: "+92 302 9988776", role: "farmer" as const, cnicId: "36502-1122334-5", city: "Sahiwal", address: "Village 88/6-R, Sahiwal", isVerified: true, businessName: "Rasool & Sons Kheti" },
        { fullName: "Rana Tariq", email: "tariq@marketlink.pk", passwordHash: pw, phone: "+92 333 5566778", role: "farmer" as const, cnicId: "33100-5566778-9", city: "Faisalabad", address: "Jaranwala Road, Faisalabad", isVerified: false, businessName: "Rana Organic Fields" },
        { fullName: "Bashir Ahmed Soomro", email: "bashir@marketlink.pk", passwordHash: pw, phone: "+92 345 2233445", role: "farmer" as const, cnicId: "41303-9988776-1", city: "Hyderabad", address: "Tando Jam Road, Hyderabad", isVerified: true, businessName: "Soomro Tomato Growers" },
        { fullName: "Nasreen Bibi", email: "nasreen@marketlink.pk", passwordHash: pw, phone: "+92 312 6677889", role: "farmer" as const, cnicId: "35401-3344556-2", city: "Okara", address: "Renala Khurd, Okara", isVerified: false, businessName: "Nasreen Potato Farm" },
        { fullName: "Abdul Wahid Baloch", email: "wahid@marketlink.pk", passwordHash: pw, phone: "+92 333 8123456", role: "farmer" as const, cnicId: "52101-4455667-7", city: "Turbat", address: "Date Palm Orchards, Kech Valley, Turbat", isVerified: true, businessName: "Kech Valley Dates" },
        { fullName: "Imran Qureshi", email: "buyer@marketlink.pk", passwordHash: pw, phone: "+92 321 1234567", role: "buyer" as const, cnicId: "35202-8877665-5", city: "Lahore", address: "Badami Bagh Grain Market, Lahore", isVerified: true, businessName: "Qureshi Wholesale Traders", walletBalance: 4500000 },
        { fullName: "Sana Mirza", email: "metro@marketlink.pk", passwordHash: pw, phone: "+92 322 7654321", role: "buyer" as const, cnicId: "42101-1234321-8", city: "Karachi", address: "Korangi Industrial Area, Karachi", isVerified: true, businessName: "FreshMart Supermarket Supply", walletBalance: 3200000 },
        { fullName: "Faisal Sheikh", email: "exports@marketlink.pk", passwordHash: pw, phone: "+92 300 8765432", role: "buyer" as const, cnicId: "42201-5678765-3", city: "Karachi", address: "Port Qasim, Karachi", isVerified: true, businessName: "Indus Agro Exports", walletBalance: 8000000 },
        { fullName: "Hamza Butt", email: "processor@marketlink.pk", passwordHash: pw, phone: "+92 311 2345678", role: "buyer" as const, cnicId: "33100-8765678-1", city: "Faisalabad", address: "Sargodha Road Industrial Estate, Faisalabad", isVerified: true, businessName: "Punjab Food Processors Ltd", walletBalance: 2500000 },
      ])
      .returning({ id: users.id, email: users.email, city: users.city });
    const id = (email: string) => u.find((x) => x.email === email)!.id;
    const admin = id(adminEmail);
    const inspector = id("inspector@marketlink.pk");
    await tx.execute(sql`update users set email_verified = true`);
    const aslam = id("farmer@marketlink.pk");
    const rasool = id("rasool@marketlink.pk");
    const tariq = id("tariq@marketlink.pk");
    const bashir = id("bashir@marketlink.pk");
    const nasreen = id("nasreen@marketlink.pk");
    const wahid = id("wahid@marketlink.pk");
    const imran = id("buyer@marketlink.pk");
    const metro = id("metro@marketlink.pk");
    const exportsB = id("exports@marketlink.pk");
    const processor = id("processor@marketlink.pk");

    /* ---------------- Mandi rates (14 days x 10 crops x 6 markets) ---------------- */
    const marketBias: Record<string, number> = { Lahore: 1.04, Multan: 0.96, Faisalabad: 0.98, Karachi: 1.08, Hyderabad: 0.97, Islamabad: 1.1, Peshawar: 1.05, Quetta: 1.07, Sukkur: 0.95, Gujranwala: 1.0 };
    const rateRows: (typeof mandiRates.$inferInsert)[] = [];
    for (const crop of CROP_CATALOGUE) {
      for (const m of MANDI_MARKETS) {
        let price = crop.mandiBase * marketBias[m];
        for (let d = 13; d >= 0; d--) {
          price = price * (1 + (rand() - 0.48) * 0.05);
          const spread = price * (0.06 + rand() * 0.06);
          rateRows.push({
            cropName: crop.name,
            marketLocation: m,
            minPricePerKg: round2(price - spread),
            maxPricePerKg: round2(price + spread),
            avgPricePerKg: round2(price),
            source: d === 0 ? "feed" : "manual",
            dateUpdated: iso(daysAgo(d)),
          });
        }
      }
    }
    await tx.insert(mandiRates).values(rateRows);

    /* ---------------- Crops ---------------- */
    const img = (name: string) => [CROP_CATALOGUE.find((c) => c.name === name)!.image];
    const geo = (city: string) => ({ farmLocation: city, latitude: CITIES[city].lat, longitude: CITIES[city].lng });
    const crops = await tx
      .insert(cropsInventory)
      .values([
        { farmerId: aslam, cropName: "Wheat", category: "grains" as const, qualityGrade: "A" as const, totalQuantityKg: 24000, basePricePerKg: 96, harvestDate: iso(daysAgo(20)), imagesJson: img("Wheat"), description: "Galaxy-2013 variety, sun-dried, cleaned & bagged in 50kg PP bags.", ...geo("Multan") },
        { farmerId: aslam, cropName: "Mango (Chaunsa)", category: "fruits" as const, qualityGrade: "A" as const, totalQuantityKg: 8000, basePricePerKg: 185, harvestDate: iso(daysAgo(3)), imagesJson: img("Mango (Chaunsa)"), description: "Sindhri & Chaunsa mix, export-grade, packed in 10kg cartons.", ...geo("Multan") },
        { farmerId: aslam, cropName: "Cotton (Phutti)", category: "cash_crops" as const, qualityGrade: "B" as const, totalQuantityKg: 15000, basePricePerKg: 205, harvestDate: iso(daysAgo(30)), imagesJson: img("Cotton (Phutti)"), description: "Phutti (seed cotton), trash below 5%.", ...geo("Multan") },
        { farmerId: rasool, cropName: "Basmati Rice", category: "grains" as const, qualityGrade: "A" as const, totalQuantityKg: 18000, basePricePerKg: 295, harvestDate: iso(daysAgo(40)), imagesJson: img("Basmati Rice"), description: "Super Kernel Basmati, 1121 grade, aged 6 months.", ...geo("Sahiwal") },
        { farmerId: rasool, cropName: "Maize", category: "grains" as const, qualityGrade: "B" as const, totalQuantityKg: 30000, basePricePerKg: 68, harvestDate: iso(daysAgo(15)), imagesJson: img("Maize"), description: "Yellow hybrid maize for feed mills, moisture ~14%.", ...geo("Sahiwal") },
        { farmerId: rasool, cropName: "Potato", category: "vegetables" as const, qualityGrade: "A" as const, totalQuantityKg: 20000, basePricePerKg: 52, harvestDate: iso(daysAgo(8)), imagesJson: img("Potato"), description: "Cardinal red potatoes, cold-store ready.", ...geo("Sahiwal") },
        { farmerId: tariq, cropName: "Sugarcane", category: "cash_crops" as const, qualityGrade: "B" as const, totalQuantityKg: 120000, basePricePerKg: 11, harvestDate: iso(daysAgo(5)), imagesJson: img("Sugarcane"), description: "CPF-249 variety, high sucrose content.", status: "pending_inspection" as const, ...geo("Faisalabad") },
        { farmerId: tariq, cropName: "Wheat", category: "grains" as const, qualityGrade: "C" as const, totalQuantityKg: 10000, basePricePerKg: 88, harvestDate: iso(daysAgo(25)), imagesJson: img("Wheat"), description: "Mixed variety, suitable for flour mills.", ...geo("Faisalabad") },
        { farmerId: bashir, cropName: "Tomato", category: "vegetables" as const, qualityGrade: "A" as const, totalQuantityKg: 6000, basePricePerKg: 115, harvestDate: iso(daysAgo(2)), imagesJson: img("Tomato"), description: "Fresh Sindh tomatoes, crated (25kg).", ...geo("Hyderabad") },
        { farmerId: bashir, cropName: "Onion", category: "vegetables" as const, qualityGrade: "B" as const, totalQuantityKg: 14000, basePricePerKg: 105, harvestDate: iso(daysAgo(10)), imagesJson: img("Onion"), description: "Red onion, Phulkara variety, netted 40kg bags.", ...geo("Hyderabad") },
        { farmerId: bashir, cropName: "Mango (Chaunsa)", category: "fruits" as const, qualityGrade: "B" as const, totalQuantityKg: 5000, basePricePerKg: 160, harvestDate: iso(daysAgo(4)), imagesJson: img("Mango (Chaunsa)"), description: "Sindhri mango from Mirpur Khas orchards.", ...geo("Hyderabad") },
        { farmerId: nasreen, cropName: "Potato", category: "vegetables" as const, qualityGrade: "B" as const, totalQuantityKg: 25000, basePricePerKg: 48, harvestDate: iso(daysAgo(12)), imagesJson: img("Potato"), description: "Diamant white potatoes for chips processing.", ...geo("Okara") },
        { farmerId: wahid, cropName: "Dates (Khajoor)", category: "fruits" as const, qualityGrade: "A" as const, totalQuantityKg: 12000, basePricePerKg: 255, harvestDate: iso(daysAgo(9)), imagesJson: img("Dates (Khajoor)"), description: "Begum Jangi & Muzawati dates, sun-cured, 5kg boxes.", ...geo("Turbat") },
        { farmerId: bashir, cropName: "Red Chilli (Kunri)", category: "cash_crops" as const, qualityGrade: "A" as const, totalQuantityKg: 4000, basePricePerKg: 470, harvestDate: iso(daysAgo(14)), imagesJson: img("Red Chilli (Kunri)"), description: "Kunri long red chilli, sun-dried, stemless.", ...geo("Umerkot") },
        { farmerId: tariq, cropName: "Chickpea (Chana)", category: "grains" as const, qualityGrade: "B" as const, totalQuantityKg: 9000, basePricePerKg: 235, harvestDate: iso(daysAgo(18)), imagesJson: img("Chickpea (Chana)"), description: "Thal desi chana, cleaned, 100kg bags.", ...geo("Jhang") },
        { farmerId: nasreen, cropName: "Kinnow", category: "fruits" as const, qualityGrade: "A" as const, totalQuantityKg: 9000, basePricePerKg: 92, harvestDate: iso(daysAgo(6)), imagesJson: img("Kinnow"), description: "Waxed and graded kinnow, export count 88-100.", ...geo("Okara") },
      ])
      .returning();
    const crop = (farmerId: number, name: string) => crops.find((c) => c.farmerId === farmerId && c.cropName === name)!;

    /* ---------------- Inspections ---------------- */
    await tx.insert(qualityInspections).values([
      { cropId: crop(aslam, "Wheat").cropId, inspectorId: inspector, gradeAssigned: "A" as const, moistureLevelPercentage: 11.5, soilPh: 7.4, inspectionNotes: "Uniform grain size, no pest damage, low foreign matter (0.8%).", status: "passed" as const, verifiedAt: daysAgo(18) },
      { cropId: crop(rasool, "Basmati Rice").cropId, inspectorId: inspector, gradeAssigned: "A" as const, moistureLevelPercentage: 12.1, soilPh: 7.1, inspectionNotes: "Average grain length 8.3mm, broken < 2%.", status: "passed" as const, verifiedAt: daysAgo(35) },
      { cropId: crop(tariq, "Sugarcane").cropId, inspectorId: inspector, gradeAssigned: "B" as const, moistureLevelPercentage: 70, soilPh: 7.9, inspectionNotes: "Awaiting brix-level lab result.", status: "pending" as const, verifiedAt: null },
      { cropId: crop(bashir, "Tomato").cropId, inspectorId: inspector, gradeAssigned: "A" as const, moistureLevelPercentage: 93.5, soilPh: 6.8, inspectionNotes: "Firm, uniform colour, shelf life est. 7 days.", status: "passed" as const, verifiedAt: daysAgo(1) },
    ]);

    /* ---------------- Live bids ---------------- */
    await tx.insert(bidsNegotiations).values([
      { cropId: crop(aslam, "Wheat").cropId, buyerId: imran, bidPricePerKg: 92, bidQuantityKg: 10000, targetDeliveryDate: iso(daysAgo(-7)), message: "Need for flour mill. Can pick up from farm.", status: "pending" as const },
      { cropId: crop(aslam, "Wheat").cropId, buyerId: processor, bidPricePerKg: 94, bidQuantityKg: 8000, targetDeliveryDate: iso(daysAgo(-10)), message: "Regular monthly requirement.", status: "pending" as const },
      { cropId: crop(aslam, "Mango (Chaunsa)").cropId, buyerId: exportsB, bidPricePerKg: 175, bidQuantityKg: 5000, targetDeliveryDate: iso(daysAgo(-5)), message: "For Dubai shipment, need hot-water treatment.", status: "countered" as const, counterPrice: 182, counterNote: "Best I can do is 182 with cartons included." },
      { cropId: crop(aslam, "Cotton (Phutti)").cropId, buyerId: processor, bidPricePerKg: 198, bidQuantityKg: 6000, targetDeliveryDate: iso(daysAgo(-14)), status: "pending" as const },
      { cropId: crop(bashir, "Tomato").cropId, buyerId: metro, bidPricePerKg: 110, bidQuantityKg: 2000, targetDeliveryDate: iso(daysAgo(-2)), message: "Daily supermarket supply.", status: "pending" as const },
      { cropId: crop(rasool, "Potato").cropId, buyerId: imran, bidPricePerKg: 45, bidQuantityKg: 5000, targetDeliveryDate: iso(daysAgo(-6)), status: "rejected" as const },
      { cropId: crop(nasreen, "Kinnow").cropId, buyerId: exportsB, bidPricePerKg: 88, bidQuantityKg: 4000, targetDeliveryDate: iso(daysAgo(-9)), status: "countered" as const, counterPrice: 91, counterNote: "Waxing cost included." },
    ]);

    /* ---------------- Orders (current pipeline + 6-month history) ---------------- */
    type OrderSeed = { farmer: number; buyer: number; cropName: string; qty: number; price: number; stage: DeliveryStage; payment: PaymentStatus; ago: number; transit?: string };
    const orderSeeds: OrderSeed[] = [
      { farmer: aslam, buyer: imran, cropName: "Wheat", qty: 5000, price: 95, stage: "in_transit", payment: "escrow_locked", ago: 4, transit: "Khanewal Bypass, N-5" },
      { farmer: rasool, buyer: exportsB, cropName: "Basmati Rice", qty: 6000, price: 292, stage: "dispatched", payment: "escrow_locked", ago: 3, transit: "Sahiwal Dry Port" },
      { farmer: bashir, buyer: metro, cropName: "Tomato", qty: 1500, price: 112, stage: "quality_checked", payment: "escrow_locked", ago: 2 },
      { farmer: aslam, buyer: processor, cropName: "Cotton (Phutti)", qty: 3000, price: 202, stage: "confirmed", payment: "awaiting_escrow", ago: 1 },
      { farmer: rasool, buyer: imran, cropName: "Maize", qty: 8000, price: 67, stage: "delivered", payment: "disputed", ago: 9, transit: "Badami Bagh, Lahore" },
      { farmer: nasreen, buyer: processor, cropName: "Potato", qty: 7000, price: 47, stage: "confirmed", payment: "escrow_locked", ago: 1 },
    ];
    // History: delivered + released orders spread over past 6 months
    const histCrops: [number, string, number[]][] = [
      [aslam, "Wheat", [imran, processor]],
      [aslam, "Mango (Chaunsa)", [exportsB, metro]],
      [rasool, "Basmati Rice", [exportsB, imran]],
      [bashir, "Onion", [metro, imran]],
      [nasreen, "Kinnow", [exportsB]],
      [wahid, "Dates (Khajoor)", [exportsB, metro]],
      [rasool, "Potato", [processor, metro]],
    ];
    for (let m = 5; m >= 0; m--) {
      const n = 3 + Math.floor(rand() * 3);
      for (let k = 0; k < n; k++) {
        const [farmer, cropName, buyers] = histCrops[Math.floor(rand() * histCrops.length)];
        const c = crop(farmer, cropName);
        orderSeeds.push({
          farmer,
          buyer: buyers[Math.floor(rand() * buyers.length)],
          cropName,
          qty: Math.round((1000 + rand() * 5000) / 100) * 100,
          price: round2(c.basePricePerKg * (1.03 + rand() * 0.07)),
          stage: "delivered",
          payment: "released",
          ago: m * 30 + 12 + Math.floor(rand() * 15),
          transit: c.farmLocation,
        });
      }
    }

    let seq = 1000;
    for (const o of orderSeeds) {
      const c = crop(o.farmer, o.cropName);
      const createdAt = daysAgo(o.ago);
      const [bid] = await tx
        .insert(bidsNegotiations)
        .values({ cropId: c.cropId, buyerId: o.buyer, bidPricePerKg: o.price, bidQuantityKg: o.qty, targetDeliveryDate: iso(daysAgo(o.ago - 7)), status: "accepted", createdAt, updatedAt: createdAt })
        .returning();
      const total = round2(o.qty * o.price);
      const [order] = await tx
        .insert(ordersLogistics)
        .values({
          bidId: bid.bidId,
          cropId: c.cropId,
          farmerId: o.farmer,
          buyerId: o.buyer,
          quantityKg: o.qty,
          pricePerKg: o.price,
          totalAmount: total,
          paymentStatus: o.payment,
          deliveryStage: o.stage,
          transitLocation: o.transit ?? c.farmLocation,
          trackingNumber: `ML-${createdAt.getFullYear()}-${++seq}`,
          expectedDeliveryDate: iso(daysAgo(o.ago - 7)),
          createdAt,
          updatedAt: createdAt,
        })
        .returning();
      const upTo = DELIVERY_STAGES.findIndex((s) => s.key === o.stage);
      const events = DELIVERY_STAGES.slice(0, upTo + 1).map((s, i) => ({
        orderId: order.orderId,
        stage: s.key,
        location: i === 0 ? c.farmLocation : i === upTo ? (o.transit ?? c.farmLocation) : c.farmLocation,
        note: s.label,
        createdAt: new Date(createdAt.getTime() + i * 18 * 3600 * 1000),
      }));
      await tx.insert(orderEvents).values(events);
      if (o.payment !== "awaiting_escrow") {
        await tx.insert(walletTransactions).values({ userId: o.buyer, orderId: order.orderId, type: "escrow_lock", amount: total, description: `Escrow locked for ${order.trackingNumber}`, createdAt });
      }
      if (o.payment === "released") {
        const fee = round2(total * PLATFORM_FEE_RATE);
        const at = new Date(createdAt.getTime() + 5 * 86400000);
        await tx.insert(walletTransactions).values([
          { userId: o.buyer, orderId: order.orderId, type: "escrow_release", amount: total, description: `Escrow released for ${order.trackingNumber}`, createdAt: at },
          { userId: o.farmer, orderId: order.orderId, type: "payout", amount: round2(total - fee), description: `Payout for ${order.trackingNumber}`, createdAt: at },
          { userId: o.farmer, orderId: order.orderId, type: "platform_fee", amount: fee, description: `1.5% MarketLink platform fee`, createdAt: at },
        ]);
      }
      if (o.payment === "disputed") {
        await tx.insert(disputes).values({ orderId: order.orderId, raisedBy: o.buyer, reason: "Received maize with moisture above agreed 14% (measured 17%). Requesting partial refund.", status: "open" });
      }
    }

    // One resolved dispute for the log
    const [firstHist] = (await tx.execute(sql`select order_id from orders_logistics where payment_status = 'released' order by order_id limit 1`)).rows as { order_id: number }[];
    if (firstHist) {
      await tx.insert(disputes).values({ orderId: firstHist.order_id, raisedBy: metro, reason: "Short delivery of 120kg reported at warehouse.", status: "resolved_release", resolution: "Weighbridge slip verified full quantity. Escrow released to farmer.", resolvedAt: daysAgo(40), createdAt: daysAgo(43) });
    }

    // Deposits for buyers + reconcile balances with ledger
    for (const b of [imran, metro, exportsB, processor]) {
      await tx.insert(walletTransactions).values({ userId: b, type: "deposit", amount: 10000000, description: "Opening IBFT transfer from HBL / Meezan Bank (simulated)", createdAt: daysAgo(200) });
    }
    await tx.execute(sql`
      update users set escrow_balance = coalesce((
        select sum(total_amount) from orders_logistics o
        where o.buyer_id = users.id and o.payment_status in ('escrow_locked','disputed')
      ), 0) where role = 'buyer'`);
    await tx.execute(sql`
      update users set wallet_balance = coalesce((
        select sum(amount) from wallet_transactions w where w.user_id = users.id and w.type = 'payout'
      ), 0) where role = 'farmer'`);
  });
  await seedReviewsIfEmpty();
  await recomputeAllTrust();
  console.log("[seed] MarketLink demo data seeded");
}

const REVIEW_TEXT: [number, string][] = [
  [5, "Excellent quality, exactly as graded. Truck arrived on time."],
  [5, "Clean produce, correct weight at our weighbridge. Will order again."],
  [4, "Good quality, a day late but communication was clear."],
  [5, "Very professional farmer, packing was export standard."],
  [4, "Moisture slightly above spec but within tolerance. Fair price."],
  [3, "Quality OK, some bags had foreign matter. Resolved quickly."],
  [5, "Best rate compared to our usual arhti. Highly recommended."],
];

/** Adds realistic buyer reviews to ~75% of paid-out orders (demo data). */
export async function seedReviewsIfEmpty() {
  const [{ n }] = (await db.execute(sql`select count(*)::int as n from reviews`)).rows as { n: number }[];
  if (Number(n) > 0) return;
  const rows = (await db.execute(sql`select order_id, buyer_id, farmer_id, updated_at from orders_logistics where payment_status = 'released' order by order_id`)).rows as {
    order_id: number; buyer_id: number; farmer_id: number; updated_at: string;
  }[];
  const values = rows
    .filter((_, i) => i % 4 !== 3)
    .map((r, i) => {
      const [rating, comment] = REVIEW_TEXT[i % REVIEW_TEXT.length];
      return { orderId: Number(r.order_id), buyerId: Number(r.buyer_id), farmerId: Number(r.farmer_id), rating, comment, createdAt: new Date(new Date(r.updated_at).getTime() + 2 * 86400000) };
    });
  if (values.length) await db.insert(reviews).values(values);
}
