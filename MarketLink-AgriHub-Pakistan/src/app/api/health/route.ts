import { db, ensureDatabaseExists } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // On a first local PostgreSQL run, create the configured database before
    // probing it. The schema and demo data are bootstrapped on the first page visit.
    await ensureDatabaseExists();
    await db.execute(sql`select 1`);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[health] Database unavailable:", error);
    return Response.json({ ok: false }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
