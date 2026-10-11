import assert from "node:assert/strict";
import { isExcelCacheUsable, isAnalysisInputUsable, isQuickBooksCacheUsable, saveExcelBriefingCache, saveAnalysisInput, saveQuickBooksBriefingCache } from "../src/lib/company-scoped-cache.ts";

const values = new Map();
globalThis.window = { localStorage: { getItem: key => values.get(key) ?? null, setItem: (key,value) => values.set(key,value), removeItem: key => values.delete(key) } };
const oldData = { companyName: "Old account", revenue: 12345, alerts: [] };
values.set("clearcfo_excel_briefing", JSON.stringify(oldData));
values.set("clearcfo_excel_uploaded_at", "2026-09-27");
assert.equal(isExcelCacheUsable("new-business"), false);
assert.equal(values.has("clearcfo_excel_briefing"), false);
assert.equal(values.has("clearcfo_excel_uploaded_at"), false);
console.log("PASS: fresh account rejects and evicts unlabeled legacy Excel data");

saveExcelBriefingCache(oldData, "2026-10-11", "business-a");
assert.equal(isExcelCacheUsable("business-a"), true);
assert.equal(isExcelCacheUsable("business-b"), false);
assert.equal(values.has("clearcfo_excel_briefing"), false);
saveExcelBriefingCache(oldData, "2026-10-11", "business-a");
assert.equal(isExcelCacheUsable(null), false);
console.log("PASS: Excel survives same-business reload; switches and unknown identity reject it");

values.set("clearcfo_analysis_input", JSON.stringify(oldData));
assert.equal(isAnalysisInputUsable("new-business"), false);
saveAnalysisInput(oldData, "business-a");
assert.equal(isAnalysisInputUsable("business-a"), true);
values.set("clearcfo_ai_analysis_cache_v3", "old AI answer");
assert.equal(isAnalysisInputUsable("business-b"), false);
assert.equal(values.has("clearcfo_analysis_input"), false);
assert.equal(values.has("clearcfo_ai_analysis_cache_v3"), false);
console.log("PASS: analysis input and AI answers cannot cross business boundaries");

saveQuickBooksBriefingCache(oldData, "business-a");
assert.equal(isQuickBooksCacheUsable("business-a"), true);
assert.equal(isQuickBooksCacheUsable(null), false);
assert.equal(isQuickBooksCacheUsable("business-b"), false);
console.log("PASS: QuickBooks fallback requires a verified matching business");
