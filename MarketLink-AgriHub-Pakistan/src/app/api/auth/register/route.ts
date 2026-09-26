import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ApiError, handle, oneOf, readJson, str } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { CITY_NAMES } from "@/lib/constants";
import { issueOtp } from "@/lib/otp";

/** Self-registration for farmers and buyers. Account must verify its email (6-digit OTP) before first login. */
export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    const fullName = str(body, "fullName", { required: true, max: 120 })!;
    const email = str(body, "email", { required: true, max: 160 })!.toLowerCase();
    const password = str(body, "password", { required: true, max: 200 })!;
    const phone = str(body, "phone", { required: true, max: 30 })!;
    const role = oneOf(body, "role", ["farmer", "buyer"] as const, true)!;
    const city = oneOf(body, "city", CITY_NAMES, true)!;
    const cnicId = str(body, "cnicId", { max: 20 });
    const businessName = str(body, "businessName", { max: 160 });
    const address = str(body, "address", { max: 500 });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ApiError(422, "Invalid email address");
    if (password.length < 8) throw new ApiError(422, "Password must be at least 8 characters");
    if (!/^(\+92|0092|0)3\d{9}$/.test(phone.replace(/[\s-]/g, ""))) throw new ApiError(422, "Enter a valid Pakistani mobile number (03xx xxxxxxx)");
    if (cnicId && !/^\d{5}-\d{7}-\d$/.test(cnicId)) throw new ApiError(422, "CNIC must be in format 12345-1234567-1");
    const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (exists) throw new ApiError(409, "An account with this email already exists");
    const [u] = await db
      .insert(users)
      .values({ fullName, email, passwordHash: hashPassword(password), phone, role, city, cnicId, businessName, address, isVerified: role === "buyer", emailVerified: false, walletBalance: 0 })
      .returning({ id: users.id, email: users.email, phone: users.phone });
    const otp = await issueOtp(u, "verify_email");
    return { needsVerification: true, email: u.email, devCode: otp.devCode };
  }, 201);
}
