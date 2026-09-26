#!/usr/bin/env node
/* eslint-disable */
/**
 * Local database diagnostic:
 *   node scripts/check-db.cjs            test the DATABASE_URL in .env
 *   node scripts/check-db.cjs --create   also create the database if missing
 *
 * Does not print the connection string or password.
 */
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const dotenv = require("dotenv");

const root = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(root, ".env"), quiet: true });
const databaseUrl = (process.env.DATABASE_URL ?? "").trim();

if (!databaseUrl || /^(pglite|file):/i.test(databaseUrl)) {
  const dir = !databaseUrl
    ? path.join(root, ".data", "pglite")
    : path.resolve(root, databaseUrl.replace(/^(pglite|file):(?:\/\/)?/i, ""));
  console.log("MARKETLINK AGRI-HUB is configured to use its built-in database (PGlite).");
  console.log(`Data folder: ${dir}`);
  console.log(fs.existsSync(dir) ? "Local data folder exists." : "No data yet. Starting the website will create it.");
  console.log("PGlite does not use TCP port 5432, so pgAdmin cannot connect to this folder directly.");
  console.log("To use PostgreSQL and pgAdmin, set DATABASE_URL in .env and run this check again.");
  process.exit(0);
}

let parsed;
try {
  parsed = new URL(databaseUrl);
  if (!(["postgres:", "postgresql:"].includes(parsed.protocol)) || !parsed.pathname || parsed.pathname === "/") throw new Error("Invalid PostgreSQL URL");
} catch {
  console.error("Invalid DATABASE_URL in .env. Use: postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/app_db");
  process.exit(1);
}

const name = decodeURIComponent(parsed.pathname.slice(1));
const target = `${parsed.hostname}:${parsed.port || "5432"}/${name}`;

async function connect(url) {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    return client;
  } catch (error) {
    await client.end().catch(() => undefined);
    throw error;
  }
}

async function check() {
  let client;
  try {
    client = await connect(databaseUrl);
  } catch (error) {
    if (error.code !== "3D000" || !process.argv.includes("--create")) throw error;
    if (!/^[A-Za-z0-9_-]+$/.test(name)) throw new Error("Database name contains unsupported characters. Use letters, numbers, underscores or hyphens.");
    const adminUrl = new URL(databaseUrl);
    adminUrl.pathname = "/postgres";
    const admin = await connect(adminUrl.toString());
    try {
      await admin.query(`CREATE DATABASE "${name}"`);
      console.log(`Created database ${name}.`);
    } catch (createError) {
      if (createError.code !== "42P04") throw createError;
    } finally {
      await admin.end();
    }
    client = await connect(databaseUrl);
  }
  try {
    const info = await client.query("SELECT current_database() AS database_name, current_user AS username, to_regclass('public.users') IS NOT NULL AS has_tables");
    console.log(`Connected to PostgreSQL at ${target} as ${info.rows[0].username}.`);
    if (info.rows[0].has_tables) {
      const count = await client.query("SELECT count(*)::int AS n FROM public.users");
      console.log(`MARKETLINK AGRI-HUB tables found (${count.rows[0].n} users). You can view them in pgAdmin.`);
    } else {
      console.log("Database is empty. Start the website and open /login once to create the tables and demo data.");
    }
  } finally {
    await client.end();
  }
}

check().catch((error) => {
  const code = error.code;
  if (code === "3D000") console.error(`Database ${name} does not exist. Create it in pgAdmin or run: node scripts/check-db.cjs --create`);
  else if (code === "28P01") console.error("PostgreSQL rejected the password. Check the postgres user password in .env.");
  else if (code === "ECONNREFUSED" || code === "ETIMEDOUT") console.error(`Could not reach PostgreSQL at ${parsed.hostname}:${parsed.port || "5432"}. Make sure the PostgreSQL service is running and the port is correct.`);
  else console.error(`PostgreSQL connection failed: ${error.message}`);
  process.exitCode = 1;
});
