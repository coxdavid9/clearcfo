import {
  getConnectionForCompany,
  quickBooksReportForCompany,
} from "../quickbooks-company";
import { buildQuickBooksBriefing } from "../quickbooks-briefing";

function config() {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase server configuration is missing.");
  return { supabaseUrl, serviceRoleKey };
}

async function supabaseRequest(path: string, init: RequestInit = {}) {
  const { supabaseUrl, serviceRoleKey } = config();
  return fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function collectRows(node: any, output: any[] = []) {
  if (!node) return output;
  if (Array.isArray(node)) {
    for (const item of node) collectRows(item, output);
    return output;
  }
  if (typeof node !== "object") return output;
  if (node.ColData) output.push(node);
  if (node.Summary?.ColData) output.push(node);
  if (node.Rows) collectRows(node.Rows, output);
  if (Array.isArray(node.Row)) for (const row of node.Row) collectRows(row, output);
  return output;
}
function cellValue(cell: any) { return cell?.value ?? ""; }
function numericCells(row: any) {
  const cells = row?.ColData || row?.Summary?.ColData || [];
  return cells.slice(1).map((cell: any) => cellValue(cell));
}
function rowLabel(row: any) {
  const cells = row?.ColData || row?.Summary?.ColData || [];
  return String(cells?.[0]?.value || "").trim();
}
function summarizeReport(report: any) {
  const columns = report?.Columns?.Column || [];
  const rows = collectRows(report?.Rows);
  const labels = rows.map((row) => rowLabel(row)).filter(Boolean);
  return {
    header: report?.Header ? {
      startPeriod: report.Header.StartPeriod || null,
      endPeriod: report.Header.EndPeriod || null,
      time: report.Header.Time || null,
      reportName: report.Header.ReportName || null,
    } : null,
    columns: columns.map((column: any) => column?.ColTitle || ""),
    rows: rows.map((row) => ({
      label: rowLabel(row),
      group: String(row?.group || ""),
      type: String(row?.type || ""),
      values: numericCells(row),
    })).filter((row) => row.label),
    uniqueLabels: Array.from(new Set(labels)).slice(0, 100),
  };
}
function reportHasFinancialValues(report: any) {
  return collectRows(report?.Rows).some((row) => {
    const cells = row?.ColData || row?.Summary?.ColData || [];
    return cells.slice(1).some((cell: any) => {
      const value = Number(String(cell?.value ?? "").replace(/,/g, ""));
      return Number.isFinite(value) && value !== 0;
    });
  });
}

export async function syncCompanyBriefing(companyId: string) {
  const connection = await getConnectionForCompany(companyId);
  if (!connection) throw new Error("QuickBooks is not connected for this business.");

  const end = new Date();
  const start = new Date(end);
  start.setMonth(start.getMonth() - 11);
  start.setDate(1);
  const reportParams = { start_date: isoDate(start), end_date: isoDate(end), summarize_column_by: "Month" };

  const currentMonthStart = new Date(end.getFullYear(), end.getMonth(), 1);
  const prevMonthStart = new Date(end.getFullYear(), end.getMonth() - 1, 1);
  const prevMonthLength = new Date(end.getFullYear(), end.getMonth(), 0).getDate();
  const prevMonthEnd = new Date(end.getFullYear(), end.getMonth() - 1, Math.min(end.getDate(), prevMonthLength));

  const [pnl, balanceSheet] = await Promise.all([
    quickBooksReportForCompany(companyId, "ProfitAndLoss", reportParams),
    quickBooksReportForCompany(companyId, "BalanceSheet", reportParams),
  ]);

  const detailReportRequests = {
    profitAndLossDetail: quickBooksReportForCompany(companyId, "ProfitAndLossDetail", reportParams),
    incomeByCustomer: quickBooksReportForCompany(companyId, "IncomeByCustomerSummary", reportParams),
    expenseByVendor: quickBooksReportForCompany(companyId, "ExpenseByVendorSummary", reportParams),
    agedReceivables: quickBooksReportForCompany(companyId, "AgedReceivableDetail", { end_date: reportParams.end_date }),
    agedPayables: quickBooksReportForCompany(companyId, "AgedPayableDetail", { end_date: reportParams.end_date }),
    inventoryValuation: quickBooksReportForCompany(companyId, "InventoryValuationSummary", { end_date: reportParams.end_date }),
    mtdCurrent: quickBooksReportForCompany(companyId, "ProfitAndLoss", { start_date: isoDate(currentMonthStart), end_date: isoDate(end), summarize_column_by: "Days" }),
    mtdPrevious: quickBooksReportForCompany(companyId, "ProfitAndLoss", { start_date: isoDate(prevMonthStart), end_date: isoDate(prevMonthEnd), summarize_column_by: "Days" }),
  } as const;

  const detailEntries = await Promise.all(
    Object.entries(detailReportRequests).map(async ([name, request]) => {
      try {
        return [name, await request] as const;
      } catch (error) {
        console.warn(`[ClearCFO QuickBooks] Optional detail report skipped: ${name}`, error instanceof Error ? error.message : error);
        return [name, null] as const;
      }
    }),
  );
  const detailReports = Object.fromEntries(detailEntries);

  const diagnostics = {
    generatedAt: new Date().toISOString(),
    environment: process.env.QUICKBOOKS_ENVIRONMENT || "unknown",
    company: connection.company_name || null,
    companyId,
    realmId: connection.realm_id || null,
    requestedRange: reportParams,
    profitAndLoss: summarizeReport(pnl),
    balanceSheet: summarizeReport(balanceSheet),
  };
  console.info("[ClearCFO QuickBooks] Report diagnostics", diagnostics);

  if (!reportHasFinancialValues(pnl)) {
    throw new Error("QuickBooks is connected, but no financial activity was returned for the selected period.");
  }

  const briefing = buildQuickBooksBriefing(pnl, balanceSheet, connection.company_name || null, detailReports);
  const syncedAt = new Date().toISOString();
  let briefingPersisted = false;
  try {
    const persistResponse = await supabaseRequest("synced_briefings?on_conflict=company_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        company_id: companyId,
        briefing,
        synced_at: syncedAt,
      }),
    });
    if (!persistResponse.ok) {
      console.error("[ClearCFO Jobs] Briefing persistence failed:", companyId, persistResponse.status);
    } else {
      briefingPersisted = true;
    }
  } catch (error) {
    console.error(
      "[ClearCFO Jobs] Briefing persistence failed:",
      companyId,
      error instanceof Error ? error.message : "Unknown error",
    );
  }

  return {
    ok: true,
    syncedAt,
    source: "quickbooks" as const,
    companyId,
    briefingPersisted,
    periods: briefing.periods,
    trendSeries: briefing.trendSeries,
    briefing,
    diagnostics,
  };
}

export async function listConnectedCompanies(): Promise<Array<{ id: string; name: string }>> {
  const response = await supabaseRequest(
    "quickbooks_connections?select=company_id,company:companies(id,name)&order=company_id.asc",
  );
  if (!response.ok) throw new Error(`Could not list QuickBooks companies (${response.status}).`);
  const rows = await response.json() as Array<{ company_id: string; company: { id: string; name: string } | null }>;
  const seen = new Set<string>();
  return rows.flatMap((row) => {
    if (!row.company || seen.has(row.company_id)) return [];
    seen.add(row.company_id);
    return [{ id: row.company_id, name: row.company.name }];
  });
}

export type NotificationPreferences = {
  alerts_enabled: boolean;
  weekly_report_enabled: boolean;
  weekly_report_day: number;
  report_recipient_email: string | null;
  auto_sync_enabled: boolean;
  alert_delivery_time: string;
  weekly_report_time: string;
  timezone: string;
  last_alert_delivery_at: string | null;
  last_weekly_delivery_at: string | null;
};

export async function getNotificationPreferences(companyId: string): Promise<NotificationPreferences> {
  const response = await supabaseRequest(
    `notification_preferences?company_id=eq.${encodeURIComponent(companyId)}&select=alerts_enabled,weekly_report_enabled,weekly_report_day,report_recipient_email,auto_sync_enabled,alert_delivery_time,weekly_report_time,timezone,last_alert_delivery_at,last_weekly_delivery_at&limit=1`,
  );
  if (!response.ok) throw new Error(`Could not read notification preferences (${response.status}).`);
  const rows = await response.json() as Partial<NotificationPreferences>[];
  return {
    alerts_enabled: rows[0]?.alerts_enabled ?? true,
    weekly_report_enabled: rows[0]?.weekly_report_enabled ?? true,
    weekly_report_day: rows[0]?.weekly_report_day ?? 1,
    report_recipient_email: rows[0]?.report_recipient_email || null,
    auto_sync_enabled: rows[0]?.auto_sync_enabled ?? true,
    alert_delivery_time: rows[0]?.alert_delivery_time ?? "07:00",
    weekly_report_time: rows[0]?.weekly_report_time ?? "07:30",
    timezone: rows[0]?.timezone ?? "America/Chicago",
    last_alert_delivery_at: rows[0]?.last_alert_delivery_at ?? null,
    last_weekly_delivery_at: rows[0]?.last_weekly_delivery_at ?? null,
  };
}

export async function markAlertDelivery(companyId: string, deliveredAt = new Date().toISOString()) {
  const response = await supabaseRequest(`notification_preferences?company_id=eq.${encodeURIComponent(companyId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ last_alert_delivery_at: deliveredAt }) });
  if (!response.ok) throw new Error(`Could not record alert delivery (${response.status}).`);
}

export async function markWeeklyDelivery(companyId: string, deliveredAt = new Date().toISOString()) {
  const response = await supabaseRequest(`notification_preferences?company_id=eq.${encodeURIComponent(companyId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ last_weekly_delivery_at: deliveredAt }) });
  if (!response.ok) throw new Error(`Could not record weekly delivery (${response.status}).`);
}

export async function listEnabledAlertRules(companyId: string) {
  const response = await supabaseRequest(
    `alert_rules?company_id=eq.${encodeURIComponent(companyId)}&enabled=eq.true&select=id,metric,operator,value,severity,enabled&order=created_at.asc`,
  );
  if (!response.ok) throw new Error(`Could not read alert rules (${response.status}).`);
  return await response.json();
}

export async function resolveReportRecipient(companyId: string, configuredEmail: string | null) {
  if (configuredEmail) return configuredEmail;
  const ownerResponse = await supabaseRequest(
    `company_memberships?company_id=eq.${encodeURIComponent(companyId)}&role=eq.owner&select=user_id&limit=1`,
  );
  if (!ownerResponse.ok) throw new Error(`Could not resolve business owner (${ownerResponse.status}).`);
  const owners = await ownerResponse.json() as Array<{ user_id: string }>;
  const ownerId = owners[0]?.user_id;
  if (!ownerId) throw new Error("No business owner is configured.");
  const { supabaseUrl, serviceRoleKey } = config();
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(ownerId)}`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Could not resolve business owner email (${response.status}).`);
  const user = await response.json() as { email?: string | null };
  if (!user.email) throw new Error("Business owner does not have an email address.");
  return user.email;
}

export async function recentAlertHistory(companyId: string, alertKey: string) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const response = await supabaseRequest(
    `alert_history?company_id=eq.${encodeURIComponent(companyId)}&alert_key=eq.${encodeURIComponent(alertKey)}&sent_at=gte.${encodeURIComponent(since)}&select=severity,sent_at&order=sent_at.desc&limit=1`,
  );
  if (!response.ok) throw new Error(`Could not read alert history (${response.status}).`);
  const rows = await response.json() as Array<{ severity: "high" | "medium" | "watch"; sent_at: string }>;
  return rows[0] || null;
}

export async function recordAlert(companyId: string, alert: { key: string; ruleId: string; severity: "high" | "medium" | "watch"; title: string; detail: string; estimatedImpact: number }) {
  const response = await supabaseRequest("alert_history", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      company_id: companyId,
      alert_key: alert.key,
      rule_id: alert.ruleId,
      severity: alert.severity,
      title: alert.title,
      detail: alert.detail,
      estimated_impact: alert.estimatedImpact,
    }),
  });
  if (!response.ok) throw new Error(`Could not record alert history (${response.status}).`);
}

export async function pauseBetweenCompanies() {
  await new Promise((resolve) => setTimeout(resolve, 500));
}

export function chicagoWeekdayNumber(date = new Date()): number {
  const short = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/Chicago" }).format(date);
  return ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 } as Record<string, number>)[short] || 1;
}
