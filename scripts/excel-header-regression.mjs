import assert from "node:assert/strict";
import { findPeriodHeaderIndex } from "../src/lib/briefing/engine.ts";

const rows = [
  ["Account", "Jan 2026", "Feb 2026"],
  ["Revenue", 100, 110],
];

assert.equal(
  findPeriodHeaderIndex(rows),
  0,
  "fewer than 3 period-like cells must use the legacy header fallback",
);

console.log("PASS: Excel period header fallback");
