import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Navbar from "../../components/Navbar";
import CFOBriefing from "../../components/CFOBriefing";
import TrendDetailOverlay from "../../components/TrendDetailOverlay";
import { getAuthCookieNames, getSupabaseUser } from "../../lib/supabase-auth";

export const dynamic = "force-dynamic";

export default async function CustomerPage() {
  const cookieStore = await cookies();
  const { AUTH_COOKIE } = getAuthCookieNames();
  const accessToken = cookieStore.get(AUTH_COOKIE)?.value;

  if (!accessToken) {
    redirect("/login");
  }

  const user = await getSupabaseUser(accessToken);

  if (!user) {
    redirect("/api/auth/refresh?next=/customer");
  }

  return (
    <main id="customer" className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar onLogin={() => { window.location.href = "/api/auth/logout"; }} loginLabel="Log Out" />
      <div className="mx-auto max-w-7xl px-5 pt-6 sm:px-8">
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
          <span className="text-slate-500">Signed in as <strong className="text-slate-700">{user.email}</strong></span>
          <a href="/api/auth/logout" className="font-semibold text-blue-600 hover:text-blue-700">Log out</a>
        </div>
      </div>
      <CFOBriefing />
      <TrendDetailOverlay enabled />
    </main>
  );
}
