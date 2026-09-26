import { desc, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { dbAuditLog, users } from "@/db/schema";
import { handle } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET /api/db/schema: tables, columns, keys, indexes, row counts + recent audit log (admin only) */
export async function GET() {
  return handle(async () => {
    await requireUser(["admin"]);
    const cols = (await db.execute(sql`
      select c.table_name, c.column_name, c.data_type, c.udt_name, c.is_nullable, c.column_default, c.ordinal_position
      from information_schema.columns c
      join information_schema.tables t on t.table_name = c.table_name and t.table_schema = c.table_schema
      where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
      order by c.table_name, c.ordinal_position`)).rows as { table_name: string; column_name: string; data_type: string; udt_name: string; is_nullable: string; column_default: string | null }[];
    const keys = (await db.execute(sql`
      select tc.table_name, kcu.column_name, tc.constraint_type, ccu.table_name as ref_table, ccu.column_name as ref_column
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
      left join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and tc.constraint_type = 'FOREIGN KEY'
      where tc.table_schema = 'public' and tc.constraint_type in ('PRIMARY KEY', 'FOREIGN KEY')`)).rows as { table_name: string; column_name: string; constraint_type: string; ref_table: string | null; ref_column: string | null }[];
    const idx = (await db.execute(sql`select tablename, indexname, indexdef from pg_indexes where schemaname = 'public' order by tablename, indexname`)).rows as { tablename: string; indexname: string; indexdef: string }[];

    const tables = [...new Set(cols.map((c) => c.table_name))];
    const counts: Record<string, number> = {};
    for (const t of tables) {
      const r = await db.execute(sql.raw(`select count(*)::int as n from "${t.replace(/"/g, "")}"`));
      counts[t] = Number((r.rows[0] as { n: number }).n);
    }
    const audit = await db
      .select({ id: dbAuditLog.auditId, mode: dbAuditLog.mode, query: dbAuditLog.query, durationMs: dbAuditLog.durationMs, error: dbAuditLog.error, at: dbAuditLog.createdAt, admin: users.fullName })
      .from(dbAuditLog)
      .leftJoin(users, eq(users.id, dbAuditLog.adminId))
      .orderBy(desc(dbAuditLog.createdAt))
      .limit(25);

    return {
      engine: process.env.DATABASE_URL?.startsWith("postgres") ? "PostgreSQL" : "PostgreSQL (embedded PGlite)",
      tables: tables.map((t) => ({
        name: t,
        rows: counts[t],
        columns: cols.filter((c) => c.table_name === t).map((c) => {
          const pk = keys.some((k) => k.table_name === t && k.column_name === c.column_name && k.constraint_type === "PRIMARY KEY");
          const fk = keys.find((k) => k.table_name === t && k.column_name === c.column_name && k.constraint_type === "FOREIGN KEY");
          return { name: c.column_name, type: c.data_type === "USER-DEFINED" ? c.udt_name : c.data_type, nullable: c.is_nullable === "YES", default: c.column_default, pk, fk: fk ? `${fk.ref_table}.${fk.ref_column}` : null };
        }),
        indexes: idx.filter((i) => i.tablename === t).map((i) => ({ name: i.indexname, def: i.indexdef })),
      })),
      audit,
    };
  });
}
