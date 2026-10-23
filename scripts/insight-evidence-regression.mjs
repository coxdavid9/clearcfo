import assert from "node:assert/strict";
import fs from "node:fs/promises";
import ts from "typescript";
import XLSX from "xlsx";

globalThis.__insightXlsx = XLSX;
const dataUrl = source => "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const read = file => fs.readFile(new URL(file, import.meta.url), "utf8");
const policyUrl = dataUrl(compile(await read("../src/lib/briefing/evidence-policy.ts")));
const scenarioUrl = dataUrl(compile(await read("../src/lib/scenario-detection.ts")));
const { applyEvidencePolicy, operatingLossDriver } = await import(policyUrl);
const engineJs = compile(await read("../src/lib/briefing/engine.ts"))
  .replace('import * as XLSX from "xlsx";', 'const XLSX = globalThis.__insightXlsx;')
  .replace('from "./evidence-policy"', `from "${policyUrl}"`)
  .replace('from "../../lib/scenario-detection"', `from "${scenarioUrl}"`);
const engineUrl = dataUrl(engineJs);
const { analyzeWorkbook, buildDeterministicExecutiveSummary } = await import(engineUrl);
const book = rows => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "P&L");
  return workbook;
};
const baseRows = [
  ["Account", "Jul-26", "Aug-26"],
  ["Revenue", 1264597.215762794, 1323658.157000458],
  ["COGS", 845587.7678208107, 901448.3143268909],
  ["Gross Profit", 419009.4479419829, 422209.842673567],
  ["Total Operating Expenses", 547906.2722292775, 546585.3960791454],
];
const workbook = book([...baseRows, ["Operating Income", -128896.8242872946, -124375.5534055784]]);
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
  ["Metric", "Jul-26", "Aug-26"],
  ["Ending Inventory Value", 921165796.4257213, 1199495111.995949],
]), "Inventory_Summary");
const briefing = analyzeWorkbook(workbook);
assert.equal(briefing.operatingIncome, -124375.5534055784);
assert.ok(briefing.drivers.some(driver => driver.id === "operating-loss" && driver.severity === "High"));
assert.ok(briefing.drivers.some(driver => driver.id === "inventory-growth"));
assert.match(buildDeterministicExecutiveSummary(briefing), /operating loss of \$124,376/);
assert.equal(briefing.dataAvailability.cash, false);
const derived = analyzeWorkbook(book(baseRows));
assert.ok(Math.abs(derived.operatingIncome + 124375.5534055784) < 1e-6);
for (const reported of [0, 10000, -1]) {
  const result = analyzeWorkbook(book([...baseRows, ["Operating Income", -50000, reported]]));
  assert.equal(result.operatingIncome, reported);
  assert.equal(result.drivers.some(driver => driver.id === "operating-loss"), reported < 0);
}
const parentheses = analyzeWorkbook(book([...baseRows, ["Operating Income", 0, "($124,375.55)"]]));
assert.equal(parentheses.operatingIncome, -124375.55);
for (const missing of [null, "", "n/a"]) {
  const blankReported = analyzeWorkbook(book([...baseRows, ["Operating Income", -50000, missing]]));
  assert.equal(blankReported.operatingIncome, undefined, "Do not substitute an earlier result for a missing latest cell");
}
for (const rows of [baseRows.filter(row => !/Expenses/.test(row[0])), baseRows.filter(row => !/Gross Profit|COGS/.test(row[0]))]) {
  const missing = analyzeWorkbook(book(rows));
  assert.equal(missing.operatingIncome, undefined);
  assert.ok(!missing.drivers.some(driver => driver.id === "operating-loss"));
}
assert.equal(operatingLossDriver(null, 100), null);
assert.equal(operatingLossDriver(NaN, 100), null);
assert.ok(!operatingLossDriver(-100, 0).observation.includes("Infinity"));
const body = { financialSnapshot: briefing, financialDrivers: briefing.drivers };
const generated = {
  executiveSummary: "Identified slow-moving SKUs require immediate discounting.",
  evidence: ["Slow movement is proven"], unknowns: [],
  recommendedAction: "Pause purchases immediately", managementQuestion: "Why are SKUs slow?",
  actions: [
    { title: "Pause purchasing for identified slow-moving SKUs", rationale: "Inventory growth proves excess stock", priority: "High", estimatedImpact: 278329316 },
    { title: "Review inventory aging", rationale: "Recover the entire inventory increase", priority: "High", estimatedImpact: 278329316 },
    { title: "Review margin", rationale: "Investigate pricing and direct cost", priority: "Medium", estimatedImpact: 50000 },
  ],
};
const guarded = applyEvidencePolicy(generated, body);
assert.match(guarded.executiveSummary, /operating loss of \$124,376/);
assert.ok(!guarded.executiveSummary.includes("Identified slow-moving"));
assert.ok(guarded.actions.some(action => /operating loss/.test(action.title)));
assert.equal(guarded.actions.filter(action => /inventory/.test(action.title)).length, 1);
assert.ok(guarded.actions.every(action => action.estimatedImpact === null));
assert.ok(!guarded.actions.some(action => /Pause|identified slow-moving|Recover the entire/.test(action.title + action.rationale)));
assert.match(guarded.recommendedAction, /^1\. .*break-even\.\n2\. .*before changing purchases\.$/);
assert.ok(guarded.recommendedAction.length < 220);
assert.ok(!guarded.recommendedAction.includes("$"));
assert.ok(guarded.actions.every(action => !action.rationale.includes("278,329,316")));
assert.match(guarded.executiveSummary, /278,329,316/);
assert.ok(!guarded.whyItMatters.includes("$"));
const healthy = applyEvidencePolicy({ actions: [] }, { financialSnapshot: { operatingIncome: 0, revenue: 100 } });
assert.equal(healthy.actions.length, 0);

// Exercise the QuickBooks builder too, using the same reported costs.
const constraintsUrl = dataUrl(compile(await read("../src/lib/briefing/emerging-constraints.ts")));
const qbJs = compile(await read("../src/lib/quickbooks-briefing.ts"))
  .replace('from "./briefing/engine"', `from "${engineUrl}"`)
  .replace('from "./briefing/evidence-policy"', `from "${policyUrl}"`)
  .replace('from "./briefing/emerging-constraints"', `from "${constraintsUrl}"`);
const { buildQuickBooksBriefing } = await import(dataUrl(qbJs));
const qbReport = rows => ({
  Columns: { Column: [{ ColTitle: "Account" }, { ColTitle: "Jul 2026" }, { ColTitle: "Aug 2026" }] },
  Rows: { Row: rows.map(([label, previous, current]) => ({ type: "Data", ColData: [{ value: label }, { value: String(previous) }, { value: String(current) }] })) },
});
const qb = buildQuickBooksBriefing(qbReport(baseRows.slice(1).map(row => [row[0] === "COGS" ? "Cost of Goods Sold" : row[0] === "Revenue" ? "Total Revenue" : row[0], ...row.slice(1)])), qbReport([]), "Fixture");
assert.ok(Math.abs(qb.operatingIncome + 124375.5534055784) < 1e-6);
assert.ok(qb.drivers.some(driver => driver.id === "operating-loss"));

// Execute the real HTTP route with a deliberately unsafe model response.
let sentInstructions;
const doubles = {
  applyEvidencePolicy,
  NextResponse: { json: (body, init) => Response.json(body, init) },
  aiRateLimit: {}, checkRateLimit: () => null,
  detectExpenseSpikeRecovery: (await import(scenarioUrl)).detectExpenseSpikeRecovery,
  inventoryOutpacesRevenue: (await import(scenarioUrl)).inventoryOutpacesRevenue,
  getSubscription: async () => ({ plan: "pro" }), hasAccess: () => true,
  requireBillingUser: async () => "test-user",
  getActiveCompany: async () => ({ id: "test-company" }),
  resolveVerifiedAnalysisCompanyId: (activeId, requestedId) => !activeId || (requestedId != null && requestedId !== "" && requestedId !== activeId) ? null : activeId,
};
globalThis.__insightRoute = doubles;
const routeSource = (await read("../src/app/api/cfo-analysis/route.ts"))
  .replace(/^import .*;$/gm, "")
  .replace('await import("../../../lib/billing/entitlements")', 'globalThis.__insightRoute')
  .replace('await import("../../../lib/company")', 'globalThis.__insightRoute')
  .replace('await import("../../../lib/analysis-company-authz")', 'globalThis.__insightRoute');
const route = await import(dataUrl(compile(`const {${Object.keys(doubles).join(",")}} = globalThis.__insightRoute;\n` + routeSource)));
const originalFetch = globalThis.fetch;
const originalKey = process.env.OPENAI_API_KEY;
const originalSupabaseUrl = process.env.SUPABASE_URL;
delete process.env.SUPABASE_URL;
process.env.OPENAI_API_KEY = "test-only";
globalThis.fetch = async (_url, init) => {
  sentInstructions = JSON.parse(init.body).instructions;
  return Response.json({ output_text: JSON.stringify(generated) });
};
try {
  const foreign = await route.POST(new Request("https://theclearcfo.com/api/cfo-analysis", {
    method: "POST", body: JSON.stringify({ ...body, companyId: "another-customer-business" }),
  }));
  assert.equal(foreign.status, 403);
  assert.equal(sentInstructions, undefined, "Denied company must not reach the AI provider");
  const response = await route.POST(new Request("https://theclearcfo.com/api/cfo-analysis", { method: "POST", body: JSON.stringify(body) }));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.ok(payload.analysis.actions.every(action => action.estimatedImpact === null));
  assert.match(payload.analysis.executiveSummary, /operating loss/);
  assert.match(sentInstructions, /estimatedImpact as null/);
  assert.match(sentInstructions, /Never call SKUs identified slow-moving/);
} finally {
  globalThis.fetch = originalFetch;
  if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalSupabaseUrl;
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey;
}
console.log("PASS: Actual Excel parser and AI route retain losses, reject unsupported savings and SKU claims, and preserve missing-data boundaries.");

if (process.env.INSIGHT_TEST_WORKBOOK) {
  const actual = analyzeWorkbook(XLSX.read(await fs.readFile(process.env.INSIGHT_TEST_WORKBOOK), { type: "buffer" }));
  assert.equal(actual.revenue, 1323658.157000458);
  assert.equal(actual.inventory, 1199495111.995949);
  assert.equal(actual.operatingIncome, -124375.5534055784);
  assert.match(buildDeterministicExecutiveSummary(actual), /operating loss of \$124,376/);
  console.log("PASS: Full uploaded 32-month, 240-SKU workbook produces the expected operating-loss signal.");
}
