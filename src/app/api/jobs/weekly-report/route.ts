import { NextResponse } from "next/server";
import { buildWeeklyReportEmail } from "../../../../lib/alerts/templates";
import { sendEmail } from "../../../../lib/email";
import { authorizeCron } from "../../../../lib/jobs/auth";
import {
  chicagoWeekdayNumber,
  getNotificationPreferences,
  listConnectedCompanies,
  pauseBetweenCompanies,
  resolveReportRecipient,
  syncCompanyBriefing,
} from "../../../../lib/jobs/company-sync";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const unauthorized = authorizeCron(request);
  if (unauthorized) return unauthorized;

  const results: Array<{ companyId: string; sent: boolean; skipped: boolean; error?: string }> = [];
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
          results.push({ companyId: company.id, sent: false, skipped: true });
          continue;
        }
        const { briefing } = await syncCompanyBriefing(company.id);
        const recipient = await resolveReportRecipient(company.id, preferences.report_recipient_email);
        const email = buildWeeklyReportEmail(company.name, briefing);
        await sendEmail({ to: recipient, ...email });
        results.push({ companyId: company.id, sent: true, skipped: false });
      } catch (error) {
        console.error("[ClearCFO Jobs] Weekly report failed:", company.id, error instanceof Error ? error.message : "Unknown error");
        results.push({ companyId: company.id, sent: false, skipped: false, error: error instanceof Error ? error.message : "Weekly report failed." });
      }
    }
    return NextResponse.json({ ok: true, companies: results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[ClearCFO Jobs] Weekly report job failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ ok: false, companies: results, error: "Job failed." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
