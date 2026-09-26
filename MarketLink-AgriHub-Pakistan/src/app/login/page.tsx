import { redirect } from "next/navigation";
import { ADMIN_DENIED, getCurrentUser, homeFor } from "@/lib/auth";
import { googleConfigured } from "@/lib/google";
import { LoginForm, type LoginAlert } from "./login-form";

export const dynamic = "force-dynamic";

type SP = { email?: string; role?: string; next?: string; error?: string; msg?: string };

function alertFor(sp: SP): LoginAlert {
  switch (sp.error) {
    case "admin_required":
      return { kind: "error", title: ADMIN_DENIED, body: "This area is restricted to MarketLink administrators." };
    case "google_failed":
      return { kind: "error", title: "Google sign-in failed", body: sp.msg?.slice(0, 200) };
    case "google_not_configured":
      return { kind: "info", title: "Google sign-in isn't set up on this server", body: "An administrator must add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. Use email and password for now." };
    default:
      return null;
  }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<SP> }) {
  const [user, sp] = await Promise.all([getCurrentUser(), searchParams]);
  const alert = alertFor(sp);
  // Signed-in users go to their dashboard, unless they were bounced here by the admin guard
  if (user && !alert) redirect(homeFor(user.role));
  if (user && user.role === "admin" && sp.error === "admin_required") redirect(sp.next ?? homeFor("admin"));
  return (
    <LoginForm
      initialEmail={sp.email ?? ""}
      initialRole={sp.role === "farmer" ? "farmer" : "buyer"}
      startOnRegister={sp.role === "farmer" || sp.role === "buyer"}
      next={sp.next}
      alert={alert}
      signedInAs={user ? { fullName: user.fullName, role: user.role } : null}
      key={googleConfigured() ? "g" : "n"}
    />
  );
}
