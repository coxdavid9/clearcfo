import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Navbar from "../../components/Navbar";
import CFOBriefing from "../../components/CFOBriefing";
import TrendDetailOverlay from "../../components/TrendDetailOverlay";
import CustomerProfile from "../../components/CustomerProfile";
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

  const metadata = user.user_metadata || {};

  return (
    <main id="customer" className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar loginHref="/api/auth/logout" loginLabel="Log Out" />
      <div className="mx-auto max-w-7xl px-5 pt-6 sm:px-8">
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
      </div>
      <CFOBriefing />
      <TrendDetailOverlay enabled />
    </main>
  );
}
