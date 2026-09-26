import { sql } from "drizzle-orm";
import { db } from "@/db";
import { dbAuditLog } from "@/db/schema";
import { ApiError, handle, oneOf, readJson, str } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
const MAX_ROWS = 500;

/** Strip string literals, quoted identifiers and comments so keyword / semicolon checks aren't fooled. */
function normalise(q: string) {
  return q.replace(/'(?:[^']|'')*'/g, "''").replace(/"(?:[^"]|"")*"/g, '""').replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

const BLOCKED = /\b(drop\s+database|create\s+database|alter\s+system|copy\b[\s\S]*\bprogram|pg_read_file|pg_read_binary_file|pg_ls_dir|lo_import|lo_export|dblink|pg_terminate_backend|pg_cancel_backend|create\s+(or\s+replace\s+)?function|create\s+extension|set\s+role|reset\s+role|grant|revoke)\b/i;
const WRITE = /^\s*(insert|update|delete|create|alter|drop|truncate|comment|vacuum|analyze|reindex|cluster|refresh)\b/i;

/**
 * POST /api/db/query { sql, mode: "read" | "write", confirm? }
 * Admin-only SQL console (also enforced by proxy.ts).
 *  • read  → runs inside a READ ONLY transaction with an 8s statement timeout, max 500 rows returned
 *  • write → requires confirm: true; blocked dangerous statements; always audited in db_audit_log
 */
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireUser(["admin"]);
    const b = await readJson(req);
    const query = str(b, "sql", { required: true, max: 20000 })!.trim().replace(/;\s*$/, "");
    const mode = oneOf(b, "mode", ["read", "write"] as const) ?? "read";
    const norm = normalise(query);
    if (norm.includes(";")) throw new ApiError(422, "Run one statement at a time");
    if (BLOCKED.test(norm)) throw new ApiError(403, "This statement is blocked in the web console for safety");
    if (mode === "read" && WRITE.test(norm)) throw new ApiError(422, "This is a write statement. Switch to write mode and confirm to run it.");
    if (mode === "write" && b.confirm !== true) throw new ApiError(428, "Write queries require confirmation");

    const started = Date.now();
    let error: string | null = null;
    try {
      const res = (await db.transaction(async (tx) => {
        if (mode === "read") await tx.execute(sql`SET TRANSACTION READ ONLY`);
        await tx.execute(sql.raw(`SET LOCAL statement_timeout = '8s'`)).catch(() => undefined);
        return tx.execute(sql.raw(query));
      })) as unknown as { rows?: Record<string, unknown>[]; fields?: { name: string }[]; rowCount?: number | null; affectedRows?: number; command?: string };
      const rows = res.rows ?? [];
      const columns = res.fields?.map((f) => f.name) ?? (rows[0] ? Object.keys(rows[0]) : []);
      const affected = res.rowCount ?? res.affectedRows ?? rows.length;
      const out = {
        columns,
        rows: rows.slice(0, MAX_ROWS).map((r) => columns.map((c) => {
          const v = r[c];
          if (v instanceof Date) return v.toISOString();
          if (typeof v === "string" && v.length > 400) return v.slice(0, 400) + "…";
          if (v !== null && typeof v === "object") return JSON.stringify(v).slice(0, 400);
          return v as string | number | boolean | null;
        })),
        rowCount: rows.length,
        affected,
        truncated: rows.length > MAX_ROWS,
        command: res.command ?? (WRITE.exec(norm)?.[1] ?? "SELECT").toUpperCase(),
        durationMs: Date.now() - started,
      };
      return out;
    } catch (e) {
      const cause = (e as { cause?: { message?: string } }).cause?.message;
      error = cause ?? (e as Error).message.replace(/^Failed query:[\s\S]*$/, "Query failed");
      throw new ApiError(400, error.replace(/^error:\s*/i, ""));
    } finally {
      await db.insert(dbAuditLog).values({ adminId: admin.id, mode, query: query.slice(0, 5000), durationMs: Date.now() - started, error }).catch(() => undefined);
    }
  });
}
