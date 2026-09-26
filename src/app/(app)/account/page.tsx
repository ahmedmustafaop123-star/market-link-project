import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { CITIES, formatDate } from "@/lib/constants";
import { ChangePasswordForm } from "./password-form";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

const ROLE_NAME = { admin: "Administrator", inspector: "Quality Inspector", farmer: "Farmer (Kisan)", buyer: "Buyer / Wholesaler" } as const;

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ complete?: string }> }) {
  const [u, sp] = await Promise.all([requirePageUser(), searchParams]);
  const incomplete = !u.phone || !u.city;
  const google = u.authProvider.startsWith("google") || !!u.googleId;
  const initials = u.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("");
  return (
    <div className="space-y-6">
      <PageHeader title="Account Settings" urdu="اکاؤنٹ" subtitle="Your profile, sign-in methods and security" />

      {(incomplete || sp.complete) && (
        <div className="card flex items-start gap-3 border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
          <span className="text-2xl">👋</span>
          <div className="text-sm">
            <p className="font-bold text-amber-900 dark:text-amber-200">{incomplete ? "Complete your profile to start trading" : "Profile complete, you're all set!"}</p>
            <p className="text-amber-800/90 dark:text-amber-300/80">{incomplete ? "Add your mobile number and city. Buyers and farmers need them for deals, deliveries and SMS alerts." : "Head to your dashboard to get started."}</p>
          </div>
        </div>
      )}

      <section className="card flex flex-wrap items-center gap-5 p-6">
        {u.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={u.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-16 w-16 rounded-full object-cover ring-4 ring-brand-100 dark:ring-brand-900" />
        ) : (
          <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-900 text-xl font-extrabold text-gold-400">{initials}</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xl font-extrabold">{u.fullName}</p>
          <p className="text-sm text-slate-500">{u.role === "admin" ? (u.title ?? ROLE_NAME.admin) : ROLE_NAME[u.role]} · {u.email}</p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
            {u.role === "admin" && <span className="rounded-full bg-gold-400 px-2 py-0.5 text-brand-950">★ Super Admin</span>}
            {u.userCode && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono dark:bg-white/10">ID {u.userCode}</span>}
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">{u.emailVerified ? "✔ Email verified" : "Email unverified"}</span>
            {google && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300">G · Google linked</span>}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-white/10">Member since {formatDate(u.createdAt)}</span>
          </div>
        </div>
        {!incomplete && <p className="text-sm text-slate-500">📍 {u.city}{CITIES[u.city] ? `, ${CITIES[u.city].province}` : ""}</p>}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <ProfileForm initial={{ fullName: u.fullName, phone: u.phone, city: u.city, businessName: u.businessName ?? "", cnicId: u.cnicId ?? "", address: u.address ?? "" }} highlight={incomplete} />
        {google && u.authProvider.startsWith("google") ? (
          <div className="card space-y-3 p-6">
            <h2 className="font-bold">🔒 Password</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">You signed up with Google, so there&apos;s no MarketLink password on this account yet. Keep using <b>Continue with Google</b>, or set a password to also sign in with email.</p>
            <Link href={`/forgot-password?email=${encodeURIComponent(u.email)}`} className="btn-secondary">Set a password by email link</Link>
          </div>
        ) : (
          <ChangePasswordForm />
        )}
      </div>
    </div>
  );
}
