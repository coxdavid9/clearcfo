import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Navbar from "../../components/Navbar";
import CFOBriefing from "../../components/CFOBriefing";
import QuickBooksConnection from "../../components/QuickBooksConnection";
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
      <Navbar loginHref="/api/auth/logout" loginLabel="Log Out" profileHref="/profile" />
      <QuickBooksConnection />
      <div id="cfo-briefing">
        <CFOBriefing />
      </div>
      <TrendDetailOverlay enabled />
    </main>
  );
}
