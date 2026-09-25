import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/lib/briefing/engine.ts", import.meta.url), "utf8");
const helper = source.match(/export function findPeriodHeaderIndex[\\s\\S]*?\\n}\\n/);

assert.ok(helper, "findPeriodHeaderIndex must exist");

const helperSource = helper[0];
assert.match(
  helperSource,
  /return findHeaderIndex\\(rows, \\[\\"Month\\", \\"Date\\", \\"Period\\", \\"Account\\", \\"Metric\\", \\"Customer\\", \\"Vendor\\", \\"Balance\\"]\\);/,
  "fallback must use the legacy header matcher",
);
assert.doesNotMatch(
  helperSource,
  /return findPeriodHeaderIndex\\(rows\\);/,
  "fallback must not recursively call findPeriodHeaderIndex",
);

console.log("PASS: Excel period header fallback uses legacy matcher");
