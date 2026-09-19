export const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
export function isValidScheduleTime(value: unknown): value is string { return typeof value === "string" && TIME_RE.test(value); }
export function isValidTimezone(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 1 || value.length > 100) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }).format(); return true; } catch { return false; }
}
