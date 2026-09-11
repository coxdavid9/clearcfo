import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Navbar from "../../components/Navbar";
import CustomerProfile from "../../components/CustomerProfile";
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
      <Navbar loginHref="/api/auth/logout" loginLabel="Log Out" profileHref="/profile" />
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Account settings</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Profile &amp; business information</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Keep your company information current. ClearCFO will use this context to personalize your financial intelligence experience.
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

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-base font-semibold text-slate-900">Account security</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">Your ClearCFO login email is managed by the authentication provider. Passwords are never stored by the ClearCFO application.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href="/customer" className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-blue-400 hover:text-blue-700">Back to CFO briefing</a>
            <a href="/api/auth/logout" className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Log out</a>
          </div>
        </div>
      </div>
    </main>
  );
}
