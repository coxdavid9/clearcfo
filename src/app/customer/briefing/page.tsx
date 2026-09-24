import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Navbar from "../../../components/Navbar";
import CFOBriefing from "../../../components/CFOBriefing";
import QuickBooksSyncAction from "../../../components/QuickBooksSyncAction";
import QuickBooksBriefingCache from "../../../components/QuickBooksBriefingCache";
import QuickBooksDiagnostics from "../../../components/QuickBooksDiagnostics";
import Footer from "../../../components/Footer";
import { getAuthCookieNames, getSupabaseUser } from "../../../lib/supabase-auth";

export const dynamic = "force-dynamic";

export default async function CFOBriefingPage() {
  const cookieStore = await cookies();
  const { AUTH_COOKIE } = getAuthCookieNames();
  const accessToken = cookieStore.get(AUTH_COOKIE)?.value;

  if (!accessToken) redirect("/login");

  const user = await getSupabaseUser(accessToken);
  if (!user) redirect("/api/auth/refresh?next=/customer/briefing");

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar loginHref="/api/auth/logout" loginLabel="Log Out" profileHref="/profile" sessionAware showMarketingLinks />
      <QuickBooksBriefingCache />
      <QuickBooksSyncAction />
      <CFOBriefing />
      <QuickBooksDiagnostics />
      <Footer />
    </main>
  );
}
