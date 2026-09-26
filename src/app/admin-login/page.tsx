import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { LoginForm } from "@/app/login/login-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin login" };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  return <LoginForm initialEmail="ahmed.mustafa@admin.com" initialRole="farmer" startOnRegister={false} adminMode next={next} />;
}
