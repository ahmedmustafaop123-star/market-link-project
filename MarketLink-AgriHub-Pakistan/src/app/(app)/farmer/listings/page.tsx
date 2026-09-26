import { ListingsClient } from "./listings-client";

export default async function ListingsPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const sp = await searchParams;
  return <ListingsClient openNew={sp.new === "1"} />;
}
