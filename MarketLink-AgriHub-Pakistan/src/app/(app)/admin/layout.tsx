import type { ReactNode } from "react";
import { requireAdminPage } from "@/lib/auth";

/** Every /admin/* page is admin-only (also enforced earlier in src/proxy.ts). */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdminPage();
  return <>{children}</>;
}
