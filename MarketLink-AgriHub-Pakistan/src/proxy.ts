import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Edge-of-app RBAC guard (Next.js 16 Proxy, Node.js runtime).
 * Verifies the signed session cookie and enforces role isolation before any page renders.
 * Pages and API handlers re-check the role against the database (defence in depth).
 */
const SECRET = process.env.SESSION_SECRET || "marketlink-agri-hub-dev-secret-change-me";
const MAX_AGE_MS = 60 * 60 * 24 * 7 * 1000;

type Role = "farmer" | "buyer" | "admin" | "inspector";
const RULES: { prefix: string; roles: Role[] }[] = [
  { prefix: "/admin", roles: ["admin"] },
  { prefix: "/api/db", roles: ["admin"] },
  { prefix: "/api/admin", roles: ["admin"] },
  { prefix: "/inspector", roles: ["inspector", "admin"] },
  { prefix: "/farmer", roles: ["farmer"] },
  { prefix: "/buyer", roles: ["buyer"] },
  { prefix: "/account", roles: ["farmer", "buyer", "admin", "inspector"] },
  { prefix: "/wallet", roles: ["farmer", "buyer"] },
  { prefix: "/notifications", roles: ["farmer", "buyer", "admin", "inspector"] },
];
const HOME: Record<Role, string> = { farmer: "/farmer/dashboard", buyer: "/buyer/dashboard", admin: "/admin/dashboard", inspector: "/inspector/dashboard" };

function readRole(token: string | undefined): Role | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [id, role, ts, sig] = parts;
  const expected = createHmac("sha256", SECRET).update(`${id}.${role}.${ts}`).digest("hex");
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  if (Date.now() - Number(ts) > MAX_AGE_MS) return null;
  return role in HOME ? (role as Role) : null;
}

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const rule = RULES.find((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"));
  if (!rule) return NextResponse.next();

  const role = readRole(req.cookies.get("ml_session")?.value);
  const isApi = pathname.startsWith("/api/");
  const adminArea = rule.roles.length === 1 && rule.roles[0] === "admin";

  // Admin area: guests AND signed-in non-admins → /login with "Access Denied" alert (API → 403 JSON)
  if (adminArea && role !== "admin") {
    if (isApi) return NextResponse.json({ success: false, error: "Access Denied: Admin privileges required" }, { status: role ? 403 : 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?error=admin_required&next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (!role) {
    if (isApi) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  if (!rule.roles.includes(role)) {
    if (isApi) return NextResponse.json({ success: false, error: `Requires role: ${rule.roles.join(" or ")}` }, { status: 403 });
    const url = req.nextUrl.clone();
    url.pathname = HOME[role];
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/db/:path*", "/api/admin/:path*", "/inspector/:path*", "/farmer/:path*", "/buyer/:path*", "/account/:path*", "/wallet/:path*", "/notifications/:path*"],
};
