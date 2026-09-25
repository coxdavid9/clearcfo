import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/lib/briefing/engine.ts", import.meta.url), "utf8");
const start = source.indexOf("export function findPeriodHeaderIndex");
const end = source.indexOf("\n}\n", start);

assert.ok(start >= 0, "findPeriodHeaderIndex must exist");
assert.ok(end >= 0, "findPeriodHeaderIndex must have a closing brace");

const helperSource = source.slice(start, end + 3);
const fallback = 'return findHeaderIndex(rows, ["Month", "Date", "Period", "Account", "Metric", "Customer", "Vendor", "Balance"]);';

assert.ok(
  helperSource.includes(fallback),
  "fallback must use the legacy header matcher",
);
assert.ok(
  !helperSource.includes("return findPeriodHeaderIndex(rows);"),
  "fallback must not recursively call findPeriodHeaderIndex",
);

console.log("PASS: Excel period header fallback uses legacy matcher");
