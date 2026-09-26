import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { Role } from "@/lib/constants";
import { ApiError } from "@/lib/api";
import { ensureSeeded } from "@/lib/seed";
export { hashPassword, verifyPassword } from "@/lib/password";

export const SESSION_COOKIE = "ml_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const SECRET = process.env.SESSION_SECRET || "marketlink-agri-hub-dev-secret-change-me";
const ROLES: Role[] = ["farmer", "buyer", "admin", "inspector"];

function sign(value: string) {
  return createHmac("sha256", SECRET).update(value).digest("hex");
}

/** Token format: `<userId>.<role>.<issuedAtMs>.<hmac>`; the role lets proxy.ts enforce RBAC before rendering. */
export function createSessionToken(userId: number, role: Role) {
  const payload = `${userId}.${role}.${Date.now()}`;
  return `${payload}.${sign(payload)}`;
}

export function parseSessionToken(token: string | undefined): { id: number; role: Role; issuedAt: number } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [id, role, ts, sig] = parts;
  const expected = sign(`${id}.${role}.${ts}`);
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  if (!ROLES.includes(role as Role)) return null;
  if (Date.now() - Number(ts) > SESSION_MAX_AGE * 1000) return null;
  return { id: Number(id), role: role as Role, issuedAt: Number(ts) };
}

export async function startSession(userId: number, role: Role) {
  (await cookies()).set(SESSION_COOKIE, createSessionToken(userId, role), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    secure: process.env.COOKIE_SECURE === "true",
  });
}

export type SessionUser = Omit<typeof users.$inferSelect, "passwordHash">;

export async function getCurrentUser(): Promise<SessionUser | null> {
  await ensureSeeded();
  const store = await cookies();
  const session = parseSessionToken(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const [row] = await db.select().from(users).where(eq(users.id, session.id)).limit(1);
  if (!row) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...safe } = row;
  return safe;
}

/** For API route handlers: throws ApiError (401/403). Role is always re-checked against the database. */
export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "Authentication required");
  if (roles && !roles.includes(user.role)) {
    throw new ApiError(403, roles.length === 1 && roles[0] === "admin" ? ADMIN_DENIED : `Requires role: ${roles.join(" or ")}`);
  }
  return user;
}

export const ADMIN_DENIED = "Access Denied: Admin privileges required";

/** For admin pages: anyone who isn't an admin is sent to /login with an access-denied alert. */
export async function requireAdminPage(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/login?error=admin_required");
  return user;
}

/** For server-rendered pages: redirects instead of throwing. */
export async function requirePageUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}

export function homeFor(role: Role) {
  return role === "farmer" ? "/farmer/dashboard" : role === "buyer" ? "/buyer/dashboard" : role === "inspector" ? "/inspector/dashboard" : "/admin/dashboard";
}
