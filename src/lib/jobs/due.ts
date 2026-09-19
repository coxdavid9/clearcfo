export type EmailSchedulePreferences = {
  alerts_enabled: boolean;
  weekly_report_enabled: boolean;
  weekly_report_day: number;
  alert_delivery_time: string;
  weekly_report_time: string;
  timezone: string;
  last_alert_delivery_at?: string | null;
  last_weekly_delivery_at?: string | null;
};

type LocalParts = { dateStr: string; weekday: number; minutes: number };
const weekdayNumbers: Record<string, number> = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7 };

function parseTime(value: string): number {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error("Invalid time: " + value);
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}
function localParts(date: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return { dateStr: values.year + "-" + values.month + "-" + values.day, weekday: weekdayNumbers[values.weekday] || 1, minutes: Number(values.hour) * 60 + Number(values.minute) };
}
function mondayStart(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00Z");
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - (day - 1));
  return date.toISOString().slice(0, 10);
}
function sentOnLocalDate(timestamp: string | null | undefined, timeZone: string, dateStr: string): boolean {
  if (!timestamp) return false;
  return localParts(new Date(timestamp), timeZone).dateStr === dateStr;
}
const DISPATCH_INTERVAL_MINUTES = 5;

function isWithinLookahead(localMinutes: number, targetMinutes: number): boolean {
  const lookaheadStart = Math.max(0, targetMinutes - DISPATCH_INTERVAL_MINUTES);
  return localMinutes >= lookaheadStart;
}

export function alertDue(nowUtc: Date, prefs: EmailSchedulePreferences): boolean {
  if (!prefs.alerts_enabled) return false;
  const local = localParts(nowUtc, prefs.timezone);
  if (!isWithinLookahead(local.minutes, parseTime(prefs.alert_delivery_time))) return false;
  return !sentOnLocalDate(prefs.last_alert_delivery_at, prefs.timezone, local.dateStr);
}
export function weeklyDue(nowUtc: Date, prefs: EmailSchedulePreferences): boolean {
  if (!prefs.weekly_report_enabled) return false;
  const local = localParts(nowUtc, prefs.timezone);
  if (local.weekday !== prefs.weekly_report_day) return false;
  if (!isWithinLookahead(local.minutes, parseTime(prefs.weekly_report_time))) return false;
  if (!prefs.last_weekly_delivery_at) return true;
  const sentLocalDate = localParts(new Date(prefs.last_weekly_delivery_at), prefs.timezone).dateStr;
  return sentLocalDate < mondayStart(local.dateStr);
}
