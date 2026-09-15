import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Navbar from "../../components/Navbar";
import CFOBriefing from "../../components/CFOBriefing";
import AIAnalysisPanel from "../../components/AIAnalysisPanel";
import SetupGate from "../../components/SetupGate";
import QuickBooksSyncAction from "../../components/QuickBooksSyncAction";
import QuickBooksBriefingCache from "../../components/QuickBooksBriefingCache";
import TrendDetailOverlay from "../../components/TrendDetailOverlay";
import Footer from "../../components/Footer";
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
      <Navbar loginHref="/api/auth/logout" loginLabel="Log Out" profileHref="/profile" sessionAware />
      <SetupGate />
      <QuickBooksBriefingCache />
      <QuickBooksSyncAction />
      <div id="cfo-briefing">
        <CFOBriefing />
      </div>
      <AIAnalysisPanel />
      <TrendDetailOverlay enabled />
      <Footer />
    </main>
  );
}
