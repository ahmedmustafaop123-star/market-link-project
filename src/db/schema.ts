import {
  pgTable,
  pgEnum,
  serial,
  integer,
  varchar,
  text,
  numeric,
  boolean,
  date,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  doublePrecision,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */
export const userRoleEnum = pgEnum("user_role", ["farmer", "buyer", "admin", "inspector"]);
export const cropCategoryEnum = pgEnum("crop_category", ["grains", "vegetables", "fruits", "cash_crops"]);
export const qualityGradeEnum = pgEnum("quality_grade", ["A", "B", "C"]);
export const cropStatusEnum = pgEnum("crop_status", ["active", "pending_inspection", "sold_out", "archived"]);
export const bidStatusEnum = pgEnum("bid_status", ["pending", "accepted", "rejected", "countered", "withdrawn"]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "awaiting_escrow",
  "escrow_locked",
  "released",
  "refunded",
  "disputed",
]);
export const deliveryStageEnum = pgEnum("delivery_stage", [
  "confirmed",
  "quality_checked",
  "dispatched",
  "in_transit",
  "delivered",
]);
export const inspectionStatusEnum = pgEnum("inspection_status", ["pending", "passed", "failed"]);
export const walletTxnTypeEnum = pgEnum("wallet_txn_type", [
  "deposit",
  "escrow_lock",
  "escrow_release",
  "payout",
  "refund",
  "platform_fee",
  "withdrawal",
]);
export const disputeStatusEnum = pgEnum("dispute_status", ["open", "investigating", "resolved_release", "resolved_refund"]);

const money = (name: string) => numeric(name, { precision: 14, scale: 2, mode: "number" });
const qty = (name: string) => numeric(name, { precision: 14, scale: 2, mode: "number" });

/* ------------------------------------------------------------------ */
/* 1. users                                                            */
/* ------------------------------------------------------------------ */
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    fullName: varchar("full_name", { length: 120 }).notNull(),
    email: varchar("email", { length: 160 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 30 }).notNull(),
    role: userRoleEnum("role").notNull(),
    cnicId: varchar("cnic_id", { length: 20 }),
    businessName: varchar("business_name", { length: 160 }),
    city: varchar("city", { length: 80 }).notNull(),
    address: text("address"),
    isVerified: boolean("is_verified").notNull().default(false),
    emailVerified: boolean("email_verified").notNull().default(false),
    title: varchar("title", { length: 120 }),
    userCode: varchar("user_code", { length: 40 }),
    avatarUrl: text("avatar_url"),
    googleId: varchar("google_id", { length: 64 }),
    authProvider: varchar("auth_provider", { length: 20 }).notNull().default("password"),
    trustScore: numeric("trust_score", { precision: 3, scale: 2, mode: "number" }).notNull().default(0),
    ratingAvg: numeric("rating_avg", { precision: 3, scale: 2, mode: "number" }).notNull().default(0),
    ratingCount: integer("rating_count").notNull().default(0),
    walletBalance: money("wallet_balance").notNull().default(0),
    escrowBalance: money("escrow_balance").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_email_uq").on(t.email),
    uniqueIndex("users_google_id_uq").on(t.googleId),
    uniqueIndex("users_user_code_uq").on(t.userCode),
    index("users_role_idx").on(t.role),
    index("users_city_idx").on(t.city),
  ],
);

/* ------------------------------------------------------------------ */
/* 2. crops_inventory                                                  */
/* ------------------------------------------------------------------ */
export const cropsInventory = pgTable(
  "crops_inventory",
  {
    cropId: serial("crop_id").primaryKey(),
    farmerId: integer("farmer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cropName: varchar("crop_name", { length: 80 }).notNull(),
    category: cropCategoryEnum("category").notNull(),
    qualityGrade: qualityGradeEnum("quality_grade").notNull(),
    totalQuantityKg: qty("total_quantity_kg").notNull(),
    basePricePerKg: money("base_price_per_kg").notNull(),
    harvestDate: date("harvest_date", { mode: "string" }).notNull(),
    imagesJson: jsonb("images_json").$type<string[]>().notNull().default([]),
    description: text("description"),
    farmLocation: varchar("farm_location", { length: 80 }).notNull(),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    status: cropStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("crops_farmer_idx").on(t.farmerId),
    index("crops_category_idx").on(t.category),
    index("crops_status_idx").on(t.status),
    index("crops_name_idx").on(t.cropName),
  ],
);

/* ------------------------------------------------------------------ */
/* 3. mandi_rates                                                      */
/* ------------------------------------------------------------------ */
export const mandiRates = pgTable(
  "mandi_rates",
  {
    rateId: serial("rate_id").primaryKey(),
    cropName: varchar("crop_name", { length: 80 }).notNull(),
    marketLocation: varchar("market_location", { length: 80 }).notNull(),
    minPricePerKg: money("min_price_per_kg").notNull(),
    maxPricePerKg: money("max_price_per_kg").notNull(),
    avgPricePerKg: money("avg_price_per_kg").notNull(),
    source: varchar("source", { length: 20 }).notNull().default("manual"),
    dateUpdated: date("date_updated", { mode: "string" }).notNull(),
  },
  (t) => [
    uniqueIndex("mandi_crop_market_date_uq").on(t.cropName, t.marketLocation, t.dateUpdated),
    index("mandi_date_idx").on(t.dateUpdated),
  ],
);

/* ------------------------------------------------------------------ */
/* 4. bids_negotiations                                                */
/* ------------------------------------------------------------------ */
export const bidsNegotiations = pgTable(
  "bids_negotiations",
  {
    bidId: serial("bid_id").primaryKey(),
    cropId: integer("crop_id")
      .notNull()
      .references(() => cropsInventory.cropId, { onDelete: "cascade" }),
    buyerId: integer("buyer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bidPricePerKg: money("bid_price_per_kg").notNull(),
    bidQuantityKg: qty("bid_quantity_kg").notNull(),
    targetDeliveryDate: date("target_delivery_date", { mode: "string" }),
    message: text("message"),
    status: bidStatusEnum("status").notNull().default("pending"),
    counterPrice: money("counter_price"),
    counterNote: text("counter_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("bids_crop_idx").on(t.cropId),
    index("bids_buyer_idx").on(t.buyerId),
    index("bids_status_idx").on(t.status),
  ],
);

/* ------------------------------------------------------------------ */
/* 5. orders_logistics                                                 */
/* ------------------------------------------------------------------ */
export const ordersLogistics = pgTable(
  "orders_logistics",
  {
    orderId: serial("order_id").primaryKey(),
    bidId: integer("bid_id")
      .notNull()
      .references(() => bidsNegotiations.bidId, { onDelete: "restrict" }),
    cropId: integer("crop_id")
      .notNull()
      .references(() => cropsInventory.cropId, { onDelete: "restrict" }),
    farmerId: integer("farmer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    buyerId: integer("buyer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    quantityKg: qty("quantity_kg").notNull(),
    pricePerKg: money("price_per_kg").notNull(),
    totalAmount: money("total_amount").notNull(),
    paymentStatus: paymentStatusEnum("payment_status").notNull().default("awaiting_escrow"),
    deliveryStage: deliveryStageEnum("delivery_stage").notNull().default("confirmed"),
    transitLocation: varchar("transit_location", { length: 120 }),
    currentLat: doublePrecision("current_lat"),
    currentLng: doublePrecision("current_lng"),
    trackingNumber: varchar("tracking_number", { length: 40 }).notNull(),
    expectedDeliveryDate: date("expected_delivery_date", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_bid_uq").on(t.bidId),
    uniqueIndex("orders_tracking_uq").on(t.trackingNumber),
    index("orders_farmer_idx").on(t.farmerId),
    index("orders_buyer_idx").on(t.buyerId),
    index("orders_stage_idx").on(t.deliveryStage),
  ],
);

/* Order tracking history (audit trail for the logistics stepper) */
export const orderEvents = pgTable(
  "order_events",
  {
    eventId: serial("event_id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => ordersLogistics.orderId, { onDelete: "cascade" }),
    stage: varchar("stage", { length: 40 }).notNull(),
    location: varchar("location", { length: 120 }),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    note: text("note"),
    actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

/* ------------------------------------------------------------------ */
/* 6. quality_inspections                                              */
/* ------------------------------------------------------------------ */
export const qualityInspections = pgTable(
  "quality_inspections",
  {
    inspectionId: serial("inspection_id").primaryKey(),
    cropId: integer("crop_id")
      .notNull()
      .references(() => cropsInventory.cropId, { onDelete: "cascade" }),
    inspectorId: integer("inspector_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    gradeAssigned: qualityGradeEnum("grade_assigned").notNull(),
    moistureLevelPercentage: numeric("moisture_level_percentage", { precision: 5, scale: 2, mode: "number" }).notNull(),
    soilPh: numeric("soil_ph", { precision: 4, scale: 2, mode: "number" }),
    inspectionNotes: text("inspection_notes"),
    reportAttachment: text("report_attachment"),
    reportFileName: varchar("report_file_name", { length: 200 }),
    certificateNo: varchar("certificate_no", { length: 40 }),
    status: inspectionStatusEnum("status").notNull().default("pending"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
  },
  (t) => [index("inspections_crop_idx").on(t.cropId), index("inspections_status_idx").on(t.status)],
);

/* Escrow wallet ledger */
export const walletTransactions = pgTable(
  "wallet_transactions",
  {
    txnId: serial("txn_id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orderId: integer("order_id").references(() => ordersLogistics.orderId, { onDelete: "set null" }),
    type: walletTxnTypeEnum("type").notNull(),
    amount: money("amount").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("wallet_user_idx").on(t.userId)],
);

/* Dispute resolution log */
export const disputes = pgTable(
  "disputes",
  {
    disputeId: serial("dispute_id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => ordersLogistics.orderId, { onDelete: "cascade" }),
    raisedBy: integer("raised_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    status: disputeStatusEnum("status").notNull().default("open"),
    resolution: text("resolution"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [index("disputes_order_idx").on(t.orderId), index("disputes_status_idx").on(t.status)],
);

/* ------------------------------------------------------------------ */
/* Reviews & seller trust                                              */
/* ------------------------------------------------------------------ */
export const reviews = pgTable(
  "reviews",
  {
    reviewId: serial("review_id").primaryKey(),
    orderId: integer("order_id").notNull().references(() => ordersLogistics.orderId, { onDelete: "cascade" }),
    buyerId: integer("buyer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    farmerId: integer("farmer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    farmerReply: text("farmer_reply"),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("reviews_order_uq").on(t.orderId), index("reviews_farmer_idx").on(t.farmerId)],
);

/* In-app notifications + email/SMS delivery log */
export const notifications = pgTable(
  "notifications",
  {
    notificationId: serial("notification_id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 40 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body"),
    link: varchar("link", { length: 300 }),
    channels: varchar("channels", { length: 60 }).notNull().default("in_app"),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.isRead)],
);

/* One-time codes: email verification & password reset */
export const authTokens = pgTable(
  "auth_tokens",
  {
    tokenId: serial("token_id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    purpose: varchar("purpose", { length: 20 }).notNull(), // verify_email | reset_password
    codeHash: varchar("code_hash", { length: 128 }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("auth_tokens_user_idx").on(t.userId, t.purpose)],
);

/* Payment gateway intents (Stripe / JazzCash / Easypaisa / sandbox) */
export const paymentIntents = pgTable(
  "payment_intents",
  {
    intentId: serial("intent_id").primaryKey(),
    reference: varchar("reference", { length: 60 }).notNull(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 20 }).notNull(),
    amount: money("amount").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | succeeded | failed | expired
    providerRef: varchar("provider_ref", { length: 200 }),
    rawCallback: text("raw_callback"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("payment_intents_ref_uq").on(t.reference), index("payment_intents_user_idx").on(t.userId)],
);

/* Farmer payout (withdrawal) requests */
export const payoutRequests = pgTable(
  "payout_requests",
  {
    payoutId: serial("payout_id").primaryKey(),
    farmerId: integer("farmer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    amount: money("amount").notNull(),
    method: varchar("method", { length: 20 }).notNull(), // bank | jazzcash | easypaisa
    accountTitle: varchar("account_title", { length: 120 }).notNull(),
    accountNumber: varchar("account_number", { length: 60 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | paid | rejected
    adminNote: text("admin_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [index("payout_requests_farmer_idx").on(t.farmerId), index("payout_requests_status_idx").on(t.status)],
);

/* Audit trail for the admin DB explorer */
export const dbAuditLog = pgTable("db_audit_log", {
  auditId: serial("audit_id").primaryKey(),
  adminId: integer("admin_id").references(() => users.id, { onDelete: "set null" }),
  mode: varchar("mode", { length: 10 }).notNull(), // read | write
  query: text("query").notNull(),
  rowCount: integer("row_count"),
  durationMs: integer("duration_ms"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Crop = typeof cropsInventory.$inferSelect;
export type MandiRate = typeof mandiRates.$inferSelect;
export type Bid = typeof bidsNegotiations.$inferSelect;
export type Order = typeof ordersLogistics.$inferSelect;
export type Inspection = typeof qualityInspections.$inferSelect;
