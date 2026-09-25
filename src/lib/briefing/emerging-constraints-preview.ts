import type { EmergingConstraint, CashSqueezeInput, MarginErosionInput } from "./emerging-constraints";

export type { CashSqueezeInput, MarginErosionInput };

export function aging(rows: Array<[string, number]>) {
  return {
    reportData: {
      rows: rows.map(([customer, overdue]) => ({
        cells: [
          { name: "Customer", value: customer },
          { name: "31-60", value: String(overdue) },
          { name: "61-90", value: "0" },
          { name: "91+", value: "0" },
        ],
      })),
    },
  };
}

export function payrollReport(values: number[]) {
  return {
    Columns: { Column: [{ ColTitle: "" }, { ColTitle: "Jul 2026" }, { ColTitle: "Aug 2026" }, { ColTitle: "Sep 2026" }] },
    Rows: {
      Row: [
        { type: "Data", ColData: [{ value: "Payroll Wages" }, ...values.map((value) => ({ value: String(value) }))] },
      ],
    },
  };
}

export function cashFlow(financing = 0) {
  return {
    Columns: { Column: [{ ColTitle: "" }, { ColTitle: "Sep 2026" }] },
    Rows: {
      Row: [
        {
          group: "FinancingActivities",
          type: "Section",
          Summary: { ColData: [{ value: "Net cash provided by financing activities" }, { value: String(financing) }] },
        },
      ],
    },
  };
}

export function buildBaseCashSqueezeInput(): CashSqueezeInput {
  return {
    periods: ["Jul 2026", "Aug 2026", "Sep 2026"],
    revenue: [100000, 95000, 85000],
    cash: [50000, 50000, 50000],
    profitAndLossDetail: payrollReport([10000, 11000, 12000]),
    agedReceivables: aging([["A", 3000], ["B", 3000], ["C", 3000]]),
    agedReceivablesPrevious: aging([["A", 2000], ["B", 2000], ["C", 2000]]),
    cashFlowStatement: cashFlow(0),
    now: "2026-09-25T12:00:00.000Z",
  };
}

export function buildWorseningCashSqueezeInput(previousConstraint: EmergingConstraint): CashSqueezeInput {
  return {
    ...buildBaseCashSqueezeInput(),
    revenue: [100000, 90000, 70000],
    agedReceivablesPrevious: aging([["A", 2000], ["B", 2000], ["C", 2000]]),
    agedReceivables: aging([["A", 5000], ["B", 5000], ["C", 5000]]),
    previousConstraint,
  };
}

export function buildStableCashSqueezeInput(previousConstraint: EmergingConstraint): CashSqueezeInput {
  return {
    ...buildBaseCashSqueezeInput(),
    previousConstraint,
  };
}

export function buildEasingCashSqueezeInput(previousConstraint: EmergingConstraint): CashSqueezeInput {
  return {
    ...buildBaseCashSqueezeInput(),
    revenue: [100000, 95000, 90000],
    agedReceivablesPrevious: aging([["A", 3000], ["B", 3000], ["C", 3000]]),
    agedReceivables: aging([["A", 3600], ["B", 3600], ["C", 3600]]),
    profitAndLossDetail: payrollReport([10000, 10500, 11025]),
    previousConstraint,
  };
}

export function buildMediumCashSqueezeInput(): CashSqueezeInput {
  return {
    ...buildBaseCashSqueezeInput(),
    cashFlowStatement: undefined,
  };
}

export function buildResolvedCashSqueezeInput(previousConstraint: EmergingConstraint): CashSqueezeInput {
  return {
    ...buildBaseCashSqueezeInput(),
    revenue: [100000, 99000, 98000],
    previousConstraint,
  };
}

export function buildConcentratedCashSqueezeInput(): CashSqueezeInput {
  return {
    ...buildBaseCashSqueezeInput(),
    agedReceivablesPrevious: aging([["A", 2000], ["B", 1000], ["C", 1000]]),
    agedReceivables: aging([["A", 8000], ["B", 1100], ["C", 1100]]),
  };
}

export function marginReport(values: number[], label = "COGS - Materials") {
  return {
    Columns: { Column: [{ ColTitle: "" }, { ColTitle: "Jul 2026" }, { ColTitle: "Aug 2026" }, { ColTitle: "Sep 2026" }] },
    Rows: {
      Row: [
        { type: "Data", ColData: [{ value: label }, ...values.map((value) => ({ value: String(value) }))] },
      ],
    },
  };
}

export function buildBaseMarginErosionInput(): MarginErosionInput {
  return {
    periods: ["Jul 2026", "Aug 2026", "Sep 2026"],
    revenue: [100000, 102000, 104000],
    grossMargin: [45, 44, 41],
    profitAndLossDetail: marginReport([55000, 57000, 61360]),
    now: "2026-09-25T12:00:00.000Z",
  };
}

export function buildWorseningMarginErosionInput(previousConstraint: EmergingConstraint): MarginErosionInput {
  return {
    ...buildBaseMarginErosionInput(),
    grossMargin: [45, 43, 36],
    profitAndLossDetail: marginReport([55000, 58000, 66560]),
    previousConstraint,
  };
}

export function buildStableMarginErosionInput(previousConstraint: EmergingConstraint): MarginErosionInput {
  return {
    ...buildBaseMarginErosionInput(),
    previousConstraint,
  };
}

export function buildEasingMarginErosionInput(previousConstraint: EmergingConstraint): MarginErosionInput {
  return {
    ...buildBaseMarginErosionInput(),
    grossMargin: [45, 44, 42],
    profitAndLossDetail: marginReport([55000, 56000, 60000]),
    previousConstraint,
  };
}

export function buildMediumMarginErosionInput(): MarginErosionInput {
  return {
    ...buildBaseMarginErosionInput(),
    profitAndLossDetail: undefined,
  };
}

export function buildOneTimeCogsMarginErosionInput(): MarginErosionInput {
  return {
    ...buildBaseMarginErosionInput(),
    profitAndLossDetail: marginReport([55000, 56000, 62000], "One-time COGS freight charge"),
  };
}

export function buildRevenueDownMarginErosionInput(): MarginErosionInput {
  return {
    ...buildBaseMarginErosionInput(),
    revenue: [100000, 92000, 88000],
  };
}
