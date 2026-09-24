import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Navbar from "../../components/Navbar";
import CustomerProfile from "../../components/CustomerProfile";
import QuickBooksProfileConnection from "../../components/QuickBooksProfileConnection";
import BusinessManager from "../../components/BusinessManager";
import BillingPortalButton from "../../components/BillingPortalButton";
import { getAuthCookieNames, getSupabaseUser } from "../../lib/supabase-auth";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const { AUTH_COOKIE } = getAuthCookieNames();
  const accessToken = cookieStore.get(AUTH_COOKIE)?.value;

  if (!accessToken) {
    redirect("/login");
  }

  const user = await getSupabaseUser(accessToken);

  if (!user) {
    redirect("/api/auth/refresh?next=/profile");
  }

  const metadata = user.user_metadata || {};

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar loginHref="/api/auth/logout" loginLabel="Log Out" profileHref="/profile" sessionAware showMarketingLinks />
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Account settings</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Profile &amp; business information</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Keep your account and business information current. Company name is optional.
          </p>
        </div>

        <CustomerProfile
          email={user.email || ""}
          initialProfile={{
            companyName: metadata.companyName,
            industry: metadata.industry,
            companySize: metadata.companySize,
            contactName: metadata.contactName,
            contactPhone: metadata.contactPhone,
          }}
        />

        <QuickBooksProfileConnection />

        <BusinessManager />

        <section className="mb-7 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-base font-semibold text-slate-900">Billing</h2><p className="mt-1 text-sm leading-6 text-slate-500">View your plan, update your card, upgrade, downgrade, or cancel through Stripe.</p></div>
            <BillingPortalButton />
          </div>
        </section>

        <section className="mb-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Alerts &amp; reports</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">Manage your alert rules, delivery schedule, and weekly CFO report.</p>
            </div>
            <a href="/alerts" className="shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-400 hover:text-blue-700">
              Manage alerts
            </a>
          </div>
        </section>

        <section className="mb-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Password</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">Change your password anytime. We will email you a secure reset link.</p>
            </div>
            <a href="/forgot-password" className="shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-400 hover:text-blue-700">
              Change password
            </a>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Session</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">End your session on this device. You will need to log in again next visit.</p>
            </div>
            <a href="/api/auth/logout" className="shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-400 hover:text-blue-700">
              Log out
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
