import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Navbar from "../../../components/Navbar";
import CFOAnalysisPage from "../../../components/CFOAnalysisPage";
import Footer from "../../../components/Footer";
import { getAuthCookieNames, getSupabaseUser } from "../../../lib/supabase-auth";
import { getSubscription, hasAccess } from "../../../lib/billing/entitlements";

export const dynamic = "force-dynamic";

export default async function CFOAnalysisRoute() {
  const cookieStore = await cookies();
  const { AUTH_COOKIE } = getAuthCookieNames();
  const accessToken = cookieStore.get(AUTH_COOKIE)?.value;

  if (!accessToken) redirect("/login");

  const user = await getSupabaseUser(accessToken);
  if (!user) redirect("/api/auth/refresh?next=/customer/analysis");

  const subscription = await getSubscription(user.id);
  const locked = !hasAccess(subscription);
  const lockReason = !subscription ? "never" : subscription.status === "canceled" ? "subscription_ended" : "trial_ended";
  const headline = lockReason === "never" ? "Choose a plan to continue." : lockReason === "subscription_ended" ? "Your subscription has ended." : "Your trial has ended.";
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar loginHref="/api/auth/logout" loginLabel="Log Out" profileHref="/profile" sessionAware />
      {locked ? (
        <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
          <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">ClearCFO</p>
            <h1 className="mt-3 text-2xl font-bold text-slate-900">{headline}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">Your data is safe — subscribe to continue.</p>
            <a href="/customer/briefing" className="mt-6 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">Subscribe to continue</a>
          </section>
        </div>
      ) : <CFOAnalysisPage />}
      <Footer tagline="Financial clarity. Smarter decisions." />
    </main>
  );
}
