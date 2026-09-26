import type { ReactNode } from "react";
import { requirePageUser } from "@/lib/auth";

export default async function InspectorLayout({ children }: { children: ReactNode }) {
  await requirePageUser(["inspector", "admin"]);
  return <>{children}</>;
}
