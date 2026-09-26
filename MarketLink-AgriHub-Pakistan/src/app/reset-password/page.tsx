import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/otp-forms";

export const metadata = { title: "Reset password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) redirect("/forgot-password");
  return <ResetPasswordForm token={token} />;
}
