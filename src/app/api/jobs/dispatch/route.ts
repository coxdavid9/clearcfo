import { NextResponse } from "next/server";
import { alertDue, weeklyDue } from "../../../../lib/jobs/due";
import { authorizeCron } from "../../../../lib/jobs/auth";
import { runAlertDelivery, runWeeklyReportDelivery } from "../../../../lib/jobs/delivery";
import { getNotificationPreferences, listConnectedCompanies, markAlertDelivery, markWeeklyDelivery, pauseBetweenCompanies } from "../../../../lib/jobs/company-sync";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const unauthorized = authorizeCron(request);
  if (unauthorized) return unauthorized;
  const now = new Date();
  const dispatched: Array<{ company_id: string; alert_sent: boolean; weekly_sent: boolean; briefingPersisted: boolean; error?: string }> = [];
  let first = true;
  try {
    const companies = await listConnectedCompanies();
    for (const company of companies) {
      if (!first) await pauseBetweenCompanies();
      first = false;
      let briefingPersisted = false;
      let alertSent = false;
      let weeklySent = false;
      try {
        const preferences = await getNotificationPreferences(company.id);
        const shouldAlert = alertDue(now, preferences);
        const shouldWeekly = weeklyDue(now, preferences);

        if (shouldAlert && preferences.auto_sync_enabled) {
          const result = await runAlertDelivery(company, preferences);
          briefingPersisted = briefingPersisted || result.briefingPersisted;
          alertSent = result.alertsSent > 0;
          await markAlertDelivery(company.id, now.toISOString());
        }

        if (shouldWeekly) {
          const result = await runWeeklyReportDelivery(company, preferences);
          briefingPersisted = briefingPersisted || result.briefingPersisted;
          weeklySent = result.sent;
          await markWeeklyDelivery(company.id, now.toISOString());
        }

        dispatched.push({ company_id: company.id, alert_sent: alertSent, weekly_sent: weeklySent, briefingPersisted });
      } catch (error) {
        console.error("[ClearCFO Jobs] Dispatcher failed:", company.id, error instanceof Error ? error.message : "Unknown error");
        dispatched.push({ company_id: company.id, alert_sent: alertSent, weekly_sent: weeklySent, briefingPersisted, error: error instanceof Error ? error.message : "Dispatch failed." });
      }
    }
    return NextResponse.json({ ok: true, dispatched }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[ClearCFO Jobs] Dispatcher failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ ok: false, dispatched, error: "Job failed." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
