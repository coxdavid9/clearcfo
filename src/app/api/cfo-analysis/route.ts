import { NextResponse } from "next/server";

export const runtime = "nodejs";

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    executiveSummary: {
      type: "string",
    },

    primaryDriver: {
      type: "string",
    },

    whyItMatters: {
      type: "string",
    },

    managementQuestion: {
      type: "string",
    },

    recommendedAction: {
      type: "string",
    },

    priority: {
      type: "string",
      enum: ["High", "Medium", "Watch"],
    },

    confidence: {
      type: "number",
    },

    evidence: {
      type: "array",
      items: {
        type: "string",
      },
    },

    unknowns: {
      type: "array",
      items: {
        type: "string",
      },
    },

    actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: {
            type: "string",
          },

          rationale: {
            type: "string",
          },

          priority: {
            type: "string",
            enum: ["High", "Medium", "Watch"],
          },

          score: {
            type: "number",
          },
        },

        required: [
          "title",
          "rationale",
          "priority",
          "score",
        ],
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

  "Do not present estimated impact as guaranteed savings, guaranteed profit, or a forecast.",

  "Treat estimated impact as a potential financial opportunity supported by the supplied variance.",

  /*
   * ------------------------------------------------------------
   * EVIDENCE-CALIBRATED RECOMMENDATIONS
   * ------------------------------------------------------------
   */

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

  /*
   * ------------------------------------------------------------
   * RECOMMENDED ACTION
   * ------------------------------------------------------------
   */

  "The recommendedAction should be the strongest defensible next management step based on the evidence.",

  "The recommendedAction should be immediately understandable to a business owner or CFO.",

  "The recommendedAction should be actionable but should not contain unsupported numerical targets, arbitrary deadlines, or invented operational facts.",

  "When the primary issue is cash decline and detailed cash-flow data is unavailable, recommend reconciling the cash movement and assessing near-term liquidity rather than claiming exactly what caused the decline.",

  "When the primary issue is inventory relative to revenue, recommend reviewing inventory aging, purchasing cadence, demand support, and slow-moving stock before recommending a specific purchase reduction.",

  "When the primary issue is operating expense growth without account-level detail, recommend identifying the expense categories driving the increase before recommending specific cuts.",

  "When the primary issue is gross-margin compression without detailed driver information, recommend decomposing pricing, materials, labor, mix, or other relevant margin drivers before prescribing a corrective action.",

  /*
   * ------------------------------------------------------------
   * PRIORITIZED ACTIONS
   * ------------------------------------------------------------
   */

  "Return 1 to 4 prioritized management actions.",

  "Prioritized actions should follow this sequence when evidence is incomplete: first validate and quantify the primary driver, second identify the specific account or category responsible, third take a targeted corrective action supported by the evidence, and fourth monitor the result.",

  "Do not skip directly from a high-level financial signal to a highly specific operational mandate when the underlying evidence is missing.",

  "Every action should clearly relate to one or more supplied financial drivers.",

  "The first action should normally address the strongest supported financial driver.",

  "Actions should be practical for management to execute or assign.",

  "An action may recommend investigation when additional evidence is necessary before a corrective action can responsibly be taken.",

  "For every recommended action, provide a score from 0 to 100 based on expected financial relevance, evidence confidence, urgency, and management controllability.",

  "The action score must not imply guaranteed savings or guaranteed financial results.",

  /*
   * ------------------------------------------------------------
   * EVIDENCE GAPS
   * ------------------------------------------------------------
   */

  "Return 0 to 4 unknowns or evidence gaps when the supplied information cannot establish a root cause.",

  "Evidence gaps should identify specific information that would materially improve the recommendation.",

  "Do not manufacture missing information.",

  "Do not repeat an evidence gap unless it is materially relevant to the decision.",

  /*
   * ------------------------------------------------------------
   * FINAL OUTPUT
   * ------------------------------------------------------------
   */

  "The executiveSummary should clearly distinguish observed financial facts from interpretation.",

  "The primaryDriver should identify the strongest supported financial driver, not an unsupported root cause.",

  "The whyItMatters field should explain the business significance of the driver using the supplied evidence.",

  "The managementQuestion should identify the most important question management needs answered next.",

  "The evidence array should contain only facts directly supported by the supplied input.",

  "The recommendedAction should represent the strongest defensible next step, not an unsupported operational mandate.",

  "Return only the requested structured analysis.",
].join(" ");

function extractOutputText(payload: any): string {
  if (
    typeof payload?.output_text === "string" &&
    payload.output_text.trim()
  ) {
    return payload.output_text.trim();
  }

  let text = "";

  if (Array.isArray(payload?.output)) {
    for (const outputItem of payload.output) {
      if (!Array.isArray(outputItem?.content)) {
        continue;
      }

      for (const contentItem of outputItem.content) {
        if (
          contentItem?.type === "output_text" &&
          typeof contentItem?.text === "string"
        ) {
          text += contentItem.text;
        }
      }
    }
  }

  return text.trim();
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error(
      "[ClearCFO AI] OPENAI_API_KEY is missing."
    );

    return NextResponse.json(
      {
        error:
          "AI analysis is not configured. OPENAI_API_KEY was not found in the server environment.",
      },
      { status: 503 }
    );
  }

  try {
    /*
     * ------------------------------------------------------------
     * REQUEST BODY
     * ------------------------------------------------------------
     */

    const rawBody = await request.text();

    /*
     * Prevent unexpectedly large AI requests.
     */

    const MAX_REQUEST_BYTES = 250 * 1024;

    if (
      new TextEncoder().encode(rawBody).length >
      MAX_REQUEST_BYTES
    ) {
      return NextResponse.json(
        {
          error:
            "The financial analysis payload is too large. Please upload a smaller workbook or reduce the analysis data.",
        },
        { status: 413 }
      );
    }

    let body: unknown;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        {
          error: "Invalid analysis payload.",
        },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        {
          error: "Invalid analysis payload.",
        },
        { status: 400 }
      );
    }

    /*
     * ------------------------------------------------------------
     * MODEL
     * ------------------------------------------------------------
     */

    const model =
      process.env.OPENAI_MODEL ||
      "gpt-5-mini";

    console.log(
      `[ClearCFO AI] Starting analysis with model: ${model}`
    );

    /*
     * ------------------------------------------------------------
     * OPENAI RESPONSES API
     * ------------------------------------------------------------
     */

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          model,

          store: false,

          instructions,

          input: JSON.stringify(body),

          text: {
            format: {
              type: "json_schema",
              name: "clearcfo_cfo_analysis",
              strict: true,
              schema: analysisSchema,
            },
          },
        }),
      }
    );

    /*
     * ------------------------------------------------------------
     * READ RESPONSE
     * ------------------------------------------------------------
     */

    const rawResponse = await response.text();

    let payload: any;

    try {
      payload = JSON.parse(rawResponse);
    } catch {
      console.error(
        "[ClearCFO AI] OpenAI returned non-JSON:",
        rawResponse
      );

      return NextResponse.json(
        {
          error:
            "OpenAI returned an unexpected response.",
        },
        { status: 502 }
      );
    }

    /*
     * ------------------------------------------------------------
     * OPENAI ERROR
     * ------------------------------------------------------------
     */

    if (!response.ok) {
      console.error(
        "[ClearCFO AI] OpenAI request failed:",
        {
          status: response.status,
          statusText: response.statusText,
          error: payload?.error,
        }
      );

      const message =
        typeof payload?.error?.message ===
        "string"
          ? payload.error.message
          : `OpenAI request failed with status ${response.status}.`;

      return NextResponse.json(
        {
          error: message,
        },
        { status: 502 }
      );
    }

    /*
     * ------------------------------------------------------------
     * EXTRACT MODEL OUTPUT
     * ------------------------------------------------------------
     */

    const text =
      extractOutputText(payload);

    if (!text) {
      console.error(
        "[ClearCFO AI] OpenAI returned no output text."
      );

      console.error(
        JSON.stringify(
          payload,
          null,
          2
        )
      );

      return NextResponse.json(
        {
          error:
            "OpenAI returned an empty analysis.",
        },
        { status: 502 }
      );
    }

    /*
     * ------------------------------------------------------------
     * PARSE STRUCTURED ANALYSIS
     * ------------------------------------------------------------
     */

    let analysis: unknown;

    try {
      analysis = JSON.parse(text);
    } catch (parseError) {
      console.error(
        "[ClearCFO AI] Could not parse structured output:",
        parseError
      );

      console.error(
        "[ClearCFO AI] Returned text:",
        text
      );

      return NextResponse.json(
        {
          error:
            "OpenAI returned an analysis that could not be parsed.",
        },
        { status: 502 }
      );
    }

    /*
     * ------------------------------------------------------------
     * BASIC SAFETY CHECK
     * ------------------------------------------------------------
     */

    if (
      !analysis ||
      typeof analysis !== "object" ||
      Array.isArray(analysis)
    ) {
      console.error(
        "[ClearCFO AI] Parsed analysis was not an object."
      );

      return NextResponse.json(
        {
          error:
            "OpenAI returned an invalid analysis structure.",
        },
        { status: 502 }
      );
    }

    /*
     * ------------------------------------------------------------
     * SUCCESS
     * ------------------------------------------------------------
     */

    console.log(
      "[ClearCFO AI] Analysis completed successfully."
    );

    return NextResponse.json({
      analysis,
    });
  } catch (error) {
    /*
     * ------------------------------------------------------------
     * UNEXPECTED SERVER ERROR
     * ------------------------------------------------------------
     */

    console.error(
      "[ClearCFO AI] Unexpected server error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate the CFO analysis.",
      },
      { status: 500 }
    );
  }
}