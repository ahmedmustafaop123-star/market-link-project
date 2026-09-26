-- ============================================================================
-- MarketLink Agri-Hub Pakistan: database schema (PostgreSQL 14+, runtime DDL)
-- Generated from src/db/schema.ts (drizzle-kit export). 15 tables:
--   users, crops_inventory, mandi_rates, bids_negotiations, orders_logistics,
--   order_events, quality_inspections, wallet_transactions, disputes, reviews,
--   notifications, auth_tokens, payment_intents, payout_requests, db_audit_log
-- MySQL 8 equivalent: schema.mysql.sql
-- Apply: psql "$DATABASE_URL" -f schema.sql   (the app also creates it automatically)
-- ============================================================================

CREATE TYPE "public"."bid_status" AS ENUM('pending', 'accepted', 'rejected', 'countered', 'withdrawn');
CREATE TYPE "public"."crop_category" AS ENUM('grains', 'vegetables', 'fruits', 'cash_crops');
CREATE TYPE "public"."crop_status" AS ENUM('active', 'pending_inspection', 'sold_out', 'archived');
CREATE TYPE "public"."delivery_stage" AS ENUM('confirmed', 'quality_checked', 'dispatched', 'in_transit', 'delivered');
CREATE TYPE "public"."dispute_status" AS ENUM('open', 'investigating', 'resolved_release', 'resolved_refund');
CREATE TYPE "public"."inspection_status" AS ENUM('pending', 'passed', 'failed');
CREATE TYPE "public"."payment_status" AS ENUM('awaiting_escrow', 'escrow_locked', 'released', 'refunded', 'disputed');
CREATE TYPE "public"."quality_grade" AS ENUM('A', 'B', 'C');
CREATE TYPE "public"."user_role" AS ENUM('farmer', 'buyer', 'admin', 'inspector');
CREATE TYPE "public"."wallet_txn_type" AS ENUM('deposit', 'escrow_lock', 'escrow_release', 'payout', 'refund', 'platform_fee', 'withdrawal');
CREATE TABLE "auth_tokens" (
	"token_id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"purpose" varchar(20) NOT NULL,
	"code_hash" varchar(128) NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "bids_negotiations" (
	"bid_id" serial PRIMARY KEY NOT NULL,
	"crop_id" integer NOT NULL,
	"buyer_id" integer NOT NULL,
	"bid_price_per_kg" numeric(14, 2) NOT NULL,
	"bid_quantity_kg" numeric(14, 2) NOT NULL,
	"target_delivery_date" date,
	"message" text,
	"status" "bid_status" DEFAULT 'pending' NOT NULL,
	"counter_price" numeric(14, 2),
	"counter_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "crops_inventory" (
	"crop_id" serial PRIMARY KEY NOT NULL,
	"farmer_id" integer NOT NULL,
	"crop_name" varchar(80) NOT NULL,
	"category" "crop_category" NOT NULL,
	"quality_grade" "quality_grade" NOT NULL,
	"total_quantity_kg" numeric(14, 2) NOT NULL,
	"base_price_per_kg" numeric(14, 2) NOT NULL,
	"harvest_date" date NOT NULL,
	"images_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"description" text,
	"farm_location" varchar(80) NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"status" "crop_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "db_audit_log" (
	"audit_id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer,
	"mode" varchar(10) NOT NULL,
	"query" text NOT NULL,
	"row_count" integer,
	"duration_ms" integer,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "disputes" (
	"dispute_id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"raised_by" integer NOT NULL,
	"reason" text NOT NULL,
	"status" "dispute_status" DEFAULT 'open' NOT NULL,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);

CREATE TABLE "mandi_rates" (
	"rate_id" serial PRIMARY KEY NOT NULL,
	"crop_name" varchar(80) NOT NULL,
	"market_location" varchar(80) NOT NULL,
	"min_price_per_kg" numeric(14, 2) NOT NULL,
	"max_price_per_kg" numeric(14, 2) NOT NULL,
	"avg_price_per_kg" numeric(14, 2) NOT NULL,
	"source" varchar(20) DEFAULT 'manual' NOT NULL,
	"date_updated" date NOT NULL
);

CREATE TABLE "notifications" (
	"notification_id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" varchar(40) NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text,
	"link" varchar(300),
	"channels" varchar(60) DEFAULT 'in_app' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "order_events" (
	"event_id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"stage" varchar(40) NOT NULL,
	"location" varchar(120),
	"lat" double precision,
	"lng" double precision,
	"note" text,
	"actor_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "orders_logistics" (
	"order_id" serial PRIMARY KEY NOT NULL,
	"bid_id" integer NOT NULL,
	"crop_id" integer NOT NULL,
	"farmer_id" integer NOT NULL,
	"buyer_id" integer NOT NULL,
	"quantity_kg" numeric(14, 2) NOT NULL,
	"price_per_kg" numeric(14, 2) NOT NULL,
	"total_amount" numeric(14, 2) NOT NULL,
	"payment_status" "payment_status" DEFAULT 'awaiting_escrow' NOT NULL,
	"delivery_stage" "delivery_stage" DEFAULT 'confirmed' NOT NULL,
	"transit_location" varchar(120),
	"current_lat" double precision,
	"current_lng" double precision,
	"tracking_number" varchar(40) NOT NULL,
	"expected_delivery_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "payment_intents" (
	"intent_id" serial PRIMARY KEY NOT NULL,
	"reference" varchar(60) NOT NULL,
	"user_id" integer NOT NULL,
	"provider" varchar(20) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"provider_ref" varchar(200),
	"raw_callback" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);

CREATE TABLE "payout_requests" (
	"payout_id" serial PRIMARY KEY NOT NULL,
	"farmer_id" integer NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"method" varchar(20) NOT NULL,
	"account_title" varchar(120) NOT NULL,
	"account_number" varchar(60) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"admin_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);

CREATE TABLE "quality_inspections" (
	"inspection_id" serial PRIMARY KEY NOT NULL,
	"crop_id" integer NOT NULL,
	"inspector_id" integer NOT NULL,
	"grade_assigned" "quality_grade" NOT NULL,
	"moisture_level_percentage" numeric(5, 2) NOT NULL,
	"soil_ph" numeric(4, 2),
	"inspection_notes" text,
	"report_attachment" text,
	"report_file_name" varchar(200),
	"certificate_no" varchar(40),
	"status" "inspection_status" DEFAULT 'pending' NOT NULL,
	"verified_at" timestamp with time zone
);

CREATE TABLE "reviews" (
	"review_id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"buyer_id" integer NOT NULL,
	"farmer_id" integer NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"farmer_reply" text,
	"replied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"full_name" varchar(120) NOT NULL,
	"email" varchar(160) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"phone" varchar(30) NOT NULL,
	"role" "user_role" NOT NULL,
	"cnic_id" varchar(20),
	"business_name" varchar(160),
	"city" varchar(80) NOT NULL,
	"address" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"title" varchar(120),
	"user_code" varchar(40),
	"avatar_url" text,
	"google_id" varchar(64),
	"auth_provider" varchar(20) DEFAULT 'password' NOT NULL,
	"trust_score" numeric(3, 2) DEFAULT 0 NOT NULL,
	"rating_avg" numeric(3, 2) DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"wallet_balance" numeric(14, 2) DEFAULT 0 NOT NULL,
	"escrow_balance" numeric(14, 2) DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "wallet_transactions" (
	"txn_id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"order_id" integer,
	"type" "wallet_txn_type" NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "bids_negotiations" ADD CONSTRAINT "bids_negotiations_crop_id_crops_inventory_crop_id_fk" FOREIGN KEY ("crop_id") REFERENCES "public"."crops_inventory"("crop_id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "bids_negotiations" ADD CONSTRAINT "bids_negotiations_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "crops_inventory" ADD CONSTRAINT "crops_inventory_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "db_audit_log" ADD CONSTRAINT "db_audit_log_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_order_id_orders_logistics_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders_logistics"("order_id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_raised_by_users_id_fk" FOREIGN KEY ("raised_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_logistics_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders_logistics"("order_id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "orders_logistics" ADD CONSTRAINT "orders_logistics_bid_id_bids_negotiations_bid_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."bids_negotiations"("bid_id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "orders_logistics" ADD CONSTRAINT "orders_logistics_crop_id_crops_inventory_crop_id_fk" FOREIGN KEY ("crop_id") REFERENCES "public"."crops_inventory"("crop_id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "orders_logistics" ADD CONSTRAINT "orders_logistics_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "orders_logistics" ADD CONSTRAINT "orders_logistics_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_crop_id_crops_inventory_crop_id_fk" FOREIGN KEY ("crop_id") REFERENCES "public"."crops_inventory"("crop_id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_inspector_id_users_id_fk" FOREIGN KEY ("inspector_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_logistics_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders_logistics"("order_id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_order_id_orders_logistics_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders_logistics"("order_id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "auth_tokens_user_idx" ON "auth_tokens" USING btree ("user_id","purpose");
CREATE INDEX "bids_crop_idx" ON "bids_negotiations" USING btree ("crop_id");
CREATE INDEX "bids_buyer_idx" ON "bids_negotiations" USING btree ("buyer_id");
CREATE INDEX "bids_status_idx" ON "bids_negotiations" USING btree ("status");
CREATE INDEX "crops_farmer_idx" ON "crops_inventory" USING btree ("farmer_id");
CREATE INDEX "crops_category_idx" ON "crops_inventory" USING btree ("category");
CREATE INDEX "crops_status_idx" ON "crops_inventory" USING btree ("status");
CREATE INDEX "crops_name_idx" ON "crops_inventory" USING btree ("crop_name");
CREATE INDEX "disputes_order_idx" ON "disputes" USING btree ("order_id");
CREATE INDEX "disputes_status_idx" ON "disputes" USING btree ("status");
CREATE UNIQUE INDEX "mandi_crop_market_date_uq" ON "mandi_rates" USING btree ("crop_name","market_location","date_updated");
CREATE INDEX "mandi_date_idx" ON "mandi_rates" USING btree ("date_updated");
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","is_read");
CREATE INDEX "order_events_order_idx" ON "order_events" USING btree ("order_id");
CREATE UNIQUE INDEX "orders_bid_uq" ON "orders_logistics" USING btree ("bid_id");
CREATE UNIQUE INDEX "orders_tracking_uq" ON "orders_logistics" USING btree ("tracking_number");
CREATE INDEX "orders_farmer_idx" ON "orders_logistics" USING btree ("farmer_id");
CREATE INDEX "orders_buyer_idx" ON "orders_logistics" USING btree ("buyer_id");
CREATE INDEX "orders_stage_idx" ON "orders_logistics" USING btree ("delivery_stage");
CREATE UNIQUE INDEX "payment_intents_ref_uq" ON "payment_intents" USING btree ("reference");
CREATE INDEX "payment_intents_user_idx" ON "payment_intents" USING btree ("user_id");
CREATE INDEX "payout_requests_farmer_idx" ON "payout_requests" USING btree ("farmer_id");
CREATE INDEX "payout_requests_status_idx" ON "payout_requests" USING btree ("status");
CREATE INDEX "inspections_crop_idx" ON "quality_inspections" USING btree ("crop_id");
CREATE INDEX "inspections_status_idx" ON "quality_inspections" USING btree ("status");
CREATE UNIQUE INDEX "reviews_order_uq" ON "reviews" USING btree ("order_id");
CREATE INDEX "reviews_farmer_idx" ON "reviews" USING btree ("farmer_id");
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");
CREATE UNIQUE INDEX "users_google_id_uq" ON "users" USING btree ("google_id");
CREATE UNIQUE INDEX "users_user_code_uq" ON "users" USING btree ("user_code");
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");
CREATE INDEX "users_city_idx" ON "users" USING btree ("city");
CREATE INDEX "wallet_user_idx" ON "wallet_transactions" USING btree ("user_id");
