import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requirePageUser } from "@/lib/auth";
import { getTicker } from "@/lib/ticker";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requirePageUser();
  const [ticker, viewer] = await Promise.all([getTicker(), getViewer(user)]);
  return (
    <AppShell user={{ fullName: user.fullName, role: user.role, businessName: user.businessName, isVerified: user.isVerified, city: user.city, title: user.title, avatarUrl: user.avatarUrl, userCode: user.userCode }} ticker={ticker} viewer={viewer}>
      {children}
    </AppShell>
  );
}
