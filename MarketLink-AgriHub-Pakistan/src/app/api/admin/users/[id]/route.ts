import { ApiError, handle, oneOf, readJson, str } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { changeRole, resetUserPassword, setVerified } from "@/lib/services/admin";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/users/:id
 *   { isVerified: boolean }          verify / revoke
 *   { newPassword: "..." }           reset password
 *   { role: "admin"|"farmer"|"buyer" } change role
 */
export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const admin = await requireUser(["admin"]);
    const id = Number((await params).id);
    const b = await readJson(req);
    if (typeof b.isVerified === "boolean") return setVerified(id, b.isVerified);
    const newPassword = str(b, "newPassword", { max: 200 });
    if (newPassword) return resetUserPassword(id, newPassword);
    const role = oneOf(b, "role", ["farmer", "buyer", "admin", "inspector"] as const);
    if (role) return changeRole(admin, id, role);
    throw new ApiError(422, "Provide isVerified, newPassword or role");
  });
}
