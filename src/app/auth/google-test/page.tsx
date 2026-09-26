import { redirect } from "next/navigation";
import { googleMockEnabled } from "@/lib/google";
import { GoogleTestForm } from "./test-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Google sign-in" };

export default async function GoogleTestPage({ searchParams }: { searchParams: Promise<{ role?: string; next?: string }> }) {
  if (!googleMockEnabled()) redirect("/api/auth/google");
  const sp = await searchParams;
  return <GoogleTestForm role={sp.role === "farmer" ? "farmer" : "buyer"} next={sp.next} />;
}
