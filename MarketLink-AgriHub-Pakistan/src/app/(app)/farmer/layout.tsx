import type { ReactNode } from "react";
import { requirePageUser } from "@/lib/auth";

export default async function FarmerLayout({ children }: { children: ReactNode }) {
  await requirePageUser(["farmer"]);
  return <>{children}</>;
}
