import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ApiError, handle, oneOf, readJson, str } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { CITY_NAMES } from "@/lib/constants";

/** PATCH /api/account/profile { fullName, phone, city, businessName?, cnicId?, address? } */
export async function PATCH(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const b = await readJson(req);
    const fullName = str(b, "fullName", { required: true, max: 120 })!;
    const phone = str(b, "phone", { required: true, max: 30 })!;
    const city = oneOf(b, "city", CITY_NAMES, true)!;
    const cnicId = str(b, "cnicId", { max: 20 });
    if (!/^(\+92|0092|0)3\d{9}$/.test(phone.replace(/[\s-]/g, ""))) throw new ApiError(422, "Enter a valid Pakistani mobile number (03xx xxxxxxx)");
    if (cnicId && !/^\d{5}-\d{7}-\d$/.test(cnicId)) throw new ApiError(422, "CNIC must be in format 12345-1234567-1");
    const [u] = await db
      .update(users)
      .set({ fullName, phone, city, cnicId: cnicId ?? null, businessName: str(b, "businessName", { max: 160 }) ?? null, address: str(b, "address", { max: 500 }) ?? null })
      .where(eq(users.id, me.id))
      .returning({ id: users.id, fullName: users.fullName, city: users.city });
    return u;
  });
}
