import { cookies } from "next/headers";
import { handle } from "@/lib/api";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  return handle(async () => {
    (await cookies()).delete(SESSION_COOKIE);
    return { loggedOut: true };
  });
}
