import { handle, oneOf, readJson, str } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { CITY_NAMES } from "@/lib/constants";
import { createUserByAdmin, listUsers } from "@/lib/services/admin";

export const dynamic = "force-dynamic";

/** GET /api/admin/users?role=farmer|buyer|admin */
export async function GET(req: Request) {
  return handle(async () => {
    await requireUser(["admin"]);
    const role = new URL(req.url).searchParams.get("role");
    return listUsers(role === "farmer" || role === "buyer" || role === "admin" || role === "inspector" ? role : undefined);
  });
}

/** POST /api/admin/users: admin creates an account (admin / inspector / farmer / buyer) */
export async function POST(req: Request) {
  return handle(async () => {
    await requireUser(["admin"]);
    const b = await readJson(req);
    return createUserByAdmin({
      fullName: str(b, "fullName", { required: true, max: 120 })!,
      email: str(b, "email", { required: true, max: 160 })!.toLowerCase(),
      password: str(b, "password", { required: true, max: 200 })!,
      phone: str(b, "phone", { required: true, max: 30 })!,
      role: oneOf(b, "role", ["farmer", "buyer", "admin", "inspector"] as const, true)!,
      city: oneOf(b, "city", CITY_NAMES, true)!,
      cnicId: str(b, "cnicId", { max: 20 }),
      businessName: str(b, "businessName", { max: 160 }),
    });
  }, 201);
}
