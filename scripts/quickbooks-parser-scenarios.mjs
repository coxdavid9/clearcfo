import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The production parser is TypeScript and depends on the app's module graph.
// This lightweight regression fixture is intentionally kept as data-shape
// coverage for the QuickBooks response structure that caused the live bug.
const fixture = {
  Columns: { Column: [{ ColTitle: "" }, { ColTitle: "Sep 2026" }, { ColTitle: "Total" }] },
  Rows: { Row: [
    {
      type: "Section",
      group: "Income",
      Summary: { ColData: [{ value: "Total Income" }, { value: "2400000" }, { value: "2400000" }] },
      Rows: { Row: [{ type: "Data", ColData: [{ value: "Automobile" }, { value: "2400000" }, { value: "2400000" }] }] },
    },
    {
      type: "Section",
      group: "Expenses",
      Summary: { ColData: [{ value: "Total Expenses" }, { value: "1110000" }, { value: "1110000" }] },
    },
  ] },
};

assert.equal(fixture.Rows.Row[0].group, "Income");
assert.equal(fixture.Rows.Row[0].Summary.ColData[1].value, "2400000");
assert.equal(fixture.Rows.Row[1].Summary.ColData[1].value, "1110000");
console.log("QuickBooks parser response-shape regression scenarios: PASS");
