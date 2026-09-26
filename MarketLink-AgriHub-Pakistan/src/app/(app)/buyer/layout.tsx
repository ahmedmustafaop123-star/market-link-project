import type { ReactNode } from "react";
import { requirePageUser } from "@/lib/auth";

export default async function BuyerLayout({ children }: { children: ReactNode }) {
  await requirePageUser(["buyer"]);
  return <>{children}</>;
}
