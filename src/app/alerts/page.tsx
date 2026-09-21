import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Navbar from "../../components/Navbar";
import AlertsSettings from "../../components/AlertsSettings";
import { getAuthCookieNames, getSupabaseUser } from "../../lib/supabase-auth";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const cookieStore = await cookies();
  const { AUTH_COOKIE } = getAuthCookieNames();
  const accessToken = cookieStore.get(AUTH_COOKIE)?.value;
  if (!accessToken) redirect("/login");
  const user = await getSupabaseUser(accessToken);
  if (!user) redirect("/api/auth/refresh?next=/alerts");

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar loginHref="/api/auth/logout" loginLabel="Log Out" profileHref="/profile" sessionAware showMarketingLinks />
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Account settings</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Alerts &amp; reports</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Control proactive alerts, weekly reporting, automatic syncing, and your custom thresholds.</p>
        </div>
        <AlertsSettings />
      </div>
    </main>
  );
}
