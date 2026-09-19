import { alertDue, weeklyDue } from "../src/lib/jobs/due.ts";
import { isValidScheduleTime, isValidTimezone } from "../src/lib/jobs/schedule-validation.ts";
const base = { alerts_enabled: true, weekly_report_enabled: true, weekly_report_day: 1, alert_delivery_time: "07:00", weekly_report_time: "07:30", timezone: "America/Chicago", last_alert_delivery_at: null, last_weekly_delivery_at: null };
const scenarios = [
  ["alert before time is not due", !alertDue(new Date("2026-09-19T11:59:00Z"), base)],
  ["alert after time is due", alertDue(new Date("2026-09-19T12:00:00Z"), base)],
  ["alert is not due twice on same local day", !alertDue(new Date("2026-09-19T13:00:00Z"), { ...base, last_alert_delivery_at: "2026-09-19T12:00:00Z" })],
  ["weekly only due on configured weekday", !weeklyDue(new Date("2026-09-22T12:00:00Z"), base)],
  ["weekly is due on configured weekday after time", weeklyDue(new Date("2026-09-21T13:00:00Z"), base)],
  ["weekly is not due twice in same local week", !weeklyDue(new Date("2026-09-21T14:00:00Z"), { ...base, last_weekly_delivery_at: "2026-09-21T13:00:00Z" })],
  ["Chicago daylight time in September", alertDue(new Date("2026-09-19T12:00:00Z"), base)],
  ["Chicago standard time in January", alertDue(new Date("2026-01-19T12:00:00Z"), { ...base, alert_delivery_time: "06:00" })],
  ["invalid timezone rejected", !isValidTimezone("Not/AZone")],
  ["bad time rejected", !isValidScheduleTime("25:61")],
  ["valid timezone accepted", isValidTimezone("America/Chicago")],
  ["valid time accepted", isValidScheduleTime("07:30")],
];
let failures = 0;
for (const [name, ok] of scenarios) { if (ok) console.log("PASS: " + name); else { failures++; console.error("FAIL: " + name); } }
if (failures) process.exit(1);
console.log("All " + scenarios.length + " due scenarios passed.");
