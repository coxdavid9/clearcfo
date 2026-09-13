import { NextResponse } from "next/server";
import { aiRateLimit, checkRateLimit } from "../../../lib/rate-limit";

export const runtime = "nodejs";

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
        },
        required: ["title", "rationale", "priority", "score"],
      },
    },
  },
  required: [
    "executiveSummary",
    "primaryDriver",
    "whyItMatters",
    "managementQuestion",
    "recommendedAction",
    "priority",
    "confidence",
    "evidence",
    "unknowns",
    "actions",
  ],
};

const instructions = [
  "You are ClearCFO, a conservative CFO-level financial intelligence system for small and growing businesses.",
  "Analyze only the supplied financial facts.",
  "Never invent a number, transaction, account, cause, trend, customer, vendor, purchase commitment, demand assumption, forecast, or business fact.",
  "Separate observed facts from reasonable interpretation and from recommended management action.",
  "If the supplied data cannot prove a cause, describe it as an investigation area or management question rather than stating it as fact.",
  "Prioritize cash, margin, working capital, revenue quality, unusual spending, and material financial drivers before lower-impact observations.",
  "The deterministic ClearCFO financial engine has already performed the calculations. Your job is to interpret those calculations and explain their business meaning.",
  "Use financialDrivers as the primary evidence hierarchy.",
  "Use detailDrivers as the account-level evidence layer.",
  "Use multiPeriodInsights as the historical-pattern layer.",
  "When an account-level movement supports a top-level driver, explicitly connect the account movement to that driver.",
  "When a multi-period pattern exists, distinguish a persistent pattern from a one-period variance.",
  "Name the strongest supported financial driver first.",
  "Include 2 to 4 concrete evidence points that are directly supported by the supplied facts.",
  "Never invent evidence to make the explanation sound more complete.",
  "If multiple drivers interact, describe the relationship as a plausible connection rather than proven causation unless the supplied data establishes causation.",
  "Do not claim a root cause unless the supplied evidence supports that conclusion.",
  "Do not treat a trend as proof of causation.",
  "Explain what changed, why it matters, what management should investigate, and what action should come next.",
  "Keep the explanation concise enough for a business owner, controller, or CFO to use in a management meeting.",
  "Use calibrated causal language. Prefer phrases such as coincides with, is consistent with, may contribute to, can indicate, suggests, or warrants investigation. Do not say an event caused another outcome unless the supplied evidence explicitly establishes causation.",
  "Do not present estimated impact as guaranteed savings, guaranteed profit, or a forecast.",
  "Treat estimated impact as a potential financial opportunity supported by the supplied variance.",
  "Recommendations must never be more specific than the evidence supports.",
  "The recommendedAction must address the strongest supported financial driver while remaining within the limits of the available evidence.",
  "When evidence is incomplete, recommend a validation or investigation step before prescribing a specific operational action.",
  "Do not impose arbitrary time periods such as 30-day holds, 60-day reductions, or similar deadlines unless the supplied financial evidence explicitly supports that timeframe.",
  "Do not recommend stopping, freezing, canceling, or materially changing purchases unless the supplied evidence supports that action.",
  "Do not claim that a specific inventory category, SKU, vendor, customer, expense account, or transaction is responsible unless the supplied input identifies it.",
  "Do not claim that a specific cash-flow driver caused a cash change unless the supplied input provides evidence supporting that conclusion.",
  "If detailed cash-flow information is unavailable, recommend reconciling the cash movement to collections, purchases, financing, debt, one-time items, and other relevant cash flows rather than claiming to know the exact cause.",
  "If a 13-week cash forecast would be useful but the supplied data does not contain sufficient cash-flow detail to build one, recommend building or reconciling a 13-week cash forecast rather than implying that ClearCFO already performed the forecast.",
  "If inventory is rising relative to revenue but SKU-level or aging detail is unavailable, recommend reviewing inventory aging, purchasing cadence, demand support, and slow-moving inventory before prescribing a specific inventory reduction.",
  "If operating expenses are rising but account-level detail is unavailable, recommend identifying the expense categories driving the increase before prescribing specific cost reductions.",
  "If gross margin is declining but pricing, material cost, labor, mix, or product-level detail is unavailable, recommend decomposing the margin change into those drivers before prescribing a pricing or cost action.",
  "Prefer evidence-calibrated language such as Review and validate, Investigate, Assess whether, Determine whether, Reconcile, Identify, Evaluate, Consider deferring non-essential activity, or Prioritize review.",
  "Avoid unsupported language such as Implement a 30-day purchase hold, Cancel these purchases, Reduce inventory by 20 percent, Cut staffing, Raise prices by 5 percent, or similar specific mandates unless the supplied evidence explicitly supports that action.",
  "The goal is to make ClearCFO useful and decisive without overstating what the available financial evidence proves.",
  "The recommendedAction should be the strongest defensible next management step based on the evidence.",
  "The recommendedAction should be immediately understandable to a business owner or CFO.",
  "The recommendedAction should be actionable but should not contain unsupported numerical targets, arbitrary deadlines, or invented operational facts.",
  "When the primary issue is cash decline and detailed cash-flow data is unavailable, recommend reconciling the cash movement and assessing near-term liquidity rather than claiming exactly what caused the decline.",
  "When the primary issue is inventory relative to revenue, recommend reviewing inventory aging, purchasing cadence, demand support, and slow-moving stock before recommending a specific purchase reduction.",
  "When the primary issue is operating expense growth without account-level detail, recommend identifying the expense categories driving the increase before recommending specific cuts.",
  "When the primary issue is gross-margin compression without detailed driver information, recommend decomposing pricing, materials, labor, mix, or other relevant margin drivers before prescribing a corrective action.",
  "Return 1 to 4 prioritized management actions.",
  "Prioritized actions should follow this sequence when evidence is incomplete: first validate and quantify the primary driver, second identify the specific account or category responsible, third take a targeted corrective action supported by the evidence, and fourth monitor the result.",
  "Do not skip directly from a high-level financial signal to a highly specific operational mandate when the underlying evidence is missing.",
  "Every action should clearly relate to one or more supplied financial drivers.",
  "The first action should normally address the strongest supported financial driver.",
  "Actions should be practical for management to execute or assign.",
  "An action may recommend investigation when additional evidence is necessary before a corrective action can responsibly be taken.",
  "For every recommended action, provide a score from 0 to 100 based on expected financial relevance, evidence confidence, urgency, and management controllability.",
  "The action score must not imply guaranteed savings or guaranteed financial results.",
  "Return 0 to 4 unknowns or evidence gaps when the supplied information cannot establish a root cause.",
  "Evidence gaps should identify specific information that would materially improve the recommendation.",
  "Do not manufacture missing information.",
  "Do not repeat an evidence gap unless it is materially relevant to the decision.",
  "The executiveSummary should clearly distinguish observed financial facts from interpretation.",
  "The primaryDriver should identify the strongest supported financial driver, not an unsupported root cause.",
  "The whyItMatters field should explain the business significance of the driver using the supplied evidence.",
  "The managementQuestion should identify the most important question management needs answered next.",
  "The evidence array should contain only facts directly supported by the supplied input.",
  "The recommendedAction should represent the strongest defensible next step, not an unsupported operational mandate.",
  "Return only the requested structured analysis.",
].join(" ");

function extractOutputText(payload: any): string {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  let text = "";
  if (Array.isArray(payload?.output)) {
    for (const outputItem of payload.output) {
      if (!Array.isArray(outputItem?.content)) continue;
      for (const contentItem of outputItem.content) {
        if (contentItem?.type === "output_text" && typeof contentItem?.text === "string") {
          text += contentItem.text;
        }
      }
    }
  }
  return text.trim();
}

type FinancialDriverInput = {
  id?: unknown;
  title?: unknown;
  observation?: unknown;
  evidence?: unknown;
  severity?: unknown;
};

type ScenarioSignals = {
  inventoryBuildup: FinancialDriverInput | null;
  expenseSpikeRecovery: FinancialDriverInput | null;
  revenueVolatility: {
    min: number;
    max: number;
    range: number;
    maxMinRatio: number;
    periods: number;
  } | null;
};

function asFiniteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function deriveScenarioSignals(body: Record<string, unknown>): ScenarioSignals {
  const drivers = Array.isArray(body.financialDrivers)
    ? body.financialDrivers.filter((item): item is FinancialDriverInput => !!item && typeof item === "object")
    : [];

  const inventoryBuildup = drivers.find((driver) =>
    driver.id === "inventory-growth" || /inventory.*outpacing|inventory.*growth/i.test(String(driver.title ?? ""))
  ) ?? null;

  const expenseSpikeRecovery = drivers.find((driver) =>
    driver.id === "historical-opex-spike" || /operating expense spike/i.test(String(driver.title ?? ""))
  ) ?? null;

  const rawTrend = Array.isArray(body.recentRevenueTrend) ? body.recentRevenueTrend : [];
  const revenueValues = rawTrend.map(asFiniteNumber).filter((value): value is number => value !== null && value > 0);

  if (revenueValues.length < 6) {
    return { inventoryBuildup, expenseSpikeRecovery, revenueVolatility: null };
  }

  const min = Math.min(...revenueValues);
  const max = Math.max(...revenueValues);
  const range = max - min;
  const maxMinRatio = min > 0 ? max / min : 0;

  return {
    inventoryBuildup,
    expenseSpikeRecovery,
    revenueVolatility: maxMinRatio >= 1.5
      ? { min, max, range, maxMinRatio, periods: revenueValues.length }
      : null,
  };
}

function asAnalysisObject(value: unknown): Record<string, any> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, any>
    : null;
}

function normalizeScenarioAnalysis(analysis: Record<string, any>, signals: ScenarioSignals, body: Record<string, unknown>): Record<string, any> {
  const normalized = { ...analysis };
  const evidence = Array.isArray(normalized.evidence) ? [...normalized.evidence.map(String)] : [];
  const unknowns = Array.isArray(normalized.unknowns) ? [...normalized.unknowns.map(String)] : [];

  if (signals.inventoryBuildup) {
    const driver = signals.inventoryBuildup;
    const observation = String(driver.observation ?? "Inventory is growing faster than revenue.");
    normalized.primaryDriver = String(driver.title ?? "Inventory is outpacing revenue");
    normalized.whyItMatters = observation;
    normalized.managementQuestion = "Which inventory categories or SKUs are driving the build, and are current purchases supported by demand?";
    normalized.recommendedAction = typeof body.currentRecommendation === "string" && body.currentRecommendation.trim()
      ? body.currentRecommendation
      : "Review inventory aging, purchasing cadence, and demand support to determine whether inventory growth is absorbing cash without matching sales.";
    if (!evidence.some((item) => /inventory/i.test(item))) {
      for (const item of Array.isArray(driver.evidence) ? driver.evidence : []) {
        if (evidence.length >= 4) break;
        evidence.push(String(item));
      }
    }
    if (!unknowns.some((item) => /inventory/i.test(item))) {
      unknowns.unshift("The workbook does not identify which inventory categories or SKUs are driving the increase.");
    }
    normalized.executiveSummary = `${normalized.executiveSummary} ClearCFO specifically detected inventory growth outpacing revenue, so inventory is the primary working-capital pattern to investigate.`.trim();
  }

  if (signals.expenseSpikeRecovery) {
    const driver = signals.expenseSpikeRecovery;
    normalized.primaryDriver = String(driver.title ?? "A one-period operating expense spike was detected");
    normalized.whyItMatters = String(driver.observation ?? "Operating expenses spiked in a prior period and then returned toward the surrounding baseline.");
    normalized.managementQuestion = "What caused the one-period operating expense spike, and was it truly non-recurring?";
    normalized.recommendedAction = "Review the one-period operating expense spike, confirm what caused it, and determine whether it was truly non-recurring.";
    if (!evidence.some((item) => /operating expense|opex/i.test(item))) {
      for (const item of Array.isArray(driver.evidence) ? driver.evidence : []) {
        if (evidence.length >= 4) break;
        evidence.push(String(item));
      }
    }
    if (!unknowns.some((item) => /recurr|expense/i.test(item))) {
      unknowns.unshift("The workbook does not establish whether the operating expense spike will recur.");
    }
    normalized.executiveSummary = `${normalized.executiveSummary} ClearCFO specifically detected an operating-expense spike followed by recovery, so the spike/recovery pattern should be reviewed separately from the underlying revenue trend.`.trim();
  }

  if (signals.revenueVolatility) {
    const { min, max, range, maxMinRatio, periods } = signals.revenueVolatility;
    const ratioText = `${maxMinRatio.toFixed(1)}x`;
    normalized.primaryDriver = "Revenue is materially volatile across the displayed periods";
    normalized.whyItMatters = `Revenue ranges from $${Math.round(min).toLocaleString("en-US")} to $${Math.round(max).toLocaleString("en-US")} across ${periods} displayed periods, a ${ratioText} max-to-min range. This volatility makes a simple straight-line trend less reliable for management interpretation.`;
    normalized.managementQuestion = "What customer, product, pricing, volume, or seasonal factors explain the recurring revenue swings?";
    normalized.recommendedAction = "Assess whether the revenue swings reflect seasonality, customer concentration, product mix, pricing, or volume changes before treating the latest movement as a persistent trend.";
    if (!evidence.some((item) => /volatil|range|max|min|revenue/i.test(item))) {
      evidence.unshift(`Revenue range: $${Math.round(min).toLocaleString("en-US")} to $${Math.round(max).toLocaleString("en-US")}`);
    }
    if (!evidence.some((item) => /1\.5x|2\.0x|2\.1x|2\.2x|2\.3x|2\.4x|2\.5x|x max|ratio/i.test(item))) {
      evidence.push(`Revenue max-to-min ratio: ${ratioText}`);
    }
    if (!unknowns.some((item) => /season|volatil|customer|product|volume/i.test(item))) {
      unknowns.push("The workbook does not establish whether the revenue swings are seasonal or driven by customer, product, pricing, or volume changes.");
    }
    normalized.executiveSummary = `${normalized.executiveSummary} Revenue also shows a ${ratioText} max-to-min range across the displayed periods, so volatility should be evaluated before relying on a straight-line trend.`.trim();
    void range;
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
    return NextResponse.json({ error: "AI analysis is not configured. OPENAI_API_KEY was not found in the server environment." }, { status: 503 });
  }

  try {
    const rawBody = await request.text();
    const MAX_REQUEST_BYTES = 250 * 1024;
    if (new TextEncoder().encode(rawBody).length > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: "The financial analysis payload is too large. Please upload a smaller workbook or reduce the analysis data." }, { status: 413 });
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid analysis payload." }, { status: 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid analysis payload." }, { status: 400 });
    }

    const bodyObject = body as Record<string, unknown>;
    const model = process.env.OPENAI_MODEL || "gpt-5-mini";
    const scenarioSignals = deriveScenarioSignals(bodyObject);

    const scenarioDirectives = [
      scenarioSignals.inventoryBuildup ? "Inventory buildup is a confirmed deterministic signal in financialDrivers. It must be explicitly named in the executive summary, primary driver, why-it-matters, and recommended action. Do not replace it with a generic revenue trend statement." : "",
      scenarioSignals.expenseSpikeRecovery ? "An operating-expense spike followed by recovery is a confirmed deterministic signal in financialDrivers. It must be explicitly named and kept distinct from any revenue spike." : "",
      scenarioSignals.revenueVolatility ? `Revenue volatility is a deterministic signal from recentRevenueTrend: the positive revenue values span $${Math.round(scenarioSignals.revenueVolatility.min).toLocaleString("en-US")} to $${Math.round(scenarioSignals.revenueVolatility.max).toLocaleString("en-US")} (${scenarioSignals.revenueVolatility.maxMinRatio.toFixed(1)}x). Explicitly discuss volatility. Seasonality may be considered as a hypothesis, not a proven cause.` : "",
    ].filter(Boolean).join(" ");

    console.log(`[ClearCFO AI] Starting analysis with model: ${model}`);

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        instructions: `${instructions} ${scenarioDirectives}`.trim(),
        input: JSON.stringify(bodyObject),
        text: {
          format: {
            type: "json_schema",
            name: "clearcfo_cfo_analysis",
            strict: true,
            schema: analysisSchema,
          },
        },
      }),
    });

    const rawResponse = await response.text();
    let payload: any;
    try {
      payload = JSON.parse(rawResponse);
    } catch {
      console.error(`[ClearCFO AI] OpenAI returned a non-JSON response (length: ${rawResponse.length}).`);
      return NextResponse.json({ error: "OpenAI returned an unexpected response." }, { status: 502 });
    }

    if (!response.ok) {
      console.error("[ClearCFO AI] OpenAI request failed:", {
        status: response.status,
        statusText: response.statusText,
        error: payload?.error,
      });
      const message = typeof payload?.error?.message === "string"
        ? payload.error.message
        : `OpenAI request failed with status ${response.status}.`;
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const text = extractOutputText(payload);
    if (!text) {
      console.error("[ClearCFO AI] OpenAI returned no output text.");
      console.error(`[ClearCFO AI] Payload keys: ${payload && typeof payload === "object" ? Object.keys(payload).join(", ") : typeof payload}.`);
      return NextResponse.json({ error: "OpenAI returned an empty analysis." }, { status: 502 });
    }

    let analysis: unknown;
    try {
      analysis = JSON.parse(text);
    } catch (parseError) {
      console.error("[ClearCFO AI] Could not parse structured output:", parseError instanceof Error ? parseError.message : "Unknown parse error");
      console.error(`[ClearCFO AI] Unparseable output length: ${text.length}.`);
      return NextResponse.json({ error: "OpenAI returned an analysis that could not be parsed." }, { status: 502 });
    }

    const analysisObject = asAnalysisObject(analysis);
    if (!analysisObject) {
      console.error("[ClearCFO AI] Parsed analysis was not an object.");
      return NextResponse.json({ error: "OpenAI returned an invalid analysis structure." }, { status: 502 });
    }

    const normalizedAnalysis = normalizeScenarioAnalysis(analysisObject, scenarioSignals, bodyObject);

    console.log("[ClearCFO AI] Analysis completed successfully.");
    return NextResponse.json({ analysis: normalizedAnalysis });
  } catch (error) {
    console.error("[ClearCFO AI] Unexpected server error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate the CFO analysis." }, { status: 500 });
  }
}
