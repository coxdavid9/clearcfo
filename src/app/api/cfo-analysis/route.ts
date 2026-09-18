import { NextResponse } from "next/server";
import { aiRateLimit, checkRateLimit } from "../../../lib/rate-limit";
import { detectExpenseSpikeRecovery, inventoryOutpacesRevenue } from "../../../lib/scenario-detection";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 250 * 1024;

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    executiveSummary: { type: "string" },
    primaryDriver: { type: "string" },
    whyItMatters: { type: "string" },
    managementQuestion: { type: "string" },
    recommendedAction: { type: "string" },
    priority: { type: "string", enum: ["High", "Medium", "Watch"] },
    confidence: { type: "number" },
    evidence: { type: "array", items: { type: "string" } },
    unknowns: { type: "array", items: { type: "string" } },
    actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          rationale: { type: "string" },
          priority: { type: "string", enum: ["High", "Medium", "Watch"] },
          score: { type: "number" },
          estimatedImpact: { type: "number" },
        },
        required: ["title", "rationale", "priority", "score"],
      },
    },
  },
  required: ["executiveSummary", "primaryDriver", "whyItMatters", "managementQuestion", "recommendedAction", "priority", "confidence", "evidence", "unknowns", "actions"],
};

const instructions = [
  "You are ClearCFO, a conservative CFO-level financial intelligence system for small and growing businesses.",
  "Analyze only the supplied financial facts. Never invent a number, transaction, account, cause, trend, customer, vendor, forecast, or business fact.",
  "Separate observed facts from interpretation and recommended management action. If the data cannot prove a cause, describe it as an investigation area rather than fact.",
  "Use financialDrivers as the primary evidence hierarchy, detailDrivers as the account-level layer, and multiPeriodInsights and trendSeries as historical-pattern evidence.",
  "Name the strongest supported financial driver first and include 2 to 4 concrete evidence points directly supported by the supplied facts.",
  "Distinguish persistent patterns from one-period variances. Do not treat a trend as proof of causation.",
  "When a prior-period value is zero or unusually small, do not use the resulting percentage change as the main measure of importance. State the dollar movement and the starting/ending values instead; a very large percentage from a small baseline is not by itself evidence of a major business risk.",
  "For COGS, expenses, revenue, cash, or inventory that move from $0 to a positive amount, treat the change as a baseline/data-completeness question. Do not say the change explains a margin or cash outcome unless the supplied data establishes that relationship.",
  "Use calibrated language such as suggests, is consistent with, may contribute to, or warrants investigation.",
  "Recommendations must remain within the evidence. Do not invent numerical targets, arbitrary deadlines, guaranteed savings, or specific operational mandates.",
  "If inventory is rising relative to revenue and detailed SKU or aging information is unavailable, recommend reviewing inventory aging, purchasing cadence, demand support, and slow-moving stock.",
  "If operating expenses spike and subsequently recover, identify that spike/recovery pattern separately from any revenue movement and investigate whether the expense was truly non-recurring.",
  "Return 1 to 4 practical management actions and 0 to 4 material unknowns. Every action should relate to supplied financial evidence.",
  "When financialRatios, monthToDate, varianceMovers, or cashFlowBridge are supplied, use them as evidence: name weak ratios, day-matched month-to-date movements, the largest account/customer/vendor movers, and the cash-flow bridge lines where they support the analysis.",
  "For each action, include estimatedImpact as a dollar estimate of the amount at stake when the supplied evidence supports one; omit it when it cannot be estimated from the evidence. Never invent the estimate.",
  "Return only the requested structured analysis.",
].join(" ");

type FinancialDriverInput = { id?: unknown; title?: unknown; observation?: unknown; evidence?: unknown; severity?: unknown };
type TrendSeries = { name?: unknown; values?: unknown; periods?: unknown };
type ScenarioSignals = {
  inventoryBuildup: FinancialDriverInput | null;
  expenseSpikeRecovery: FinancialDriverInput | null;
  revenueVolatility: { min: number; max: number; range: number; maxMinRatio: number; periods: number } | null;
};

function asFiniteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function asTrendSeries(body: Record<string, unknown>): { name: string; values: number[]; periods: string[] }[] {
  const raw = Array.isArray(body.trendSeries) ? body.trendSeries : [];
  return raw
    .filter((item): item is TrendSeries => !!item && typeof item === "object")
    .map((item) => ({
      name: String(item.name ?? ""),
      values: Array.isArray(item.values) ? item.values.map(asFiniteNumber).filter((value): value is number => value !== null) : [],
      periods: Array.isArray(item.periods) ? item.periods.map(String) : [],
    }))
    .filter((series) => series.name && series.values.length >= 3);
}

function makeDriver(input: { id: string; title: string; observation: string; evidence: string[] }): FinancialDriverInput {
  return input;
}

function deriveScenarioSignals(body: Record<string, unknown>): ScenarioSignals {
  const drivers = Array.isArray(body.financialDrivers)
    ? body.financialDrivers.filter((item): item is FinancialDriverInput => !!item && typeof item === "object")
    : [];
  const series = asTrendSeries(body);
  const revenueSeries = series.find((item) => /revenue/i.test(item.name));
  const inventorySeries = series.find((item) => /inventory/i.test(item.name));
  const expenseSeries = series.find((item) => /operating expense|opex/i.test(item.name));

  let inventoryBuildup = drivers.find((driver) => driver.id === "inventory-growth" || /inventory.*outpacing|inventory.*growth/i.test(String(driver.title ?? ""))) ?? null;
  if (!inventoryBuildup && inventorySeries && revenueSeries) {
    const outpacing = inventoryOutpacesRevenue(inventorySeries.values, revenueSeries.values);
    if (outpacing) {
      const { invGrowth, revGrowth } = outpacing;
      inventoryBuildup = makeDriver({
        id: "historical-inventory-buildup",
        title: "Inventory is building faster than revenue",
        observation: `Inventory increased ${invGrowth.toFixed(1)}% across the displayed periods while revenue increased ${revGrowth.toFixed(1)}%.`,
        evidence: [`Inventory growth across displayed periods: ${invGrowth.toFixed(1)}%`, `Revenue growth across displayed periods: ${revGrowth.toFixed(1)}%`, `Inventory outpaced revenue by ${(invGrowth - revGrowth).toFixed(1)} points`],
      });
    }
  }

  let expenseSpikeRecovery = drivers.find((driver) => driver.id === "historical-opex-spike" || /operating expense spike/i.test(String(driver.title ?? ""))) ?? null;
  if (!expenseSpikeRecovery && expenseSeries) {
    const detection = detectExpenseSpikeRecovery(expenseSeries.values);
    if (detection) {
      const period = expenseSeries.periods[detection.index] || "a prior period";
      const excess = Math.max(0, Math.round(detection.excess));
      const windowLabel = detection.length > 1 ? ` over ${detection.length} periods` : "";
      expenseSpikeRecovery = makeDriver({
        id: "historical-opex-spike",
        title: detection.length > 1 ? `Operating expense spike${windowLabel}, then recovered` : "Operating expenses spiked and then recovered",
        observation: `Operating expenses peaked at ${Math.round(detection.peak).toLocaleString("en-US")} in ${period}${windowLabel} and then returned near the surrounding-period baseline of ${Math.round(detection.baseline).toLocaleString("en-US")}.`,
        evidence: [`Spike period: ${period}${windowLabel}`, `Peak operating expenses: $${Math.round(detection.peak).toLocaleString("en-US")}`, `Estimated excess versus surrounding periods: $${excess.toLocaleString("en-US")}`],
      });
    }
  }

  const rawRevenueTrend = Array.isArray(body.recentRevenueTrend) ? body.recentRevenueTrend : [];
  const revenueValues = rawRevenueTrend.map(asFiniteNumber).filter((value): value is number => value !== null && value > 0);
  const volatilityValues = revenueValues.length >= 6 ? revenueValues : (revenueSeries?.values.filter((value) => value > 0) ?? []);
  if (volatilityValues.length < 6) return { inventoryBuildup, expenseSpikeRecovery, revenueVolatility: null };
  const min = Math.min(...volatilityValues);
  const max = Math.max(...volatilityValues);
  const range = max - min;
  const maxMinRatio = min > 0 ? max / min : 0;
  return { inventoryBuildup, expenseSpikeRecovery, revenueVolatility: maxMinRatio >= 1.5 ? { min, max, range, maxMinRatio, periods: volatilityValues.length } : null };
}

function extractOutputText(payload: any): string {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  let text = "";
  if (Array.isArray(payload?.output)) {
    for (const outputItem of payload.output) {
      if (!Array.isArray(outputItem?.content)) continue;
      for (const contentItem of outputItem.content) if (contentItem?.type === "output_text" && typeof contentItem?.text === "string") text += contentItem.text;
    }
  }
  return text.trim();
}

function asAnalysisObject(value: unknown): Record<string, any> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : null;
}

function normalizeScenarioAnalysis(analysis: Record<string, any>, signals: ScenarioSignals, body: Record<string, unknown>): Record<string, any> {
  const normalized = { ...analysis };
  const evidence = Array.isArray(normalized.evidence) ? normalized.evidence.map(String) : [];
  const unknowns = Array.isArray(normalized.unknowns) ? normalized.unknowns.map(String) : [];

  if (signals.inventoryBuildup) {
    const driver = signals.inventoryBuildup;
    normalized.primaryDriver = String(driver.title ?? "Inventory is building faster than revenue");
    normalized.whyItMatters = String(driver.observation ?? "Inventory is growing faster than revenue.");
    normalized.managementQuestion = "Which inventory categories or SKUs are driving the build, and are current purchases supported by demand?";
    normalized.recommendedAction = typeof body.currentRecommendation === "string" && body.currentRecommendation.trim() ? body.currentRecommendation : "Review inventory aging, purchasing cadence, demand support, and slow-moving stock to determine whether inventory growth is absorbing working capital without matching sales.";
    if (!evidence.some((item) => /inventory/i.test(item))) evidence.push(...(Array.isArray(driver.evidence) ? driver.evidence.map(String) : []));
    if (!unknowns.some((item) => /inventory/i.test(item))) unknowns.unshift("The workbook does not identify which inventory categories or SKUs are driving the increase.");
    normalized.executiveSummary = `${normalized.executiveSummary} ClearCFO specifically detected inventory building faster than revenue, so inventory is the primary working-capital pattern to investigate.`.trim();
  }

  if (signals.expenseSpikeRecovery) {
    const driver = signals.expenseSpikeRecovery;
    normalized.primaryDriver = String(driver.title ?? "Operating expenses spiked and then recovered");
    normalized.whyItMatters = String(driver.observation ?? "Operating expenses spiked in a prior period and then returned toward the surrounding baseline.");
    normalized.managementQuestion = "What caused the operating expense spike, and was it truly non-recurring?";
    normalized.recommendedAction = "Review the operating expense spike, confirm what caused it, and determine whether it was truly non-recurring.";
    if (!evidence.some((item) => /operating expense|opex/i.test(item))) evidence.push(...(Array.isArray(driver.evidence) ? driver.evidence.map(String) : []));
    if (!unknowns.some((item) => /recurr|expense/i.test(item))) unknowns.unshift("The workbook does not establish whether the operating expense spike will recur.");
    normalized.executiveSummary = `${normalized.executiveSummary} ClearCFO specifically detected an operating-expense spike followed by recovery, so that pattern should be reviewed separately from any revenue spike.`.trim();
  }

  if (signals.revenueVolatility) {
    const { min, max, maxMinRatio, periods } = signals.revenueVolatility;
    const ratioText = `${maxMinRatio.toFixed(1)}x`;
    normalized.primaryDriver = "Revenue is materially volatile across the displayed periods";
    normalized.whyItMatters = `Revenue ranges from $${Math.round(min).toLocaleString("en-US")} to $${Math.round(max).toLocaleString("en-US")} across ${periods} displayed periods, a ${ratioText} max-to-min range. This makes a simple straight-line trend less reliable.`;
    normalized.managementQuestion = "What customer, product, pricing, volume, or seasonal factors explain the recurring revenue swings?";
    normalized.recommendedAction = "Assess whether the revenue swings reflect seasonality, customer concentration, product mix, pricing, or volume changes before treating the latest movement as a persistent trend.";
    if (!evidence.some((item) => /volatil|range|max|min|revenue/i.test(item))) evidence.unshift(`Revenue range: $${Math.round(min).toLocaleString("en-US")} to $${Math.round(max).toLocaleString("en-US")}`);
    if (!evidence.some((item) => /ratio|[0-9]\.[0-9]x/i.test(item))) evidence.push(`Revenue max-to-min ratio: ${ratioText}`);
    if (!unknowns.some((item) => /season|volatil|customer|product|volume/i.test(item))) unknowns.push("The workbook does not establish whether the revenue swings are seasonal or driven by customer, product, pricing, or volume changes.");
    normalized.executiveSummary = `${normalized.executiveSummary} Revenue also shows a ${ratioText} max-to-min range across the displayed periods, so volatility should be evaluated before relying on a straight-line trend.`.trim();
  }

  normalized.evidence = Array.from(new Set(evidence)).slice(0, 4);
  normalized.unknowns = Array.from(new Set(unknowns)).slice(0, 4);
  return normalized;
}

export async function POST(request: Request) {
  const limited = checkRateLimit(request, aiRateLimit);
  if (limited) return limited;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[ClearCFO AI] OPENAI_API_KEY is missing.");
    return NextResponse.json({ error: "AI analysis is not configured." }, { status: 503 });
  }
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > MAX_REQUEST_BYTES) return NextResponse.json({ error: "The financial analysis payload is too large. Please upload a smaller workbook or reduce the analysis data." }, { status: 413 });
    let body: unknown;
    try { body = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "Invalid analysis payload." }, { status: 400 }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid analysis payload." }, { status: 400 });

    const bodyObject = body as Record<string, unknown>;
    const model = process.env.OPENAI_MODEL || "gpt-5-mini";
    const scenarioSignals = deriveScenarioSignals(bodyObject);
    const snapshot = bodyObject.financialSnapshot && typeof bodyObject.financialSnapshot === "object"
      ? bodyObject.financialSnapshot as Record<string, unknown>
      : {};
    const currentExpense = asFiniteNumber(snapshot.operatingExpense);
    const previousExpense = asFiniteNumber(snapshot.previousOperatingExpense);
    const expenseDelta = currentExpense !== null && previousExpense !== null ? currentExpense - previousExpense : null;
    const priorFromChange = (current: number | null, change: number | null): number | null => {
      if (current === null || change === null || change === -100) return null;
      const prior = current / (1 + change / 100);
      return Number.isFinite(prior) ? prior : null;
    };
    const materialityDirectives = [];
    const snapshotMetrics = [
      { name: "revenue", current: asFiniteNumber(snapshot.revenue), change: asFiniteNumber(snapshot.revenueChange) },
      { name: "cash", current: asFiniteNumber(snapshot.cash), change: asFiniteNumber(snapshot.cashChange) },
      { name: "inventory", current: asFiniteNumber(snapshot.inventory), change: asFiniteNumber(snapshot.inventoryChange) },
      { name: "operating expense", current: currentExpense, change: asFiniteNumber(snapshot.operatingExpenseChange) },
    ];
    for (const metric of snapshotMetrics) {
      if (metric.name === "operating expense" && currentExpense !== null && previousExpense !== null) {
        const expensePct = previousExpense === 0 ? null : ((currentExpense - previousExpense) / Math.abs(previousExpense)) * 100;
        if (expensePct !== null && Math.abs(expensePct) >= 100) {
          materialityDirectives.push(`For operating expense, the reported percentage change is ${expensePct.toFixed(1)}% from ${Math.round(previousExpense).toLocaleString("en-US")} to ${Math.round(currentExpense).toLocaleString("en-US")}. Lead with the dollar movement of ${Math.abs(Math.round(currentExpense - previousExpense)).toLocaleString("en-US")} and the starting/ending balances; do not present the percentage alone as evidence of material business impact.`);
        }
        continue;
      }
      if (metric.current === null || metric.change === null || Math.abs(metric.change) < 100) continue;
      const prior = priorFromChange(metric.current, metric.change);
      if (prior === null) continue;
      const delta = metric.current - prior;
      materialityDirectives.push(`For ${metric.name}, the reported percentage change is ${metric.change.toFixed(1)}% from ${Math.round(prior).toLocaleString("en-US")} to ${Math.round(metric.current).toLocaleString("en-US")}. Lead with the dollar movement of ${Math.abs(Math.round(delta)).toLocaleString("en-US")} and the starting/ending balances; do not present the percentage alone as evidence of material business impact.`);
    }
    if (currentExpense !== null && previousExpense !== null && Math.abs(previousExpense) < 1000) {
      materialityDirectives.push(`Operating expense prior-period baseline is only ${Math.round(previousExpense).toLocaleString("en-US")} and current expense is ${Math.round(currentExpense).toLocaleString("en-US")}. Do not use the resulting percentage change as a headline fact, primary driver, management question, or action rationale. Use the dollar movement of ${Math.abs(Math.round(expenseDelta ?? 0)).toLocaleString("en-US")} and the starting/ending balances instead.`);
    }
    if (currentExpense !== null && previousExpense !== null && expenseDelta !== null) {
      materialityDirectives.push(`For operating expense, the observed dollar movement is ${expenseDelta >= 0 ? "+" : ""}${Math.round(expenseDelta).toLocaleString("en-US")} from ${Math.round(previousExpense).toLocaleString("en-US")} to ${Math.round(currentExpense).toLocaleString("en-US")}. Treat this dollar movement as more informative than the percentage when the baseline is small.`);
    }
    const scenarioDirectives = [
      scenarioSignals.inventoryBuildup ? "Inventory buildup is a confirmed deterministic signal. Explicitly name inventory as the primary working-capital pattern; do not replace it with a generic margin or revenue statement." : "",
      scenarioSignals.expenseSpikeRecovery ? "Operating expenses spiked and then recovered. Explicitly name the OPEX spike/recovery pattern and keep it distinct from any revenue spike." : "",
      scenarioSignals.revenueVolatility ? `Revenue volatility is a deterministic signal: revenue spans $${Math.round(scenarioSignals.revenueVolatility.min).toLocaleString("en-US")} to $${Math.round(scenarioSignals.revenueVolatility.max).toLocaleString("en-US")} (${scenarioSignals.revenueVolatility.maxMinRatio.toFixed(1)}x). Discuss volatility explicitly; seasonality is only a hypothesis.` : "",
    ...materialityDirectives,
    ].filter(Boolean).join(" ");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, store: false, instructions: `${instructions} ${scenarioDirectives}`.trim(), input: JSON.stringify(bodyObject), text: { format: { type: "json_schema", name: "clearcfo_cfo_analysis", strict: true, schema: analysisSchema } } }),
    });

    const rawResponse = await response.text();
    let payload: any;
    try { payload = JSON.parse(rawResponse); } catch {
      console.error(`[ClearCFO AI] OpenAI returned a non-JSON response (length: ${rawResponse.length}).`);
      return NextResponse.json({ error: "OpenAI returned an unexpected response." }, { status: 502 });
    }
    if (!response.ok) {
      console.error("[ClearCFO AI] OpenAI request failed:", { status: response.status, statusText: response.statusText, error: payload?.error });
      return NextResponse.json({ error: typeof payload?.error?.message === "string" ? payload.error.message : `OpenAI request failed with status ${response.status}.` }, { status: 502 });
    }
    const text = extractOutputText(payload);
    if (!text) {
      console.error("[ClearCFO AI] OpenAI returned no output text.");
      return NextResponse.json({ error: "OpenAI returned an empty analysis." }, { status: 502 });
    }
    let analysis: unknown;
    try { analysis = JSON.parse(text); } catch (error) {
      console.error("[ClearCFO AI] Could not parse structured output:", error instanceof Error ? error.message : "Unknown error");
      return NextResponse.json({ error: "OpenAI returned an analysis that could not be parsed." }, { status: 502 });
    }
    const analysisObject = asAnalysisObject(analysis);
    if (!analysisObject) return NextResponse.json({ error: "OpenAI returned an invalid analysis structure." }, { status: 502 });
    const normalizedAnalysis = normalizeScenarioAnalysis(analysisObject, scenarioSignals, bodyObject);
    console.log("[ClearCFO AI] Analysis completed successfully.");
    return NextResponse.json({ analysis: normalizedAnalysis });
  } catch (error) {
    console.error("[ClearCFO AI] Unexpected server error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate the CFO analysis." }, { status: 500 });
  }
}
