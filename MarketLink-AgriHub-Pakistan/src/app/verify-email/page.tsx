import { redirect } from "next/navigation";
import { VerifyEmailForm } from "@/components/auth/otp-forms";

export const metadata = { title: "Verify email" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ email?: string; dev?: string }> }) {
  const { email, dev } = await searchParams;
  if (!email) redirect("/register");
  return <VerifyEmailForm email={email} initialDevCode={dev} />;
}
