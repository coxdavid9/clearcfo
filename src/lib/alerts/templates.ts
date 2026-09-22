import type { BriefingData, FinancialDriver } from "../briefing/engine";
import type { Alert } from "./engine";
import { escapeHtml, sanitizeHeader } from "../email-helpers";

export type EmailTemplate = { subject: string; text: string; html: string };

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function money(value: number | null | undefined): string {
  return Number.isFinite(value) ? usd.format(value as number) : "Unavailable";
}
function pct(value: number | null | undefined): string {
  return Number.isFinite(value) ? `${(value as number) >= 0 ? "+" : ""}${(value as number).toFixed(1)}%` : "Unavailable";
}
function points(value: number | null | undefined): string {
  return Number.isFinite(value) ? `${(value as number) >= 0 ? "+" : ""}${(value as number).toFixed(1)} pts` : "Unavailable";
}
function severityLabel(severity: Alert["severity"]): string {
  return severity === "high" ? "HIGH" : severity === "medium" ? "MEDIUM" : "WATCH";
}
function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://theclearcfo.com").trim().replace(/\/$/, "");
}
function footerText(companyName: string): string {
  return [
    "You're receiving this because email alerts are enabled for " + (companyName || "your business") + " in ClearCFO.",
    "Manage preferences: " + appUrl() + "/alerts",
    "Please don't reply to this email — this mailbox isn't monitored.",
  ].join("\n");
}
function footerHtml(companyName: string): string {
  return '<div style="padding:18px 0 30px;border-top:1px solid #e5e7eb;font-size:12px;color:#94a3b8">' +
    '<p style="margin:0 0 6px">You\'re receiving this because email alerts are enabled for ' + escapeHtml(companyName || "your business") + ' in ClearCFO.</p>' +
    '<p style="margin:0 0 6px"><a href="' + escapeHtml(appUrl() + "/alerts") + '" style="color:#2563eb">Manage preferences</a></p>' +
    '<p style="margin:0">Please don\'t reply to this email — this mailbox isn\'t monitored.</p></div></div>';
}
function shell(companyName: string, body: string): string {
  return '<div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;color:#17213a;line-height:1.6">' +
    '<div style="padding:28px 0 22px;border-bottom:1px solid #e5e7eb">' +
    '<img src="https://theclearcfo.com/logo.png" alt="ClearCFO" width="224" style="display:block;width:224px;max-width:100%;height:auto;border:0" />' +
    '<div style="font-size:13px;color:#6b7280;margin-top:8px">Financial clarity. Smarter decisions.</div></div>' +
    '<div style="padding:30px 0"><p style="margin:0 0 6px;font-size:13px;color:#64748b">' + escapeHtml(companyName) + '</p>' + body + '</div>' +
    footerHtml(companyName);
}
function alertCard(alert: Alert): string {
  const color = alert.severity === "high" ? "#b91c1c" : alert.severity === "medium" ? "#b45309" : "#475569";
  return '<div style="margin:0 0 14px;padding:18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px">' +
    '<div style="font-size:11px;font-weight:700;letter-spacing:.08em;color:' + color + '">' + severityLabel(alert.severity) + '</div>' +
    '<h3 style="margin:6px 0 8px;font-size:18px;line-height:1.35">' + escapeHtml(alert.title) + '</h3>' +
    '<p style="margin:0 0 10px;color:#475569">' + escapeHtml(alert.detail) + '</p>' +
    '<p style="margin:0;font-size:14px;font-weight:700">Estimated impact: ' + money(alert.estimatedImpact) + '</p></div>';
}
export function buildAlertEmail(companyName: string, alerts: Alert[], stillActive: Alert[] = []): EmailTemplate {
  const top = alerts[0];
  const safeCompany = sanitizeHeader(companyName || "Your business");
  const subject = '[ClearCFO] ' + (top?.title || "Financial alert") + ' — ' + safeCompany;
  const text = ['ClearCFO alerts — ' + (companyName || "Your business"), "",
    ...alerts.flatMap((alert) => [severityLabel(alert.severity) + ": " + alert.title, alert.detail, "Estimated impact: " + money(alert.estimatedImpact), ""]),
    ...(stillActive.length
      ? ["Still active (flagged in an earlier email — the condition hasn't cleared):",
        ...stillActive.map((alert) => "• " + severityLabel(alert.severity) + ": " + alert.title), ""]
      : []),
    "View your briefing: https://theclearcfo.com", "", footerText(companyName)].join("\n");
  const html = shell(safeCompany,
    '<h2 style="margin:0 0 10px;font-size:24px;line-height:1.3">Your ClearCFO alerts</h2>' +
    '<p style="margin:0 0 24px;color:#64748b">A few financial items deserve your attention.</p>' +
    alerts.map(alertCard).join("") +
    (stillActive.length
      ? '<div style="margin:0 0 14px;padding:14px 18px;background:#ffffff;border:1px dashed #cbd5e1;border-radius:12px">' +
        '<div style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#64748b">STILL ACTIVE</div>' +
        '<p style="margin:6px 0 0;color:#475569;font-size:14px">Flagged in an earlier email — the condition hasn\'t cleared:</p>' +
        '<ul style="margin:8px 0 0;padding-left:18px;color:#475569;font-size:14px">' +
        stillActive.map((alert) => '<li>' + escapeHtml(alert.title) + '</li>').join("") +
        '</ul></div>'
      : "") +
    '<a href="https://theclearcfo.com" style="display:inline-block;margin-top:8px;padding:12px 18px;border-radius:10px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700">View your briefing</a>');
  return { subject, text, html };
}

function driverText(driver: FinancialDriver): string {
  return "• " + driver.title + ": " + driver.observation;
}
export function buildWeeklyReportEmail(companyName: string, briefing: BriefingData): EmailTemplate {
  const safeCompany = sanitizeHeader(companyName || briefing.companyName || "Your business");
  const biggest = briefing.drivers?.[0];
  const risks = (briefing.drivers || []).filter((driver) => driver.severity === "High" && driver !== biggest).slice(0, 3);
  const opportunities = (briefing.drivers || []).filter((driver) =>
    (driver.category === "Revenue" || driver.category === "Margin") && driver.direction === "up").slice(0, 2);
  const relationships = (briefing.relationships || []).filter((item) => /up|grew|growth|improv|strong|positive/i.test(item)).slice(0, 2);
  const opportunityLines = opportunities.map(driverText).concat(relationships.map((item) => "• " + item)).slice(0, 2);
  const mtd = briefing.mtdComparison;
  const subject = "Your weekly CFO report — " + safeCompany;
  const textParts = [
    "Your weekly CFO report — " + (companyName || "Your business"), "",
    "SNAPSHOT",
    "Revenue: " + money(briefing.revenue) + " (" + pct(briefing.revenueChange) + " vs prior period)",
    "Gross margin: " + (Number.isFinite(briefing.grossMargin) ? briefing.grossMargin.toFixed(1) + "%" : "Unavailable") + " (" + points(briefing.marginChange) + " vs prior period)",
    "Cash: " + money(briefing.cash) + " (" + pct(briefing.cashChange) + " vs prior period)", "",
    "BIGGEST MOVER", biggest ? driverText(biggest) : "No material driver was identified.", "",
    "RISKS", risks.length ? risks.map(driverText).join("\n") : "No high-severity risks were identified.", "",
    "OPPORTUNITIES", opportunityLines.length ? opportunityLines.join("\n") : "No positive drivers were identified in the available data.", "",
    "RECOMMENDED ACTION", briefing.recommendation || "No recommendation was generated.",
    "Impact score: " + (Number.isFinite(briefing.impact) ? briefing.impact : "Unavailable")
  ];
  if (mtd) {
    textParts.push("", "MONTH-TO-DATE", mtd.currentLabel + " vs " + mtd.previousLabel,
      "Revenue: " + money(mtd.revenue.current) + " (" + pct(mtd.revenue.change) + ")",
      "Gross profit: " + money(mtd.grossProfit.current) + " (" + pct(mtd.grossProfit.change) + ")",
      "Operating expense: " + money(mtd.operatingExpense.current) + " (" + pct(mtd.operatingExpense.change) + ")",
      "Net income: " + money(mtd.netIncome.current) + " (" + pct(mtd.netIncome.change) + ")");
  }
  textParts.push("", "View your briefing: https://theclearcfo.com", "", footerText(companyName));
  const text = textParts.join("\n");
  const riskHtml = risks.length ? risks.map((driver) => "<li style=\"margin:0 0 8px\">" + escapeHtml(driverText(driver).slice(2)) + "</li>").join("") : "<li>No high-severity risks were identified.</li>";
  const opportunityHtml = opportunityLines.length ? opportunityLines.map((item) => "<li style=\"margin:0 0 8px\">" + escapeHtml(item.slice(2)) + "</li>").join("") : "<li>No positive drivers were identified in the available data.</li>";
  const mtdHtml = mtd ?
    '<div style="margin-top:24px;padding:18px;background:#f8fafc;border-radius:12px"><h3 style="margin:0 0 10px;font-size:17px">Month-to-date</h3>' +
    '<p style="margin:4px 0;color:#475569">' + escapeHtml(mtd.currentLabel) + " vs " + escapeHtml(mtd.previousLabel) + "</p>" +
    '<p style="margin:8px 0"><strong>Revenue:</strong> ' + money(mtd.revenue.current) + " (" + pct(mtd.revenue.change) + ")</p>" +
    '<p style="margin:8px 0"><strong>Gross profit:</strong> ' + money(mtd.grossProfit.current) + " (" + pct(mtd.grossProfit.change) + ")</p>" +
    '<p style="margin:8px 0"><strong>Operating expense:</strong> ' + money(mtd.operatingExpense.current) + " (" + pct(mtd.operatingExpense.change) + ")</p>" +
    '<p style="margin:8px 0"><strong>Net income:</strong> ' + money(mtd.netIncome.current) + " (" + pct(mtd.netIncome.change) + ")</p></div>" : "";
  const html = shell(safeCompany,
    '<h2 style="margin:0 0 8px;font-size:24px;line-height:1.3">Your weekly CFO report</h2>' +
    '<p style="margin:0 0 24px;color:#64748b">The key numbers and decisions to keep in view.</p>' +
    '<div style="padding:18px;background:#f8fafc;border-radius:12px"><h3 style="margin:0 0 12px;font-size:17px">Snapshot</h3>' +
    '<p style="margin:7px 0"><strong>Revenue:</strong> ' + money(briefing.revenue) + " (" + pct(briefing.revenueChange) + " vs prior period)</p>" +
    '<p style="margin:7px 0"><strong>Gross margin:</strong> ' + (Number.isFinite(briefing.grossMargin) ? briefing.grossMargin.toFixed(1) + "%" : "Unavailable") + " (" + points(briefing.marginChange) + " vs prior period)</p>" +
    '<p style="margin:7px 0"><strong>Cash:</strong> ' + money(briefing.cash) + " (" + pct(briefing.cashChange) + " vs prior period)</p></div>" +
    '<div style="margin-top:24px"><h3 style="margin:0 0 8px;font-size:17px">Biggest mover</h3><p style="margin:0;color:#475569">' + escapeHtml(biggest ? driverText(biggest).slice(2) : "No material driver was identified.") + "</p></div>" +
    '<div style="margin-top:24px"><h3 style="margin:0 0 8px;font-size:17px">Risks</h3><ul style="margin:0;padding-left:20px;color:#475569">' + riskHtml + "</ul></div>" +
    '<div style="margin-top:24px"><h3 style="margin:0 0 8px;font-size:17px">Opportunities</h3><ul style="margin:0;padding-left:20px;color:#475569">' + opportunityHtml + "</ul></div>" +
    '<div style="margin-top:24px;padding:18px;border:1px solid #dbeafe;border-radius:12px"><h3 style="margin:0 0 8px;font-size:17px">Recommended action</h3><p style="margin:0 0 8px;color:#475569">' +
    escapeHtml(briefing.recommendation || "No recommendation was generated.") + '</p><p style="margin:0;font-size:14px;font-weight:700">Impact score: ' +
    (Number.isFinite(briefing.impact) ? briefing.impact : "Unavailable") + '</p></div>' + mtdHtml +
    '<a href="https://theclearcfo.com" style="display:inline-block;margin-top:26px;padding:12px 18px;border-radius:10px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700">View your briefing</a>');
  return { subject, text, html };
}
