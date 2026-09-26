import { sql } from "drizzle-orm";
import { db } from "@/db";
import { POSTGRES_DDL } from "@/lib/ddl-postgres";
import { hashPassword } from "@/lib/password";

/**
 * Idempotent schema upgrades for databases created by earlier versions
 * (e.g. the built-in local database of a previous download).
 * Fresh databases get the full DDL in seed.ts instead.
 */
const IGNORABLE = new Set(["42P07", "42710", "42701", "42P06", "42P16", "23505"]); // already exists / duplicate

async function tolerant(stmt: string) {
  try {
    await db.execute(sql.raw(stmt));
  } catch (e) {
    const code = (e as { code?: string }).code ?? (e as { cause?: { code?: string } }).cause?.code;
    if (!code || !IGNORABLE.has(code)) throw e;
  }
}

export async function needsUpgrade() {
  const r = await db.execute(sql`
    select to_regclass('public.db_audit_log') is not null as t,
           exists (select 1 from information_schema.columns where table_name = 'users' and column_name = 'trust_score')
             and exists (select 1 from information_schema.columns where table_name = 'users' and column_name = 'google_id')
             and exists (select 1 from information_schema.columns where table_name = 'reviews' and column_name = 'farmer_reply')
             and exists (select 1 from information_schema.columns where table_name = 'reviews' and column_name = 'replied_at') as c,
           exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'user_role' and e.enumlabel = 'inspector') as r`);
  const row = r.rows[0] as { t: boolean; c: boolean; r: boolean };
  return !(row.t && row.c && row.r);
}

export async function upgradeSchema() {
  console.log("[migrate] upgrading database schema to the latest version");
  // Enum values must be added outside a transaction and before use.
  await tolerant(`ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'inspector'`);
  await tolerant(`ALTER TYPE "public"."wallet_txn_type" ADD VALUE IF NOT EXISTS 'withdrawal'`);
  // New columns on existing tables
  for (const stmt of [
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" boolean DEFAULT false NOT NULL`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "trust_score" numeric(3, 2) DEFAULT 0 NOT NULL`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "rating_avg" numeric(3, 2) DEFAULT 0 NOT NULL`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "rating_count" integer DEFAULT 0 NOT NULL`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "title" varchar(120)`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "user_code" varchar(40)`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" text`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_id" varchar(64)`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auth_provider" varchar(20) DEFAULT 'password' NOT NULL`,
    `ALTER TABLE "orders_logistics" ADD COLUMN IF NOT EXISTS "current_lat" double precision`,
    `ALTER TABLE "orders_logistics" ADD COLUMN IF NOT EXISTS "current_lng" double precision`,
    `ALTER TABLE "order_events" ADD COLUMN IF NOT EXISTS "lat" double precision`,
    `ALTER TABLE "order_events" ADD COLUMN IF NOT EXISTS "lng" double precision`,
    `ALTER TABLE "quality_inspections" ADD COLUMN IF NOT EXISTS "report_file_name" varchar(200)`,
    `ALTER TABLE "quality_inspections" ADD COLUMN IF NOT EXISTS "certificate_no" varchar(40)`,
    `ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "farmer_reply" text`,
    `ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "replied_at" timestamp with time zone`,
  ]) await tolerant(stmt);
  // New tables, indexes and foreign keys: replay the full DDL, skipping objects that already exist.
  for (const stmt of POSTGRES_DDL.split(/;\s*(?:\n|$)/).map((s) => s.trim()).filter(Boolean)) await tolerant(stmt);

  console.log("[migrate] done");
}

/**
 * Idempotent data backfill, safe to run on every start:
 *  • legacy accounts (created before OTP verification existed, i.e. no auth_tokens rows) are marked email-verified
 *  • a Quality Inspector account exists
 */
export const SUPER_ADMIN = {
  userCode: "admin_01",
  fullName: "Ahmed Mustafa",
  email: "ahmed.mustafa@admin.com",
  title: "Super Admin & Systems Controller",
} as const;

export async function backfillData() {
  // Primary admin → Ahmed Mustafa (renames the legacy demo admin once; skipped if ADMIN_EMAIL is customised)
  if (!process.env.ADMIN_EMAIL) {
    const has = await db.execute(sql`select 1 from users where email = ${SUPER_ADMIN.email} limit 1`);
    if (!has.rows.length) {
      await db.execute(sql`update users set full_name = ${SUPER_ADMIN.fullName}, email = ${SUPER_ADMIN.email}, title = ${SUPER_ADMIN.title},
        user_code = ${SUPER_ADMIN.userCode}, business_name = 'MarketLink Platform Management'
        where email = 'admin@marketlink.pk' and role = 'admin'`);
    }
  }
  await db.execute(sql`update users set title = ${SUPER_ADMIN.title}, user_code = ${SUPER_ADMIN.userCode}
    where user_code is null and title is null and role = 'admin'
      and id = (select min(id) from users where role = 'admin')
      and not exists (select 1 from users where user_code = ${SUPER_ADMIN.userCode})`);

  await db.execute(sql`update users set email_verified = true
    where email_verified = false and not exists (select 1 from auth_tokens t where t.user_id = users.id)`);
  const hasInspector = await db.execute(sql`select 1 from users where role = 'inspector' limit 1`);
  if (!hasInspector.rows.length) {
    await db.execute(sql`insert into users (full_name, email, password_hash, phone, role, cnic_id, city, address, is_verified, email_verified, business_name)
      values ('Dr. Farhan Malik', 'inspector@marketlink.pk', ${hashPassword("password123")}, '+92 300 7788990', 'inspector', '35202-9988776-3', 'Faisalabad',
              'Ayub Agricultural Research Institute, Faisalabad', true, true, 'MarketLink Quality Lab')
      on conflict do nothing`);
  }
}
