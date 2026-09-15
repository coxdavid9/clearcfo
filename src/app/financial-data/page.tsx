import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Navbar from "../../components/Navbar";
import QuickBooksConnection from "../../components/QuickBooksConnection";
import { getAuthCookieNames, getSupabaseUser } from "../../lib/supabase-auth";

export const dynamic = "force-dynamic";

export default async function FinancialDataPage() {
  const cookieStore = await cookies();
  const { AUTH_COOKIE } = getAuthCookieNames();
  const accessToken = cookieStore.get(AUTH_COOKIE)?.value;

  if (!accessToken) redirect("/login");

  const user = await getSupabaseUser(accessToken);
  if (!user) redirect("/api/auth/refresh?next=/financial-data");

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar loginHref="/api/auth/logout" loginLabel="Log Out" profileHref="/profile" sessionAware />
      <div className="mx-auto max-w-7xl py-8 sm:py-10">
        <div className="px-5 sm:px-8 lg:px-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Financial data</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Manage your financial data</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Connect QuickBooks for automatic updates or upload an Excel workbook when you want to provide the data yourself.
          </p>
        </div>
        <QuickBooksConnection setupComplete />
      </div>
    </main>
  );
}
