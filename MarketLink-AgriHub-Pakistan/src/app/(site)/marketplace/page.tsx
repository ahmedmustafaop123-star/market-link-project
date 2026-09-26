import { getCurrentUser } from "@/lib/auth";
import { MarketplaceClient } from "@/components/marketplace/marketplace-client";

export const metadata = { title: "Marketplace" };
export const dynamic = "force-dynamic";

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [sp, user] = await Promise.all([searchParams, getCurrentUser()]);
  return (
    <MarketplaceClient
      homeCity={user?.city ?? "Lahore"}
      viewerRole={user?.role ?? null}
      initial={{ q: sp.q, category: sp.category, grade: sp.grade, sort: sp.sort, farmerId: sp.farmerId }}
    />
  );
}
