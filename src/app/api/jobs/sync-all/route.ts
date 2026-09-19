import { NextResponse } from "next/server";
import { evaluateAlerts, type AlertRule, type AlertSeverity } from "../../../../lib/alerts/engine";
import { buildAlertEmail } from "../../../../lib/alerts/templates";
import { sendEmail } from "../../../../lib/email";
import { authorizeCron } from "../../../../lib/jobs/auth";
import {
  getNotificationPreferences,
  listConnectedCompanies,
  listEnabledAlertRules,
  pauseBetweenCompanies,
  recentAlertHistory,
  recordAlert,
  resolveReportRecipient,
  syncCompanyBriefing,
} from "../../../../lib/jobs/company-sync";

export const runtime = "nodejs";

const severityRank: Record<AlertSeverity, number> = { high: 0, medium: 1, watch: 2 };

export async function POST(request: Request) {
  const unauthorized = authorizeCron(request);
  if (unauthorized) return unauthorized;

  const results: Array<{ companyId: string; synced: boolean; briefingPersisted: boolean; alertsSent: number; skipped: number; error?: string }> = [];
  let first = true;
  try {
    const companies = await listConnectedCompanies();
    for (const company of companies) {
      if (!first) await pauseBetweenCompanies();
      first = false;
      try {
        const preferences = await getNotificationPreferences(company.id);
        if (!preferences.auto_sync_enabled) {
          results.push({ companyId: company.id, synced: false, briefingPersisted: false, alertsSent: 0, skipped: 1 });
          continue;
        }

        const { briefing, briefingPersisted } = await syncCompanyBriefing(company.id);
        if (!preferences.alerts_enabled) {
          results.push({ companyId: company.id, synced: true, briefingPersisted, alertsSent: 0, skipped: 1 });
          continue;
        }

        const rows = await listEnabledAlertRules(company.id);
        const rules: AlertRule[] = rows.map((row: any) => ({
          id: String(row.id),
          metric: row.metric,
          operator: row.operator,
          value: Number(row.value),
          severity: row.severity,
          enabled: row.enabled === true,
        }));
        const alerts = evaluateAlerts(briefing, rules);
        const freshAlerts = [];
        let skipped = 0;
        for (const alert of alerts) {
          const dedupeKey = alert.ruleId.startsWith("builtin:") ? alert.ruleId : alert.key;
          const prior = await recentAlertHistory(company.id, dedupeKey);
          if (prior && severityRank[alert.severity] >= severityRank[prior.severity]) {
            skipped += 1;
            continue;
          }
          freshAlerts.push({ ...alert, key: dedupeKey });
        }

        if (!freshAlerts.length) {
          results.push({ companyId: company.id, synced: true, briefingPersisted, alertsSent: 0, skipped });
          continue;
        }

        const recipient = await resolveReportRecipient(company.id, preferences.report_recipient_email);
        const email = buildAlertEmail(company.name, freshAlerts);
        await sendEmail({ to: recipient, ...email });
        for (const alert of freshAlerts) await recordAlert(company.id, alert);
        results.push({ companyId: company.id, synced: true, briefingPersisted, alertsSent: freshAlerts.length, skipped });
      } catch (error) {
        console.error("[ClearCFO Jobs] Company sync failed:", company.id, error instanceof Error ? error.message : "Unknown error");
        results.push({ companyId: company.id, synced: false, briefingPersisted: false, alertsSent: 0, skipped: 0, error: error instanceof Error ? error.message : "Sync failed." });
      }
    }
    return NextResponse.json({ ok: true, companies: results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[ClearCFO Jobs] Sync-all failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ ok: false, companies: results, error: "Job failed." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
