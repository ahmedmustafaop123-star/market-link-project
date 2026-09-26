import bcrypt from "bcryptjs";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const BCRYPT_ROUNDS = 10;

/** New passwords are hashed with bcrypt (cost 10). */
export function hashPassword(pw: string) {
  return bcrypt.hashSync(pw, BCRYPT_ROUNDS);
}

/** Hash that can never match a typed password (used for Google-only accounts). */
export function unusablePasswordHash() {
  return hashPassword(randomBytes(32).toString("hex"));
}

export const isLegacyHash = (stored: string) => !stored.startsWith("$2");

/** Verifies bcrypt hashes and legacy scrypt `salt:hash` values from earlier versions. */
export function verifyPassword(pw: string, stored: string) {
  if (!stored) return false;
  if (!isLegacyHash(stored)) return bcrypt.compareSync(pw, stored);
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(pw, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return expected.length === candidate.length && timingSafeEqual(candidate, expected);
}
