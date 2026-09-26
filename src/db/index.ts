import fs from "fs";
import path from "path";
import { Client, Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";

/**
 * Database connection.
 *
 *  • DATABASE_URL=postgresql://…  → real PostgreSQL server (production / Docker / cloud)
 *  • DATABASE_URL empty or unset   → embedded PostgreSQL (PGlite) stored in ./.data/pglite
 *                                    — zero setup, perfect for local hosting on any PC.
 *  • DATABASE_URL=pglite:./my-dir → embedded PostgreSQL in a custom folder
 *
 * The client is created lazily on first use so `next build` never opens a connection.
 */
export type DB = NodePgDatabase;

const g = globalThis as typeof globalThis & {
  __mlDb?: DB;
  __mlPool?: Pool;
  __mlPglite?: PGlite;
};

const rawUrl = () => (process.env.DATABASE_URL ?? "").trim();

export function usingEmbeddedDb() {
  const u = rawUrl();
  return !u || u.startsWith("pglite:") || u.startsWith("file:");
}

function embeddedDir() {
  const u = rawUrl();
  if (u.startsWith("pglite:") || u.startsWith("file:")) {
    const p = u.replace(/^(pglite|file):(\/\/)?/, "");
    return path.isAbsolute(p) ? p : path.join(/*turbopackIgnore: true*/ process.cwd(), p);
  }
  return path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "pglite");
}

function create(): DB {
  if (usingEmbeddedDb()) {
    const dir = embeddedDir();
    fs.mkdirSync(dir, { recursive: true });
    if (!g.__mlPglite) {
      g.__mlPglite = new PGlite(dir);
      console.log(`[db] Using built-in PostgreSQL (PGlite) → ${dir}`);
    }
    return drizzlePglite(g.__mlPglite) as unknown as DB;
  }
  if (!g.__mlPool) g.__mlPool = new Pool({ connectionString: rawUrl() });
  return drizzle(g.__mlPool);
}

function getDb(): DB {
  if (!g.__mlDb) g.__mlDb = create();
  return g.__mlDb;
}

export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});

/**
 * For real PostgreSQL servers: if the database named in DATABASE_URL does not exist yet
 * (error 3D000), connect to the default "postgres" database and create it.
 */
export async function ensureDatabaseExists() {
  if (usingEmbeddedDb()) return;
  const url = rawUrl();
  const probe = new Client({ connectionString: url });
  try {
    await probe.connect();
    await probe.end();
    return;
  } catch (e) {
    await probe.end().catch(() => {});
    if ((e as { code?: string }).code !== "3D000") throw e;
  }
  const target = new URL(url);
  const name = decodeURIComponent(target.pathname.replace(/^\//, ""));
  if (!/^[A-Za-z0-9_\-]+$/.test(name)) throw new Error(`Database "${name}" does not exist and has an unsafe name to auto-create`);
  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    console.log(`[db] Created missing database "${name}"`);
  } catch (e) {
    if ((e as { code?: string }).code !== "42P04") throw e; // already exists (race)
  } finally {
    await admin.end();
  }
}
