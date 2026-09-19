import { evaluateAlerts, type AlertRule, type AlertSeverity } from "../alerts/engine";
import { buildAlertEmail, buildWeeklyReportEmail } from "../alerts/templates";
import { sendEmail } from "../email";
import { getNotificationPreferences, listEnabledAlertRules, recentAlertHistory, recordAlert, resolveReportRecipient, syncCompanyBriefing, type NotificationPreferences } from "./company-sync";

const severityRank: Record<AlertSeverity, number> = { high: 0, medium: 1, watch: 2 };
type Company = { id: string; name: string };

export async function runAlertDelivery(company: Company, preferences?: NotificationPreferences) {
  const prefs = preferences || await getNotificationPreferences(company.id);
  const { briefing, briefingPersisted } = await syncCompanyBriefing(company.id);
  if (!prefs.alerts_enabled) return { synced: true, briefingPersisted, alertsSent: 0, skipped: 1 };
  const rows = await listEnabledAlertRules(company.id);
  const rules: AlertRule[] = rows.map((row: any) => ({ id: String(row.id), metric: row.metric, operator: row.operator, value: Number(row.value), severity: row.severity, enabled: row.enabled === true }));
  const alerts = evaluateAlerts(briefing, rules);
  const freshAlerts = [];
  let skipped = 0;
  for (const alert of alerts) {
    const dedupeKey = alert.ruleId.startsWith("builtin:") ? alert.ruleId : alert.key;
    const prior = await recentAlertHistory(company.id, dedupeKey);
    if (prior && severityRank[alert.severity] >= severityRank[prior.severity]) { skipped += 1; continue; }
    freshAlerts.push({ ...alert, key: dedupeKey });
  }
  if (!freshAlerts.length) return { synced: true, briefingPersisted, alertsSent: 0, skipped };
  const recipient = await resolveReportRecipient(company.id, prefs.report_recipient_email);
  await sendEmail({ to: recipient, ...buildAlertEmail(company.name, freshAlerts) });
  for (const alert of freshAlerts) await recordAlert(company.id, alert);
  return { synced: true, briefingPersisted, alertsSent: freshAlerts.length, skipped };
}

export async function runWeeklyReportDelivery(company: Company, preferences?: NotificationPreferences) {
  const prefs = preferences || await getNotificationPreferences(company.id);
  const { briefing, briefingPersisted } = await syncCompanyBriefing(company.id);
  if (!prefs.weekly_report_enabled) return { sent: false, skipped: true, briefingPersisted };
  const recipient = await resolveReportRecipient(company.id, prefs.report_recipient_email);
  await sendEmail({ to: recipient, ...buildWeeklyReportEmail(company.name, briefing) });
  return { sent: true, skipped: false, briefingPersisted };
}
