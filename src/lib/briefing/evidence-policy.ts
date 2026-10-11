import type { FinancialDriver } from "./engine";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export function operatingLossDriver(operatingIncome: unknown, revenue: number): FinancialDriver | null {
  if (typeof operatingIncome !== "number" || !Number.isFinite(operatingIncome) || operatingIncome >= 0) return null;
  const loss = Math.abs(operatingIncome);
  return {
    id: "operating-loss", category: "Operating Expense", title: "The business is operating at a loss",
    observation: `The latest period has an operating loss of ${money(loss)}${revenue > 0 ? ` (${(loss / revenue * 100).toFixed(1)}% of revenue)` : ""}. Operating costs exceed gross profit.`,
    evidence: [`Operating result: ${money(operatingIncome)}`], direction: "down", severity: "High",
    impact: Math.min(10, Math.max(3, Math.round(loss / 25000))), confidence: 0.95,
    managementQuestion: "What pricing, direct-cost, or operating-expense changes could close the operating loss, and which costs are recurring?",
  };
}

/** Deterministic boundaries on model-generated recommendations. Supplied stock
 * balances describe exposure, not achievable savings or SKU turnover. */
export function applyEvidencePolicy(analysis: Record<string, any>, body: Record<string, unknown>): Record<string, any> {
  const result = { ...analysis };
  const snapshot = body.financialSnapshot && typeof body.financialSnapshot === "object" ? body.financialSnapshot as Record<string, unknown> : {};
  const loss = operatingLossDriver(snapshot.operatingIncome, typeof snapshot.revenue === "number" ? snapshot.revenue : 0);
  const drivers = Array.isArray(body.financialDrivers) ? body.financialDrivers : [];
  const inventoryBuild = drivers.find((driver) => driver && typeof driver === "object" && /inventory.*(?:growth|buildup)|inventory.*(?:outpacing|building)/i.test(`${driver.id} ${driver.title}`));
  const inventoryAction = /inventory|\bsku\b|\bskus\b|stock|purchas/i;
  let actions = Array.isArray(result.actions) ? result.actions.filter((action) => action && typeof action === "object") : [];
  const hasInventoryAction = actions.some((action) => inventoryAction.test(`${action.title} ${action.rationale}`));
  // Current analysis inputs contain balances and their movements, not SKU sales,
  // usage, age buckets, or demand commitments. Do not preserve generated claims
  // that a specific SKU is slow-moving or must stop being purchased.
  actions = actions.filter((action) => !inventoryAction.test(`${action.title} ${action.rationale}`));
  if (inventoryBuild || hasInventoryAction) {
    actions.unshift({
      title: "Review inventory growth against SKU sales, usage, and demand",
      rationale: "Compare the largest stock increases with SKU sales, usage, age, and committed demand. Change purchasing only if that review supports it; growing balances alone do not prove excess stock.",
      priority: "High", score: 3, estimatedImpact: null,
    });
    result.managementQuestion = "Which SKUs account for the inventory build, and what do their sales, usage, age, and committed demand show?";
    if (inventoryBuild) {
      result.executiveSummary = `${String(inventoryBuild.observation ?? "Inventory is building faster than revenue.")} This warrants a SKU-level demand and stock-age review; the cause and recoverable cash are not established.`;
      result.whyItMatters = "Inventory is growing faster than sales. Review demand and stock age before deciding whether purchases should change.";
      result.evidence = Array.isArray(inventoryBuild.evidence) ? inventoryBuild.evidence.map(String).slice(0, 4) : [];
    }
    result.unknowns = ["SKU balances and changes do not establish turnover, stock age, excess stock, or achievable cash recovery.", ...(Array.isArray(result.unknowns) ? result.unknowns : [])].slice(0, 4);
    // Replace the prose recommendations too; cards are not the only output.
    result.recommendedAction = "Review SKU sales, usage, age, and committed demand before changing purchases.";
  }
  if (loss) {
    result.executiveSummary = `${loss.observation} ${String(result.executiveSummary ?? "")}`.trim();
    result.evidence = [loss.evidence[0], ...(Array.isArray(result.evidence) ? result.evidence : [])].slice(0, 4);
    actions = actions.filter((action) => !/operating loss|operating at a loss/i.test(`${action.title} ${action.rationale}`));
    actions.unshift({ title: "Review the operating loss and a path to break-even", rationale: "Compare gross profit with recurring operating expenses. Review pricing and direct costs to identify feasible changes toward break-even.", priority: "High", score: 3, estimatedImpact: null });
    result.recommendedAction = inventoryBuild || hasInventoryAction
      ? `1. Review pricing, direct costs, and recurring expenses to work toward break-even.\n2. ${result.recommendedAction}`
      : "Review pricing, direct costs, and recurring expenses to work toward break-even.";
  }
  // No action-level savings model is supplied by this endpoint. Observed
  // movements must never be republished as estimated action benefits.
  result.actions = actions.slice(0, 4).map((action) => ({ ...action, estimatedImpact: null }));
  return result;
}
