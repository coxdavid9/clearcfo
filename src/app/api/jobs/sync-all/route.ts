import { NextResponse } from "next/server";
import { authorizeCron } from "../../../../lib/jobs/auth";
import { runAlertDelivery } from "../../../../lib/jobs/delivery";
import { getNotificationPreferences, listConnectedCompanies, pauseBetweenCompanies } from "../../../../lib/jobs/company-sync";

export const runtime = "nodejs";

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
        const result = await runAlertDelivery(company, preferences);
        results.push({ companyId: company.id, ...result });
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