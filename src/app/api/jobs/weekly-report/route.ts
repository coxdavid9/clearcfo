import { NextResponse } from "next/server";
import { authorizeCron } from "../../../../lib/jobs/auth";
import { runWeeklyReportDelivery } from "../../../../lib/jobs/delivery";
import { getNotificationPreferences, listConnectedCompanies, pauseBetweenCompanies, chicagoWeekdayNumber } from "../../../../lib/jobs/company-sync";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const unauthorized = authorizeCron(request);
  if (unauthorized) return unauthorized;
  const results: Array<{ companyId: string; sent: boolean; skipped: boolean; briefingPersisted: boolean; error?: string }> = [];
  let first = true;
  try {
    const today = chicagoWeekdayNumber();
    const companies = await listConnectedCompanies();
    for (const company of companies) {
      if (!first) await pauseBetweenCompanies();
      first = false;
      try {
        const preferences = await getNotificationPreferences(company.id);
        if (!preferences.weekly_report_enabled || preferences.weekly_report_day !== today) {
          results.push({ companyId: company.id, sent: false, skipped: true, briefingPersisted: false });
          continue;
        }
        const result = await runWeeklyReportDelivery(company, preferences);
        results.push({ companyId: company.id, ...result });
      } catch (error) {
        console.error("[ClearCFO Jobs] Weekly report failed:", company.id, error instanceof Error ? error.message : "Unknown error");
        results.push({ companyId: company.id, sent: false, skipped: false, briefingPersisted: false, error: error instanceof Error ? error.message : "Weekly report failed." });
      }
    }
    return NextResponse.json({ ok: true, companies: results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[ClearCFO Jobs] Weekly report job failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ ok: false, companies: results, error: "Job failed." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}