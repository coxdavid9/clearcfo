import * as XLSX from "xlsx";
import { detectExpenseSpikeRecovery } from "../../lib/scenario-detection";

export type BriefingData = {
  companyName: string;
  revenue: number;
  revenueChange: number;
  grossMargin: number;
  marginChange: number;
  cash: number;
  cashChange: number;
  inventory: number;
  inventoryChange: number;
  attention: number;
  alerts: string[];
  recommendation: string;
  impact: number;
  impactReason: string;
  trend: number[];
  periods: string[];
  health: string;
  confidence: number;
  source: "demo" | "upload";
  drivers: FinancialDriver[];
  relationships: string[];
  detailDrivers: DetailDriver[];
  trendInsights: string[];
  trendSeries: { name: string; values: number[]; periods: string[] }[];
  unknowns: string[];
};

export type DetailDriver = {
  name: string;
  current: number;
  previous: number;
  change: number;
  percentChange: number;
  direction: "up" | "down";
  impact: number;
  contributionPct?: number;
};

export type FinancialDriver = {
  id: string;
  category: "Revenue" | "Margin" | "Cash" | "Inventory" | "Operating Expense" | "Unusual Spend" | "MRO";
  title: string;
  observation: string;
  evidence: string[];
  direction: "up" | "down" | "mixed" | "watch";
  severity: "High" | "Medium" | "Watch";
  impact: number;
  confidence: number;
  managementQuestion: string;
};

export type AIAction = {
  title: string;
  rationale: string;
  priority: "High" | "Medium" | "Watch";
  score?: number;
};

export type AIAnalysis = {
  executiveSummary: string;
  primaryDriver: string;
  whyItMatters: string;
  managementQuestion: string;
  recommendedAction: string;
  priority: "High" | "Medium" | "Watch";
  confidence: number;
  evidence: string[];
  actions: AIAction[];
  unknowns?: string[];
};

export type ExpandedMetric =
  | "revenue"
  | "margin"
  | "cash"
  | "attention"
  | null;

export const demoDrivers: FinancialDriver[] = [
  {
    id: "inventory-growth",
    category: "Inventory",
    title: "Inventory is outpacing revenue",
    observation: "Inventory has grown faster than revenue, increasing working-capital pressure.",
    evidence: ["Inventory growth: +14.2%", "Revenue growth: +12.4%", "Inventory: $587,000"],
    direction: "up",
    severity: "Medium",
    impact: 87000,
    confidence: 88,
    managementQuestion: "Which inventory categories are driving the build, and are current purchases supported by demand?",
  },
  {
    id: "opex-growth",
    category: "Operating Expense",
    title: "Operating expenses are growing faster than sales",
    observation: "Expense growth is beginning to pressure operating leverage.",
    evidence: ["Operating expense growth is above revenue growth", "Two unusual spend categories flagged"],
    direction: "up",
    severity: "Watch",
    impact: 0,
    confidence: 70,
    managementQuestion: "Which expense increases are structural and which are discretionary?",
  },
];

export const demoData: BriefingData = {
  companyName: "Summit Outdoor Equipment LLC",
  revenue: 2400000,
  revenueChange: 12.4,
  grossMargin: 31.8,
  marginChange: 2.4,
  cash: 642000,
  cashChange: 4.8,
  inventory: 587000,
  inventoryChange: 14.2,
  attention: 2,
  alerts: [
    "Inventory is growing faster than revenue, creating a potential working-capital opportunity.",
    "Operating expenses are increasing faster than revenue.",
  ],
  recommendation:
    "Review inventory purchases and the categories driving the increase before placing the next replenishment orders.",
  impact: 0,
  impactReason:
    "Based on the financial relationships identified in the analyzed history.",
  trend: [38, 44, 41, 56, 52, 63, 72, 68, 81, 76, 88, 94],
  periods: [
    "P-11",
    "P-10",
    "P-9",
    "P-8",
    "P-7",
    "P-6",
    "P-5",
    "P-4",
    "P-3",
    "P-2",
    "P-1",
    "Now",
  ],
  health: "strong",
  confidence: 78,
  source: "demo",
  drivers: demoDrivers,
  relationships: [
    "Inventory is growing faster than revenue, which can increase working-capital pressure if demand does not keep pace.",
    "Expense growth is outpacing sales growth, which may weaken operating leverage.",
  ],
  detailDrivers: [
    { name: "Inventory", current: 587000, previous: 514000, change: 73000, percentChange: 14.2, direction: "up", impact: 73000 },
    { name: "Operating Expenses", current: 386000, previous: 362000, change: 24000, percentChange: 6.6, direction: "up", impact: 24000 },
  ],
  trendInsights: [
    "Revenue has generally trended upward across the displayed periods, with some month-to-month volatility.",
    "Inventory growth is slightly ahead of revenue growth, so working capital should remain on management's watch list.",
  ],
  trendSeries: [
    { name: "Revenue", values: [1780000, 1840000, 1910000, 2020000, 2260000, 2400000], periods: ["Dec", "Jan", "Feb", "Mar", "Apr", "May"] },
    { name: "Inventory", values: [780000, 840000, 810000, 930000, 1060000, 1180000], periods: ["Dec", "Jan", "Feb", "Mar", "Apr", "May"] },
    { name: "Operating Expenses", values: [850000, 900000, 880000, 990000, 1040000, 1110000], periods: ["Dec", "Jan", "Feb", "Mar", "Apr", "May"] },
    { name: "Cash", values: [480000, 520000, 575000, 610000, 635000, 680000], periods: ["Dec", "Jan", "Feb", "Mar", "Apr", "May"] },
  ],
  unknowns: [
    "The workbook does not identify which inventory categories are driving the increase.",
    "The workbook does not establish whether the flagged expense increases are recurring or discretionary.",
  ],
};

export const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const formatPercentValue = (value: number): string => {
  const rounded = Number(value.toFixed(1));
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

export const percent = (value: number) => {
  const rounded = Number(value.toFixed(1));
  return `${rounded >= 0 ? "+" : ""}${formatPercentValue(value)}%`;
};

export const formatCurrency = (value: number): string =>
  currency.format(value);

export const normalizePercent = (value: number | null): number | null => {
  if (value === null) return null;
  if (Math.abs(value) > 0 && Math.abs(value) <= 1.5) {
    return value * 100;
  }
  return value;
};

export const formatPeriod = (value: unknown): string => {
  if (value instanceof Date) {
    return value.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
  }

  const text = String(value ?? "").trim();

  if (!text) return "";

  return text.length > 12 ? text.slice(0, 12) : text;
};

export function clean(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const text = String(value ?? "")
    .trim()
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/%/g, "")
    .replace(/^\((.*)\)$/, "-$1");

  if (!text) return 0;

  const parsed = Number(text);

  return Number.isFinite(parsed) ? parsed : 0;
}

export function asRows(
  workbook: XLSX.WorkBook,
  sheetName: string
): Record<string, unknown>[] {
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) return [];

  return XLSX.utils.sheet_to_json<Record<string, unknown>>(
    sheet,
    {
      defval: "",
    }
  );
}

export function asMatrix(
  workbook: XLSX.WorkBook,
  sheetName: string
): unknown[][] {
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) return [];

  return XLSX.utils.sheet_to_json<unknown[]>(
    sheet,
    {
      header: 1,
      defval: "",
    }
  );
}

export function findSheet(
  workbook: XLSX.WorkBook,
  aliases: string[]
): string | null {
  for (const alias of aliases) {
    const exact = workbook.SheetNames.find(
      (name) => clean(name) === clean(alias)
    );

    if (exact) return exact;
  }

  for (const alias of aliases) {
    const partial = workbook.SheetNames.find(
      (name) =>
        clean(name).includes(clean(alias))
    );

    if (partial) return partial;
  }

  return null;
}

export function findValue(
  row: Record<string, unknown>,
  aliases: string[]
): number | null {
  const keys = Object.keys(row);

  for (const alias of aliases) {
    const exact = keys.find(
      (key) => clean(key) === clean(alias)
    );

    if (exact !== undefined) {
      return toNumber(row[exact]);
    }
  }

  for (const alias of aliases) {
    const target = clean(alias);

    const partial = keys.find((key) => {
      const current = clean(key);

      return (
        current.includes(target) ||
        target.includes(current)
      );
    });

    if (partial !== undefined) {
      return toNumber(row[partial]);
    }
  }

  return null;
}

export function findCompany(
  workbook: XLSX.WorkBook,
  sheetNames: string[]
): string {
  const labels = [
    "company",
    "company name",
    "business",
    "business name",
    "organization",
    "entity",
    "legal name",
    "company legal name",
  ];

  for (const sheetName of sheetNames) {
    const matrix = asMatrix(workbook, sheetName);

    for (let r = 0; r < matrix.length; r++) {
      const row = matrix[r] ?? [];

      for (let c = 0; c < row.length; c++) {
        if (!labels.includes(clean(row[c]))) continue;

        const sameRow = row[c + 1];

        if (
          sameRow !== undefined &&
          String(sameRow).trim()
        ) {
          return String(sameRow).trim();
        }

        const nextRow = matrix[r + 1];

        if (
          nextRow &&
          nextRow[c] !== undefined &&
          String(nextRow[c]).trim()
        ) {
          return String(nextRow[c]).trim();
        }
      }
    }
  }

  // Last-resort company detection: use a clear workbook title near the top
  // when no explicit Company label exists. Avoid returning arbitrary numeric cells.
  for (const sheetName of sheetNames) {
    const matrix = asMatrix(workbook, sheetName);
    for (const row of matrix.slice(0, 8)) {
      const candidate = String(row[0] ?? "").trim();
      const value = String(row[1] ?? "").trim();
      if (candidate && value && /company|business|organization|entity/i.test(candidate)) {
        return value;
      }
    }
  }

  return "";
}

export function buildDetailDrivers(
  latest: Record<string, unknown>,
  previous: Record<string, unknown>,
  metricRows: { metric: string; values: unknown[] }[],
  isMetricRowFormat: boolean,
  latestIndex: number,
  previousIndex: number,
  excludedNames: string[]
): DetailDriver[] {
  const excluded = new Set(excludedNames.map(clean));
  const candidates = new Map<string, { current: number; previous: number }>();

  if (isMetricRowFormat) {
    for (const item of metricRows) {
      const name = item.metric.trim();
      const normalized = clean(name);
      if (!name || excluded.has(normalized)) continue;
      const current = toNumber(item.values[latestIndex]);
      const prior = toNumber(item.values[previousIndex]);
      if (current === 0 && prior === 0) continue;
      candidates.set(name, { current, previous: prior });
    }
  } else {
    const keys = new Set([...Object.keys(latest), ...Object.keys(previous)]);
    for (const key of keys) {
      const normalized = clean(key);
      if (!key || excluded.has(normalized)) continue;
      if (["month", "period", "date", "year month", "reporting period"].includes(normalized)) continue;
      const current = toNumber(latest[key]);
      const prior = toNumber(previous[key]);
      if (current === 0 && prior === 0) continue;
      candidates.set(key, { current, previous: prior });
    }
  }

  const drivers: DetailDriver[] = [];
  for (const [name, values] of candidates) {
    const change = values.current - values.previous;
    if (Math.abs(change) < 1) continue;
    const percentChange = values.previous !== 0
      ? (change / Math.abs(values.previous)) * 100
      : values.current !== 0 ? 100 : 0;
    drivers.push({
      name,
      current: values.current,
      previous: values.previous,
      change,
      percentChange,
      direction: change >= 0 ? "up" : "down",
      impact: Math.abs(change),
    });
  }

  const ranked = drivers
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 8);

  const totalImpact = ranked.reduce((sum, driver) => sum + driver.impact, 0);

  return ranked.map((driver) => ({
    ...driver,
    contributionPct: totalImpact > 0 ? (driver.impact / totalImpact) * 100 : 0,
  }));
}

export function buildTrendInsights(
  seriesMap: { name: string; values: number[]; periods: string[] }[],
  fallbackRevenueChange: number
): string[] {
  const insights: string[] = [];
  const changes = new Map<string, number>();

  for (const series of seriesMap) {
    const values = series.values;
    if (values.length < 3) continue;
    const recent = values.slice(-Math.min(6, values.length));
    const first = recent[0];
    const last = recent[recent.length - 1];
    if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) continue;
    changes.set(clean(series.name), ((last - first) / Math.abs(first)) * 100);
  }

  const revenue = changes.get("revenue");
  const opex = changes.get("operating expenses");
  const margin = changes.get("gross margin");
  const mro = changes.get("mro / repairs");
  const unusual = changes.get("unusual spend");

  if (typeof revenue === "number" && typeof opex === "number") {
    const gap = opex - revenue;
    if (gap >= 5) {
      insights.push(
        `Operating expenses are growing ${formatPercentValue(Math.abs(opex))}% across the recent periods versus ${formatPercentValue(Math.abs(revenue))}% for revenue. The widening gap suggests operating leverage is weakening.`
      );
    } else if (gap <= -5) {
      insights.push(
        `Revenue is growing ${formatPercentValue(Math.abs(revenue))}% across the recent periods while operating expenses are growing ${formatPercentValue(Math.abs(opex))}%. The business is currently gaining operating leverage.`
      );
    }
  }

  if (typeof revenue === "number" && typeof margin === "number") {
    if (margin <= -2 && revenue >= 0) {
      insights.push(
        `Gross margin has declined ${formatPercentValue(Math.abs(margin))}% across the recent periods while revenue increased ${formatPercentValue(Math.abs(revenue))}%. Growth is not fully translating into gross-profit improvement.`
      );
    } else if (margin >= 2 && revenue >= 0) {
      insights.push(
        `Gross margin has improved ${formatPercentValue(Math.abs(margin))}% while revenue increased ${formatPercentValue(Math.abs(revenue))}%. The business is generating better economics on its sales base.`
      );
    }
  }

  if (typeof mro === "number" && Math.abs(mro) >= 5) {
    insights.push(
      `MRO / Repairs changed ${mro >= 0 ? "up" : "down"} ${formatPercentValue(Math.abs(mro))}% across the recent periods. A sustained move can affect operating leverage and deserves a driver-level review.`
    );
  }

  if (typeof unusual === "number" && Math.abs(unusual) >= 5) {
    insights.push(
      `Unusual spend changed ${unusual >= 0 ? "up" : "down"} ${formatPercentValue(Math.abs(unusual))}% across the recent periods. Management should determine whether the movement is isolated or becoming recurring.`
    );
  }

  // Only fall back to a generic trend statement when the data does not support
  // Detect material one-period spikes that a simple start-to-end change can hide.
  // Prefer expense/cost spikes because they are especially useful management signals.
  if (insights.length < 3) {
    const spikeCandidates: {
      series: { name: string; values: number[]; periods: string[] };
      index: number;
      score: number;
      isExpense: boolean;
    }[] = [];

    for (const series of seriesMap) {
      const values = series.values;
      if (values.length < 3) continue;

      const isExpense = /expense|opex|spend|cost|mro/i.test(series.name);

      for (let i = 1; i < values.length - 1; i++) {
        const before = values[i - 1];
        const peak = values[i];
        const after = values[i + 1];
        if (![before, peak, after].every(Number.isFinite) || before === 0 || peak === 0) continue;

        const rise = ((peak - before) / Math.abs(before)) * 100;
        const fall = ((peak - after) / Math.abs(peak)) * 100;
        const neighborAvg = (Math.abs(before) + Math.abs(after)) / 2;
        const deviation = neighborAvg > 0
          ? ((Math.abs(peak) - neighborAvg) / neighborAvg) * 100
          : 0;

        if (rise >= 20 && fall >= 15 && deviation >= 20) {
          spikeCandidates.push({ series, index: i, score: deviation, isExpense });
        }
      }
    }

    spikeCandidates.sort((a, b) =>
      Number(b.isExpense) - Number(a.isExpense) || b.score - a.score
    );

    const candidate = spikeCandidates[0];
    if (candidate) {
      const { series, index } = candidate;
      const peak = series.values[index];
      const peakPeriod = series.periods[index] ?? 'the period';
      const endValue = series.values[series.values.length - 1];
      const endPeriod = series.periods[series.periods.length - 1] ?? 'the latest period';

      insights.push(
        `${series.name} spiked sharply in ${peakPeriod} to ${formatCurrency(peak)} before falling back to ${formatCurrency(endValue)} in ${endPeriod}. The temporary spike warrants review to determine whether it was driven by a one-time item or a recurring cost issue.`
      );
    }
  }

  // a stronger cross-metric interpretation.
  if (!insights.length) {
    for (const series of seriesMap) {
      const values = series.values;
      if (values.length < 3) continue;
      const recent = values.slice(-Math.min(6, values.length));
      const first = recent[0];
      const last = recent[recent.length - 1];
      if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) continue;

      const change = ((last - first) / Math.abs(first)) * 100;
      const diffs = recent.slice(1).map((v, i) => v - recent[i]);
      const rising = diffs.filter((v) => v > 0).length;
      const falling = diffs.filter((v) => v < 0).length;
      const span = series.periods.length >= recent.length
        ? ` from ${series.periods[series.periods.length - recent.length]} through ${series.periods[series.periods.length - 1]}`
        : "";

      if (rising >= Math.max(2, diffs.length - 1)) {
        insights.push(`${series.name} has risen consistently${span}, increasing ${formatPercentValue(Math.abs(change))}% over the displayed span.`);
      } else if (falling >= Math.max(2, diffs.length - 1)) {
        insights.push(`${series.name} has declined consistently${span}, decreasing ${formatPercentValue(Math.abs(change))}% over the displayed span.`);
      } else if (Math.abs(change) >= 5) {
        insights.push(`${series.name} is volatile across the displayed periods, with a net ${change >= 0 ? "increase" : "decrease"} of ${formatPercentValue(Math.abs(change))}%.`);
      }
      if (insights.length >= 3) break;
    }
  }

  if (!insights.length && fallbackRevenueChange !== 0) {
    insights.push(
      `Revenue changed ${formatPercentValue(Math.abs(fallbackRevenueChange))}% versus the prior period, but the available history does not support a stronger multi-period relationship.`
    );
  }

  return Array.from(new Set(insights)).slice(0, 3);
}

export function workbookContainsFinancialSignal(
  workbook: XLSX.WorkBook,
  labels: string[]
): boolean {
  const targets = labels.map(clean);

  for (const sheetName of workbook.SheetNames) {
    const matrix = asMatrix(workbook, sheetName);

    for (const row of matrix) {
      for (let index = 0; index < row.length; index++) {
        const cell = clean(row[index]);
        if (!cell || !targets.includes(cell)) continue;

        const neighbors = [row[index + 1], row[index + 2]];
        if (neighbors.some((value) => {
          const number = toNumber(value);
          return typeof value === "number" ? Number.isFinite(value) : String(value ?? "").trim() !== "" && Number.isFinite(number) && number !== 0;
        })) {
          return true;
        }

        const nextRow = matrix[matrix.indexOf(row) + 1] ?? [];
        if (nextRow[index] !== undefined) {
          const number = toNumber(nextRow[index]);
          if (Number.isFinite(number) && number !== 0) return true;
        }
      }
    }
  }

  return false;
}

export function analyzeWorkbook(
  workbook: XLSX.WorkBook
): BriefingData {
  const pnlSheetName = findSheet(
    workbook,
    [
      "Monthly P&L",
      "Monthly P and L",
      "Monthly Financials",
      "Monthly Financial Results",
      "Monthly Results",
      "Financials",
      "P&L",
      "P and L",
      "Profit and Loss",
      "Income Statement",
      "Income Stmt",
      "Financial Results",
    ]
  );

  const balanceSheetName = findSheet(
    workbook,
    [
      "Balance Sheet",
      "Balance",
      "Balance Sheet Detail",
      "Statement of Financial Position",
    ]
  );

  if (!pnlSheetName) {
    throw new Error(
      'ClearCFO could not find a usable P&L sheet. Please make sure the workbook contains "Monthly P&L", "P&L", or "Income Statement".'
    );
  }

  const pnlMatrix = asMatrix(
    workbook,
    pnlSheetName
  );

  const pnlRows = asRows(
    workbook,
    pnlSheetName
  );

  if (!pnlMatrix.length) {
    throw new Error(
      "The P&L sheet appears to be empty."
    );
  }

  const companyName = findCompany(
    workbook,
    [
      "README",
      "Read Me",
      "Company Info",
      "Company Information",
      pnlSheetName,
      ...(balanceSheetName
        ? [balanceSheetName]
        : []),
      // Also inspect the full workbook because company metadata is often
      // stored on a Monthly Financials / cover sheet rather than the P&L.
      ...workbook.SheetNames,
    ]
  );

  const revenueAliases = [
    "revenue",
    "total revenue",
    "net revenue",
    "sales",
    "total sales",
    "net sales",
    "sales revenue",
    "gross sales",
  ];

  const grossMarginAliases = [
    "gross margin",
    "gross margin %",
    "gross margin percent",
    "gross margin percentage",
  ];

  const grossProfitAliases = [
    "gross profit",
    "gross profit $",
    "gross profit dollars",
  ];

  const cogsAliases = [
    "cogs",
    "cost of goods sold",
    "cost of sales",
    "cost of revenue",
    "cost of goods",
  ];

  const operatingExpenseAliases = [
    "operating expenses",
    "operating expense",
    "operating costs",
    "opex",
    "total operating expenses",
  ];

  const mroAliases = [
    "mro",
    "mro repairs",
    "repairs",
    "maintenance",
    "maintenance repairs",
    "maintenance and repairs",
  ];

  const unusualExpenseAliases = [
    "one time unusual expense",
    "one time expense",
    "unusual expense",
    "non recurring expense",
    "non recurring expenses",
    "nonrecurring expense",
  ];

  /*
   * ------------------------------------------------------------
   * DETECT HEADER
   * ------------------------------------------------------------
   */

  const metricHeaderAliases = [
    "metric",
    "account",
    "line item",
    "line",
    "category",
    "account name",
    "description",
    "account description",
  ];

  let headerRowIndex = -1;
  let headerIndex = -1;

  for (
    let r = 0;
    r < Math.min(pnlMatrix.length, 25);
    r++
  ) {
    const row = pnlMatrix[r] ?? [];

    const index = row.findIndex(
      (value) =>
        metricHeaderAliases.includes(
          clean(value)
        )
    );

    if (index >= 0) {
      headerRowIndex = r;
      headerIndex = index;
      break;
    }
  }

  /*
   * ------------------------------------------------------------
   * METRIC-ROW FORMAT
   * ------------------------------------------------------------
   */

  const isMetricRowFormat =
    headerRowIndex >= 0 &&
    headerIndex >= 0;

  let latest: Record<string, unknown> = {};
  let previous: Record<string, unknown> = {};

  let trend: number[] = [];
  let periods: string[] = [];

  const metricRows: {
    metric: string;
    values: unknown[];
  }[] = [];

  const historicalSeries: { name: string; values: number[]; periods: string[] }[] = [];

  if (isMetricRowFormat) {
    const headerRow =
      pnlMatrix[headerRowIndex] ?? [];

    const periodColumns = headerRow
      .map((header, index) => ({
        header,
        index,
      }))
      .filter(
        ({ index, header }) =>
          index !== headerIndex &&
          String(header ?? "").trim() !== ""
      );

    for (
      const row of pnlMatrix.slice(
        headerRowIndex + 1
      )
    ) {
      const metric = String(
        row[headerIndex] ?? ""
      ).trim();

      if (!metric) continue;

      metricRows.push({
        metric,
        values: periodColumns.map(
          ({ index }) => row[index]
        ),
      });
    }

    periods = periodColumns.map(
      ({ header }) => formatPeriod(header)
    );

    const findMetricSeries = (
      aliases: string[]
    ): number[] => {
      const found = metricRows.find(
        ({ metric }) =>
          aliases.some(
            (alias) =>
              clean(alias) === clean(metric)
          )
      );

      if (!found) return [];

      return found.values.map(toNumber);
    };

    const revenueSeries =
      findMetricSeries(revenueAliases);

    trend = revenueSeries.slice(-12);

    for (const [name, aliases] of [
      ["Revenue", revenueAliases],
      ["Gross margin", grossMarginAliases],
      ["Operating expenses", operatingExpenseAliases],
      ["MRO / Repairs", mroAliases],
      ["Unusual spend", unusualExpenseAliases],
    ] as const) {
      const series = findMetricSeries(aliases);
      if (series.length >= 3) historicalSeries.push({ name, values: series.slice(-12), periods: periods.slice(-12) });
    }

    if (metricRows.length) {
      const latestIndex =
        Math.max(
          0,
          (periods.length || 1) - 1
        );

      const previousIndex =
        Math.max(
          0,
          latestIndex - 1
        );

      for (const item of metricRows) {
        latest[item.metric] =
          item.values[latestIndex];

        previous[item.metric] =
          item.values[previousIndex];
      }
    }
  }

  /*
   * ------------------------------------------------------------
   * ROW-PERIOD FORMAT
   * ------------------------------------------------------------
   */

  if (!isMetricRowFormat) {
    latest =
      pnlRows[pnlRows.length - 1] ?? {};

    previous =
      pnlRows[pnlRows.length - 2] ??
      latest;

    const periodKey = Object.keys(
      latest
    ).find((key) =>
      [
        "month",
        "period",
        "date",
        "year month",
        "reporting period",
      ].includes(clean(key))
    );

    const revenueKey = Object.keys(
      latest
    ).find((key) =>
      revenueAliases.some(
        (alias) =>
          clean(alias) === clean(key)
      )
    );

    const lastRows =
      pnlRows.slice(-12);

    trend = lastRows.map((row) =>
      revenueKey
        ? toNumber(row[revenueKey])
        : findValue(
            row,
            revenueAliases
          ) ?? 0
    );

    periods = lastRows.map(
      (row, index) => {
        if (periodKey) {
          return formatPeriod(
            row[periodKey]
          );
        }

        return `P-${lastRows.length - index}`;
      }
    );
  }

  if (!isMetricRowFormat) {
    const lastRows = pnlRows.slice(-12);
    for (const [name, aliases] of [
      ["Revenue", revenueAliases],
      ["Gross margin", grossMarginAliases],
      ["Operating expenses", operatingExpenseAliases],
      ["MRO / Repairs", mroAliases],
      ["Unusual spend", unusualExpenseAliases],
    ] as const) {
      const values = lastRows.map((row) => findValue(row, aliases) ?? 0);
      if (values.filter((value) => value !== 0).length >= 3) historicalSeries.push({ name, values, periods });
    }
  }

  const latestMetricIndex = isMetricRowFormat
    ? Math.max(0, periods.length - 1)
    : 0;
  const previousMetricIndex = isMetricRowFormat
    ? Math.max(0, latestMetricIndex - 1)
    : 0;

  /*
   * ------------------------------------------------------------
   * METRIC LOOKUP
   * ------------------------------------------------------------
   */

  const findMetricValue = (
    row: Record<string, unknown>,
    aliases: string[]
  ): number | null => {
    const direct = findValue(
      row,
      aliases
    );

    if (direct !== null) {
      return direct;
    }

    if (!isMetricRowFormat) {
      return null;
    }

    const metric = metricRows.find(
      ({ metric }) =>
        aliases.some(
          (alias) =>
            clean(alias) ===
            clean(metric)
        )
    );

    if (!metric) return null;

    const index =
      row === latest
        ? metric.values.length - 1
        : Math.max(
            0,
            metric.values.length - 2
          );

    return toNumber(
      metric.values[index]
    );
  };

  /*
   * ------------------------------------------------------------
   * P&L VALUES
   * ------------------------------------------------------------
   */

  const revenue =
    findMetricValue(
      latest,
      revenueAliases
    ) ?? 0;

  const previousRevenue =
    findMetricValue(
      previous,
      revenueAliases
    ) ?? 0;

  // Never silently present a zero dashboard when the workbook clearly
  // contains revenue data. This is a data-ingestion failure, not a valid
  // financial result, and the customer should see a useful error instead.
  const hasRevenueSignal = workbookContainsFinancialSignal(workbook, revenueAliases);

  if (revenue === 0 && hasRevenueSignal) {
    throw new Error(
      `ClearCFO found revenue data in "${pnlSheetName}" but could not normalize it. The workbook was not converted into a zero-value briefing. Please check the revenue header/value layout.`
    );
  }

  let grossMargin = normalizePercent(
    findMetricValue(
      latest,
      grossMarginAliases
    )
  );

  const previousGrossMargin = normalizePercent(
    findMetricValue(
      previous,
      grossMarginAliases
    )
  );

  const grossProfit =
    findMetricValue(
      latest,
      grossProfitAliases
    );

  const previousGrossProfit =
    findMetricValue(
      previous,
      grossProfitAliases
    );

  const cogs =
    findMetricValue(
      latest,
      cogsAliases
    );

  const previousCogs =
    findMetricValue(
      previous,
      cogsAliases
    );

  if (
    grossMargin === null ||
    grossMargin === 0
  ) {
    if (
      grossProfit !== null &&
      revenue > 0
    ) {
      grossMargin =
        (grossProfit / revenue) * 100;
    } else if (
      cogs !== null &&
      revenue > 0
    ) {
      grossMargin =
        ((revenue - cogs) / revenue) *
        100;
    } else {
      grossMargin = 0;
    }
  }

  let priorMargin =
    previousGrossMargin;

  if (
    priorMargin === null ||
    priorMargin === 0
  ) {
    if (
      previousGrossProfit !== null &&
      previousRevenue > 0
    ) {
      priorMargin =
        (previousGrossProfit /
          previousRevenue) *
        100;
    } else if (
      previousCogs !== null &&
      previousRevenue > 0
    ) {
      priorMargin =
        ((previousRevenue -
          previousCogs) /
          previousRevenue) *
        100;
    } else {
      priorMargin = grossMargin;
    }
  }

  /*
   * ------------------------------------------------------------
   * BALANCE SHEET
   * ------------------------------------------------------------
   */

  let latestBalance: Record<
    string,
    unknown
  > = {};

  let previousBalance: Record<
    string,
    unknown
  > = {};

  if (balanceSheetName) {
    const balanceRows =
      asRows(
        workbook,
        balanceSheetName
      );

    const balanceMatrix =
      asMatrix(
        workbook,
        balanceSheetName
      );

    if (balanceRows.length) {
      latestBalance =
        balanceRows[
          balanceRows.length - 1
        ] ?? {};

      previousBalance =
        balanceRows[
          balanceRows.length - 2
        ] ?? latestBalance;
    }

    if (balanceMatrix.length) {
      let balanceHeaderIndex = -1;
      let accountIndex = -1;
      let currentIndex = -1;
      let priorIndex = -1;

      for (
        let r = 0;
        r <
        Math.min(
          balanceMatrix.length,
          20
        );
        r++
      ) {
        const row =
          balanceMatrix[r] ?? [];

        const possibleAccount =
          row.findIndex(
            (value) =>
              [
                "account",
                "metric",
                "category",
                "line item",
                "account name",
              ].includes(
                clean(value)
              )
          );

        if (
          possibleAccount >= 0
        ) {
          balanceHeaderIndex =
            r;

          accountIndex =
            possibleAccount;

          currentIndex =
            row.findIndex(
              (value) =>
                [
                  "current",
                  "current period",
                  "latest",
                  "balance",
                  "current balance",
                ].includes(
                  clean(value)
                )
            );

          priorIndex =
            row.findIndex(
              (value) =>
                [
                  "prior",
                  "prior period",
                  "previous",
                  "prior balance",
                ].includes(
                  clean(value)
                )
            );

          break;
        }
      }

      if (
        balanceHeaderIndex >= 0 &&
        accountIndex >= 0 &&
        currentIndex >= 0
      ) {
        latestBalance = {};
        previousBalance = {};

        for (
          const row of balanceMatrix.slice(
            balanceHeaderIndex + 1
          )
        ) {
          const account =
            String(
              row[accountIndex] ?? ""
            ).trim();

          if (!account) continue;

          latestBalance[account] =
            row[currentIndex];

          previousBalance[account] =
            priorIndex >= 0
              ? row[priorIndex]
              : row[currentIndex];
        }
      }
    }
  }

  const cashAliases = [
    "cash",
    "cash position",
    "cash balance",
    "cash on hand",
    "cash and equivalents",
    "cash equivalents",
    "cash and cash equivalents",
    "cash & equivalents",
    "cash & cash equivalents",
  ];

  const inventoryAliases = [
    "inventory",
    "inventory asset",
    "inventory balance",
    "inventory position",
    "total inventory",
  ];

  // Uploaded workbooks can store cash and inventory history on a separate Balance Sheet.
  // Add that history to the same trend-series pipeline used by the P&L metrics.
  if (balanceSheetName) {
    const balanceMatrix = asMatrix(workbook, balanceSheetName);
    const balanceRows = asRows(workbook, balanceSheetName);
    const addTrendSeries = (name: string, aliases: string[], values: number[], seriesPeriods: string[]) => {
      if (historicalSeries.some((series) => clean(series.name) === clean(name))) return;
      if (values.filter((value) => Number.isFinite(value) && value !== 0).length < 3) return;
      historicalSeries.push({ name, values: values.slice(-12), periods: seriesPeriods.slice(-12) });
    };
    let headerIndex = -1;
    let accountIndex = -1;
    for (let r = 0; r < Math.min(balanceMatrix.length, 25); r++) {
      const row = balanceMatrix[r] ?? [];
      const index = row.findIndex((value) => ["account", "metric", "category", "line item", "account name", "description"].includes(clean(value)));
      if (index >= 0) { headerIndex = r; accountIndex = index; break; }
    }
    if (headerIndex >= 0 && accountIndex >= 0) {
      const header = balanceMatrix[headerIndex] ?? [];
      const columns = header.map((value, index) => ({ value, index })).filter(({ index, value }) => index !== accountIndex && String(value ?? "").trim() !== "");
      const seriesPeriods = columns.map(({ value }) => formatPeriod(value));
      const metricSeries = (aliases: string[]) => {
        const row = balanceMatrix.slice(headerIndex + 1).find((candidate) => aliases.some((alias) => clean(alias) === clean(candidate[accountIndex])));
        return row ? columns.map(({ index }) => toNumber(row[index])) : [];
      };
      addTrendSeries("Cash", cashAliases, metricSeries(cashAliases), seriesPeriods);
      addTrendSeries("Inventory", inventoryAliases, metricSeries(inventoryAliases), seriesPeriods);
    } else if (balanceRows.length >= 3) {
      const periodKey = Object.keys(balanceRows[0] ?? {}).find((key) => ["month", "period", "date", "year month", "reporting period"].includes(clean(key)));
      const rows = balanceRows.slice(-12);
      const seriesPeriods = rows.map((row, index) => periodKey ? formatPeriod(row[periodKey]) : `P-${rows.length - index}`);
      addTrendSeries("Cash", cashAliases, rows.map((row) => findValue(row, cashAliases) ?? 0), seriesPeriods);
      addTrendSeries("Inventory", inventoryAliases, rows.map((row) => findValue(row, inventoryAliases) ?? 0), seriesPeriods);
    }
  }

  if (isMetricRowFormat) {
    const addMetricTrend = (name: string, aliases: string[]) => {
      if (historicalSeries.some((series) => clean(series.name) === clean(name))) return;
      const found = metricRows.find(({ metric }) => {
        const normalizedMetric = clean(metric);
        return aliases.some((alias) => {
          const normalizedAlias = clean(alias);
          return normalizedMetric === normalizedAlias ||
            normalizedMetric.includes(normalizedAlias) ||
            normalizedAlias.includes(normalizedMetric);
        });
      });
      if (!found) return;
      const values = found.values.map(toNumber);
      if (values.filter((value) => Number.isFinite(value) && value !== 0).length < 3) return;
      historicalSeries.push({ name, values: values.slice(-12), periods: periods.slice(-12) });
    };
    addMetricTrend("Cash", cashAliases);
    addMetricTrend("Inventory", inventoryAliases);
  }

  // Final core metric trend recovery: use the actual Financials metric rows when
  // normalized metricRows omitted a balance-sheet series. This never invents values.
  if (historicalSeries.length > 0) {
    const sourceSheet = findSheet(workbook, ["Financials", "Financial Statements", "P&L", "Profit and Loss"]);
    if (sourceSheet) {
      const sourceMatrix = asMatrix(workbook, sourceSheet);
      let sourceHeader = -1;
      let sourceMetricIndex = -1;
      for (let r = 0; r < Math.min(sourceMatrix.length, 30); r++) {
        const row = sourceMatrix[r] ?? [];
        const idx = row.findIndex((value) =>
          ["metric", "account", "line item", "account name", "description"].includes(clean(value))
        );
        if (idx >= 0) { sourceHeader = r; sourceMetricIndex = idx; break; }
      }
      if (sourceHeader >= 0 && sourceMetricIndex >= 0) {
        const header = sourceMatrix[sourceHeader] ?? [];
        const columns = header
          .map((value, index) => ({ value, index }))
          .filter(({ index, value }) => index !== sourceMetricIndex && String(value ?? "").trim() !== "");
        const addSourceTrend = (name: string, aliases: string[]) => {
          if (historicalSeries.some((series) => clean(series.name) === clean(name))) return;
          const row = sourceMatrix.slice(sourceHeader + 1).find((candidate) => {
            const metric = clean(candidate[sourceMetricIndex]);
            return aliases.some((alias) => {
              const target = clean(alias);
              return metric === target || metric.includes(target) || target.includes(metric);
            });
          });
          if (!row) return;
          const values = columns.map(({ index }) => toNumber(row[index]));
          if (values.filter((value) => Number.isFinite(value) && value !== 0).length < 3) return;
          historicalSeries.push({
            name,
            values: values.slice(-12),
            periods: columns.map(({ value }) => formatPeriod(value)).slice(-12),
          });
        };
        addSourceTrend("Inventory", inventoryAliases);
        addSourceTrend("Cash", cashAliases);
      }
    }
  }

  // Cross-sheet inventory recovery: workbooks may keep inventory history on a
  // dedicated sheet (for example "Inventory_Summary") rather than on a sheet
  // named like a Balance Sheet. Scan every sheet for an inventory metric row
  // when no Inventory series has been found yet. This never invents values.
  if (!historicalSeries.some((series) => clean(series.name) === "inventory")) {
    for (const sheetName of workbook.SheetNames) {
      if (historicalSeries.some((series) => clean(series.name) === "inventory")) break;
      const sheetMatrix = asMatrix(workbook, sheetName);
      let sheetHeaderRow = -1;
      let sheetMetricIndex = -1;
      for (let r = 0; r < Math.min(sheetMatrix.length, 25); r++) {
        const row = sheetMatrix[r] ?? [];
        const idx = row.findIndex((value) => metricHeaderAliases.includes(clean(value)));
        if (idx >= 0) { sheetHeaderRow = r; sheetMetricIndex = idx; break; }
      }
      if (sheetHeaderRow < 0 || sheetMetricIndex < 0) continue;
      const sheetHeader = sheetMatrix[sheetHeaderRow] ?? [];
      const sheetColumns = sheetHeader
        .map((value, index) => ({ value, index }))
        .filter(({ index, value }) => index !== sheetMetricIndex && String(value ?? "").trim() !== "");
      if (sheetColumns.length < 3) continue;
      const inventoryRow = sheetMatrix.slice(sheetHeaderRow + 1).find((candidate) => {
        const metric = clean(candidate[sheetMetricIndex]);
        return inventoryAliases.some((alias) => {
          const target = clean(alias);
          return metric === target || metric.includes(target) || target.includes(metric);
        });
      });
      if (!inventoryRow) continue;
      const inventoryValues = sheetColumns.map(({ index }) => toNumber(inventoryRow[index]));
      if (inventoryValues.filter((value) => Number.isFinite(value) && value !== 0).length < 3) continue;
      historicalSeries.push({
        name: "Inventory",
        values: inventoryValues.slice(-12),
        periods: sheetColumns.map(({ value }) => formatPeriod(value)).slice(-12),
      });
    }
  }

  const coreTrendOrder = ["Revenue", "Inventory", "Operating Expenses", "Cash"];
  historicalSeries.sort((a, b) => {
    const ai = coreTrendOrder.indexOf(a.name);
    const bi = coreTrendOrder.indexOf(b.name);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return 0;
  });


    /*
   * Cash and inventory may exist either on a dedicated Balance Sheet
   * or directly on the Financials / P&L sheet.
   *
   * Prefer the Balance Sheet when available, but fall back to the
   * metric-row Financials data when no separate Balance Sheet exists.
   */

  const cashFromBalanceSheet =
    findValue(
      latestBalance,
      cashAliases
    );

  const previousCashFromBalanceSheet =
    findValue(
      previousBalance,
      cashAliases
    );

  const inventoryFromBalanceSheet =
    findValue(
      latestBalance,
      inventoryAliases
    );

  const previousInventoryFromBalanceSheet =
    findValue(
      previousBalance,
      inventoryAliases
    );

  const cashFromFinancials =
    isMetricRowFormat
      ? findMetricValue(
          latest,
          cashAliases
        )
      : null;

  const previousCashFromFinancials =
    isMetricRowFormat
      ? findMetricValue(
          previous,
          cashAliases
        )
      : null;

  const inventoryFromFinancials =
    isMetricRowFormat
      ? findMetricValue(
          latest,
          inventoryAliases
        )
      : null;

  const previousInventoryFromFinancials =
    isMetricRowFormat
      ? findMetricValue(
          previous,
          inventoryAliases
        )
      : null;

  const cash =
    cashFromBalanceSheet ??
    cashFromFinancials ??
    0;

  const previousCash =
    previousCashFromBalanceSheet ??
    previousCashFromFinancials ??
    cash;

  const inventoryTrendSeries =
    historicalSeries.find(
      (series) =>
        clean(series.name) ===
        "inventory"
    );
  const inventoryFromTrend =
    inventoryTrendSeries &&
    inventoryTrendSeries.values
      .length >= 2
      ? inventoryTrendSeries
          .values[
          inventoryTrendSeries
            .values.length -
            1
        ]
      : null;
  const previousInventoryFromTrend =
    inventoryTrendSeries &&
    inventoryTrendSeries.values
      .length >= 2
      ? inventoryTrendSeries
          .values[
          inventoryTrendSeries
            .values.length -
            2
        ]
      : null;

  const inventory =
    inventoryFromBalanceSheet ??
    inventoryFromFinancials ??
    inventoryFromTrend ??
    0;

  const previousInventory =
    previousInventoryFromBalanceSheet ??
    previousInventoryFromFinancials ??
    previousInventoryFromTrend ??
    inventory;

  const hasCashSignal = workbookContainsFinancialSignal(workbook, cashAliases);
  const hasInventorySignal = workbookContainsFinancialSignal(workbook, inventoryAliases);

  if (cash === 0 && hasCashSignal) {
    throw new Error(
      `ClearCFO found cash data in "${balanceSheetName ?? "the workbook"}" but could not normalize it. The workbook was not converted into a zero-value cash position.`
    );
  }

  if (inventory === 0 && hasInventorySignal) {
    throw new Error(
      `ClearCFO found inventory data in "${balanceSheetName ?? "the workbook"}" but could not normalize it. The workbook was not converted into a zero-value inventory balance.`
    );
  }

  /*
   * ------------------------------------------------------------
   * CHANGES
   * ------------------------------------------------------------
   */

  const revenueChange =
    previousRevenue !== 0
      ? ((revenue -
          previousRevenue) /
          Math.abs(previousRevenue)) *
        100
      : 0;

  const marginChange =
    grossMargin -
    (priorMargin ?? grossMargin);

  const inventoryChange =
    previousInventory !== 0
      ? ((inventory -
          previousInventory) /
          Math.abs(
            previousInventory
          )) *
        100
      : 0;

  const cashChange =
    previousCash !== 0
      ? ((cash -
          previousCash) /
          Math.abs(previousCash)) *
        100
      : 0;

  /*
   * ------------------------------------------------------------
   * EXPENSES
   * ------------------------------------------------------------
   */

  const operatingExpenses =
    findMetricValue(
      latest,
      operatingExpenseAliases
    ) ?? 0;

  const previousOperatingExpenses =
    findMetricValue(
      previous,
      operatingExpenseAliases
    ) ?? operatingExpenses;

  const operatingExpenseChange =
    previousOperatingExpenses !== 0
      ? ((operatingExpenses -
          previousOperatingExpenses) /
          Math.abs(
            previousOperatingExpenses
          )) *
        100
      : 0;

  const latestMro =
    findMetricValue(
      latest,
      mroAliases
    ) ?? 0;

  const priorMro =
    findMetricValue(
      previous,
      mroAliases
    ) ?? latestMro;

  const unusualExpense =
    findMetricValue(
      latest,
      unusualExpenseAliases
    ) ?? 0;

  /*
   * ------------------------------------------------------------
   * ALERTS
   * ------------------------------------------------------------
   */

  const alerts: string[] = [];

  const priorities: {
    level:
      | "high"
      | "medium"
      | "watch";
    message: string;
  }[] = [];

  if (
    inventory > 0 &&
    inventoryChange > 0 &&
    inventoryChange >
      revenueChange + 3
  ) {
    const message =
      `Inventory is growing ${formatPercentValue(inventoryChange)}% while revenue is changing ${formatPercentValue(revenueChange)}%.`;

    alerts.push(message);

    priorities.push({
      level:
        inventoryChange -
          revenueChange >=
        8
          ? "high"
          : "medium",
      message,
    });
  }

  if (marginChange < -1) {
    const message =
      `Gross margin declined ${Math.abs(
        marginChange
      ).toFixed(
        1
      )} points from the prior period.`;

    alerts.push(message);

    priorities.push({
      level:
        marginChange <= -3
          ? "high"
          : "medium",
      message,
    });
  }

  if (cashChange < -5) {
    const message =
      `Cash declined ${formatPercentValue(Math.abs(
        cashChange
      ))}% from the prior period.`;

    alerts.push(message);

    priorities.push({
      level:
        cashChange <= -10
          ? "high"
          : "medium",
      message,
    });
  }

  if (
    operatingExpenseChange >
      revenueChange + 3 &&
    operatingExpenseChange > 5
  ) {
    const message =
      `Operating expenses increased ${formatPercentValue(operatingExpenseChange)}% while revenue changed ${formatPercentValue(revenueChange)}%.`;

    alerts.push(message);

    priorities.push({
      level:
        operatingExpenseChange -
          revenueChange >=
        8
          ? "high"
          : "medium",
      message,
    });
  }

  if (
    priorMro > 0 &&
    latestMro > priorMro * 1.25
  ) {
    const message =
      "MRO / Repairs is showing a material period-over-period spike.";

    alerts.push(message);

    priorities.push({
      level: "medium",
      message,
    });
  }

  if (
    unusualExpense > 0
  ) {
    const message =
      `A ${formatCurrency(
        unusualExpense
      )} unusual or one-time expense was detected.`;

    alerts.push(message);

    priorities.push({
      level:
        revenue > 0 &&
        unusualExpense >
          revenue * 0.1
          ? "high"
          : "medium",
      message,
    });
  }

  /*
   * ------------------------------------------------------------
   * PRIORITY
   * ------------------------------------------------------------
   */

  const priorityOrder = {
    high: 3,
    medium: 2,
    watch: 1,
  };

  priorities.sort(
    (a, b) =>
      priorityOrder[b.level] -
      priorityOrder[a.level]
  );

  /*
   * ------------------------------------------------------------
   * ESTIMATED IMPACT
   * ------------------------------------------------------------
   *
   * This is now based on the actual variance
   * identified in the workbook.
   * ------------------------------------------------------------
   */

  let estimatedImpact = 0;
  let impactReason =
    "No material financial opportunity was quantified from the detected variance.";

  if (
    inventoryChange > 0 &&
    inventoryChange >
      revenueChange + 3 &&
    inventory > 0 &&
    previousInventory > 0
  ) {
    const excessInventory =
      Math.max(
        0,
        inventory -
          previousInventory
      );

    estimatedImpact =
      Math.round(
        excessInventory
      );

    if (estimatedImpact > 0) {
      impactReason =
        `Based on ${formatCurrency(
          estimatedImpact
        )} of inventory growth versus the prior period.`;
    }
  }

  if (
    estimatedImpact === 0 &&
    cashChange < -5
  ) {
    estimatedImpact =
      Math.round(
        Math.max(
          0,
          previousCash - cash
        )
      );

    if (estimatedImpact > 0) {
      impactReason =
        `Based on a ${formatCurrency(
          estimatedImpact
        )} period-over-period decline in cash.`;
    }
  }

  if (
    estimatedImpact === 0 &&
    unusualExpense > 0
  ) {
    estimatedImpact =
      Math.round(
        unusualExpense
      );

    if (estimatedImpact > 0) {
      impactReason =
        `Based on the ${formatCurrency(
          estimatedImpact
        )} unusual or one-time expense detected in the period.`;
    }
  }

  /*
   * ------------------------------------------------------------
   * RECOMMENDATION
   * ------------------------------------------------------------
   */

  let recommendation =
    "Continue monitoring the business trend and investigate the highest-variance financial categories.";

  if (
    inventoryChange > 0 &&
    inventoryChange >
      revenueChange + 3
  ) {
    recommendation =
      "Slow inventory purchases and review the categories driving inventory growth before placing the next replenishment orders.";
  } else if (
    marginChange < -1
  ) {
    recommendation =
      "Review material, labor, pricing, and product-mix drivers behind the margin decline before making the next pricing or purchasing decision.";
  } else if (
    cashChange < -5
  ) {
    recommendation =
      "Review cash drivers, collections, inventory commitments, and upcoming payments to protect near-term liquidity.";
  } else if (
    operatingExpenseChange >
      revenueChange + 3
  ) {
    recommendation =
      "Review the fastest-growing operating expense categories and determine which increases are necessary versus discretionary.";
  } else if (
    unusualExpense > 0
  ) {
    recommendation =
      "Review the unusual expense separately from recurring operating performance so it does not obscure the underlying business trend.";
  }

  /*
   * ------------------------------------------------------------
   * HEALTH
   * ------------------------------------------------------------
   */

  const highImpactCount =
    priorities.filter(
      (item) =>
        item.level === "high"
    ).length;

  let health = "strong";

  /*
   * ------------------------------------------------------------
   * FINANCIAL DRIVERS
   * ------------------------------------------------------------
   * Drivers are the bridge between raw KPIs and AI reasoning.
   * They describe the strongest observable financial relationships
   * without pretending that correlation proves causation.
   */

  const drivers: FinancialDriver[] = [];

  if (inventory > 0 && previousInventory > 0 && inventoryChange >= 15 && inventoryChange > revenueChange + 3) {
    const inventoryImpact = Math.max(0, Math.round(inventory - previousInventory));
    drivers.push({
      id: "inventory-growth",
      category: "Inventory",
      title: "Inventory is outpacing revenue",
      observation: `Inventory increased ${formatPercentValue(inventoryChange)}% while revenue changed ${formatPercentValue(revenueChange)}%.`,
      evidence: [
        `Inventory growth: ${percent(inventoryChange)}`,
        `Revenue change: ${percent(revenueChange)}`,
        `Current inventory: ${formatCurrency(inventory)}`,
      ],
      direction: "up",
      severity: inventoryChange - revenueChange >= 8 ? "High" : "Medium",
      impact: inventoryImpact,
      confidence: 92,
      managementQuestion: "Which inventory categories are driving the build, and are current purchases supported by demand?",
    });
  }

  if (marginChange < -1) {
    drivers.push({
      id: "margin-compression",
      category: "Margin",
      title: "Gross margin is compressing",
      observation: `Gross margin declined ${Math.abs(marginChange).toFixed(1)} points from the prior period.`,
      evidence: [
        `Current gross margin: ${formatPercentValue(grossMargin)}%`,
        `Margin change: ${marginChange.toFixed(1)} points`,
        `Revenue change: ${percent(revenueChange)}`,
      ],
      direction: "down",
      severity: marginChange <= -3 ? "High" : "Medium",
      impact: Math.max(0, Math.round(Math.abs(marginChange) * Math.max(revenue, 0) / 100)),
      confidence: 94,
      managementQuestion: "Is the margin decline being driven by pricing, material costs, labor, mix, or another operating factor?",
    });
  }

  if (cashChange < -5) {
    const cashImpact = Math.max(0, Math.round(previousCash - cash));
    drivers.push({
      id: "cash-decline",
      category: "Cash",
      title: "Cash is declining",
      observation: `Cash declined ${formatPercentValue(Math.abs(cashChange))}% from the prior period.`,
      evidence: [
        `Current cash: ${formatCurrency(cash)}`,
        `Cash change: ${percent(cashChange)}`,
        `Cash movement: ${formatCurrency(cashImpact)}`,
      ],
      direction: "down",
      severity: cashChange <= -10 ? "High" : "Medium",
      impact: cashImpact,
      confidence: 96,
      managementQuestion: "What combination of collections, inventory, purchasing, and upcoming payments is driving the cash movement?",
    });
  }

  if (operatingExpenseChange > revenueChange + 3 && operatingExpenseChange > 5) {
    drivers.push({
      id: "opex-growth",
      category: "Operating Expense",
      title: "Operating expenses are growing faster than revenue",
      observation: `Operating expenses increased ${formatPercentValue(operatingExpenseChange)}% while revenue changed ${formatPercentValue(revenueChange)}%.`,
      evidence: [
        `Operating expense growth: ${percent(operatingExpenseChange)}`,
        `Revenue change: ${percent(revenueChange)}`,
      ],
      direction: "up",
      severity: operatingExpenseChange - revenueChange >= 8 ? "High" : "Medium",
      impact: Math.max(0, Math.round(Math.abs(operatingExpenses - previousOperatingExpenses))),
      confidence: 90,
      managementQuestion: "Which expense categories are driving the increase, and which increases are discretionary?",
    });
  }

  if (priorMro > 0 && latestMro > priorMro * 1.25) {
    const mroImpact = Math.max(0, Math.round(latestMro - priorMro));
    drivers.push({
      id: "mro-spike",
      category: "MRO",
      title: "MRO / repairs spending is spiking",
      observation: "MRO / Repairs is materially higher than the prior period.",
      evidence: [
        `Current MRO / Repairs: ${formatCurrency(latestMro)}`,
        `Prior MRO / Repairs: ${formatCurrency(priorMro)}`,
        `Increase: ${formatCurrency(mroImpact)}`,
      ],
      direction: "up",
      severity: "Medium",
      impact: mroImpact,
      confidence: 86,
      managementQuestion: "Is the MRO increase tied to a planned event, downtime, or a recurring maintenance problem?",
    });
  }

  if (unusualExpense > 0) {
    drivers.push({
      id: "unusual-spend",
      category: "Unusual Spend",
      title: "Unusual or one-time spending was detected",
      observation: `A ${formatCurrency(unusualExpense)} unusual or one-time expense was detected.`,
      evidence: [
        `Unusual expense: ${formatCurrency(unusualExpense)}`,
        `Revenue base: ${formatCurrency(revenue)}`,
      ],
      direction: "watch",
      severity: revenue > 0 && unusualExpense > revenue * 0.1 ? "High" : "Medium",
      impact: Math.round(unusualExpense),
      confidence: 91,
      managementQuestion: "Is this spend truly non-recurring, or is it likely to repeat in future periods?",
    });
  }

  // Detect historical operating-expense spikes — single-period spikes and
  // multi-period plateaus — even when the latest period has normalized or a
  // separate current-period opex-growth driver already exists. The spike
  // pattern is diagnosed on its own terms, distinct from revenue movement.
  //
  // Detection runs on the full-length operating-expense history, not the
  // display-truncated 12-period slice: a spike that began more than 12
  // periods ago (with recovery since) would otherwise be invisible.
  const expenseSeries = historicalSeries.find(
    (series) => clean(series.name) === "operating expenses"
  );
  let expenseValues: number[] = expenseSeries?.values ?? [];
  let expensePeriodLabels: string[] = expenseSeries?.periods ?? [];
  if (isMetricRowFormat) {
    const fullExpenseRow = metricRows.find(({ metric }) =>
      operatingExpenseAliases.some((alias) => clean(alias) === clean(metric))
    );
    if (fullExpenseRow && fullExpenseRow.values.length >= 4) {
      expenseValues = fullExpenseRow.values.map(toNumber);
      expensePeriodLabels = periods;
    }
  }

  if (expenseValues.length >= 4) {
    const detection = detectExpenseSpikeRecovery(expenseValues);

    if (detection) {
      const spikePeriod = expensePeriodLabels[detection.index] || "a prior period";
      const spikeImpact = Math.max(0, Math.round(detection.excess));
      const windowLabel = detection.length > 1 ? ` over ${detection.length} periods` : "";
      const severityLevel = spikeImpact >= Math.max(25000, revenue * 0.05) ? "High" : "Medium";
      drivers.push({
        id: "historical-opex-spike",
        category: "Unusual Spend",
        title: detection.length > 1
          ? `Operating expense spike${windowLabel}, then recovered`
          : "A one-period operating expense spike was detected",
        observation: `Operating expenses spiked to ${formatCurrency(detection.peak)} in ${spikePeriod}${windowLabel}, then returned near the surrounding-period baseline of ${formatCurrency(detection.baseline)}.`,
        evidence: [
          `Spike period: ${spikePeriod}${windowLabel}`,
          `Peak operating expenses: ${formatCurrency(detection.peak)}`,
          `Estimated excess versus surrounding periods: ${formatCurrency(spikeImpact)}`,
        ],
        direction: "up",
        severity: severityLevel,
        impact: spikeImpact,
        confidence: 94,
        managementQuestion: "What caused the operating expense spike, and was it truly non-recurring?",
      });
      alerts.push(`An operating expense spike was detected in ${spikePeriod} and has since recovered.`);
      priorities.push({ level: severityLevel === "High" ? "high" : "medium", message: `An operating expense spike was detected in ${spikePeriod} and has since recovered.` });
    }
  }

  /*
   * ------------------------------------------------------------
   * MULTI-PERIOD CONTEXT DRIVERS
   * ------------------------------------------------------------
   * Current-period changes are useful, but they can hide a sustained
   * trend. Add longer-horizon context so ClearCFO does not mistake a
   * one-month movement for the whole financial story.
   */

  const revenueTrendSeries = historicalSeries.find(
    (series) => clean(series.name) === "revenue"
  );
  const marginTrendSeries = historicalSeries.find(
    (series) => clean(series.name) === "gross margin"
  );
  const cashTrendSeries = historicalSeries.find(
    (series) => clean(series.name) === "cash"
  );

  const firstFinite = (values: number[]): number | null => {
    const value = values.find((item) => Number.isFinite(item));
    return value ?? null;
  };

  const multiPeriodChange = (values: number[]): number => {
    if (values.length < 3) return 0;
    const start = firstFinite(values);
    const end = [...values].reverse().find((item) => Number.isFinite(item));
    if (start === null || end === undefined || start === 0) return 0;
    return ((end - start) / Math.abs(start)) * 100;
  };

  const multiPeriodRevenueChange = revenueTrendSeries
    ? multiPeriodChange(revenueTrendSeries.values)
    : 0;

  const multiPeriodCashChange = cashTrendSeries
    ? multiPeriodChange(cashTrendSeries.values)
    : 0;

  const multiPeriodMarginChange =
    marginTrendSeries && marginTrendSeries.values.length >= 3
      ? marginTrendSeries.values[marginTrendSeries.values.length - 1] -
        marginTrendSeries.values[0]
      : 0;

  /*
   * Sustained revenue decline should compete with short-term liquidity
   * movements when the margin is broadly stable. This keeps a revenue
   * problem from being incorrectly labeled as a cash problem.
   */
  if (
    revenueTrendSeries &&
    Math.abs(multiPeriodRevenueChange) >= 8 &&
    multiPeriodRevenueChange < 0 &&
    Math.abs(multiPeriodMarginChange) < 2
  ) {
    const existingRevenueTrend = drivers.find(
      (driver) => driver.id === "revenue-trend-no-driver"
    );

    const hasCompetingOperatingDriver = drivers.some(
      (driver) =>
        driver.id === "inventory-growth" ||
        driver.id === "margin-compression" ||
        driver.id === "opex-growth" ||
        driver.id === "mro-spike" ||
        driver.id === "unusual-spend" ||
        driver.id === "historical-opex-spike"
    );

    if (!existingRevenueTrend && !hasCompetingOperatingDriver) {
      drivers.push({
        id: "revenue-trend-no-driver",
        category: "Revenue",
        title: "Revenue is trending downward without a proven operating driver",
        observation: `Revenue declined ${formatPercentValue(Math.abs(multiPeriodRevenueChange))}% across the displayed periods while gross margin remained broadly stable.`,
        evidence: [
          `Multi-period revenue change: ${percent(multiPeriodRevenueChange)}`,
          `Current-period revenue change: ${percent(revenueChange)}`,
          `Multi-period margin change: ${multiPeriodMarginChange.toFixed(1)} points`,
        ],
        direction: "down",
        severity: Math.abs(multiPeriodRevenueChange) >= 12 ? "High" : "Medium",
        impact: Math.max(0, Math.round(Math.abs(
          (revenueTrendSeries.values[0] ?? revenue) -
          (revenueTrendSeries.values.at(-1) ?? revenue)
        ))),
        confidence: 93,
        managementQuestion: "Which customers, products, pricing changes, or volume changes explain the revenue decline?",
      });
    }
  }

  /*
   * Sustained margin compression is more important than a small
   * month-to-month movement when several periods show deterioration.
   */
  if (
    marginTrendSeries &&
    marginTrendSeries.values.length >= 3 &&
    multiPeriodMarginChange <= -3
  ) {
    const existingMarginTrend = drivers.find(
      (driver) => driver.id === "multi-period-margin-compression"
    );

    if (!existingMarginTrend) {
      drivers.push({
        id: "multi-period-margin-compression",
        category: "Margin",
        title: "Gross margin has deteriorated across the displayed periods",
        observation: `Gross margin declined ${Math.abs(multiPeriodMarginChange).toFixed(1)} points from the first to latest displayed period.`,
        evidence: [
          `Multi-period margin change: ${multiPeriodMarginChange.toFixed(1)} points`,
          `Current gross margin: ${formatPercentValue(grossMargin)}%`,
          `Current-period margin change: ${marginChange.toFixed(1)} points`,
        ],
        direction: "down",
        severity: Math.abs(multiPeriodMarginChange) >= 4 ? "High" : "Medium",
        impact: Math.max(0, Math.round(
          Math.abs(multiPeriodMarginChange) * Math.max(revenue, 0) / 100
        )),
        confidence: 97,
        managementQuestion: "What has changed in pricing, material costs, labor, mix, or product economics over the period?",
      });
    }
  }

  /*
   * Sustained cash deterioration should outrank a related inventory
   * signal when the liquidity problem itself is the dominant observation.
   */
  const hasStrongInventoryDriver = drivers.some(
    (driver) => driver.id === "inventory-growth"
  );

  if (
    cashTrendSeries &&
    multiPeriodCashChange <= -12 &&
    !(hasStrongInventoryDriver && multiPeriodRevenueChange <= -8)
  ) {
    const existingCashTrend = drivers.find(
      (driver) => driver.id === "multi-period-cash-deterioration"
    );

    if (!existingCashTrend) {
      drivers.push({
        id: "multi-period-cash-deterioration",
        category: "Cash",
        title: "Cash has deteriorated materially across the displayed periods",
        observation: `Cash declined ${formatPercentValue(Math.abs(multiPeriodCashChange))}% from the first to latest displayed period.`,
        evidence: [
          `Multi-period cash change: ${percent(multiPeriodCashChange)}`,
          `Current cash: ${formatCurrency(cash)}`,
          `Current-period cash change: ${percent(cashChange)}`,
        ],
        direction: "down",
        severity: multiPeriodCashChange <= -20 ? "High" : "Medium",
        impact: Math.max(0, Math.round(
          Math.abs((cashTrendSeries.values[0] ?? cash) - (cashTrendSeries.values.at(-1) ?? cash))
        )),
        confidence: 98,
        managementQuestion: "What combination of collections, inventory, purchasing, financing, and upcoming payments is driving the sustained cash deterioration?",
      });
    }
  }

  if (drivers.length === 0) {
    const revenueTrend = historicalSeries.find(
      (series) => clean(series.name) === "revenue"
    );
    const trendStart = revenueTrend?.values[0] ?? revenue;
    const trendEnd = revenueTrend?.values.at(-1) ?? revenue;
    const multiPeriodRevenueChange =
      trendStart !== 0
        ? ((trendEnd - trendStart) / Math.abs(trendStart)) * 100
        : 0;

    if (Math.abs(multiPeriodRevenueChange) >= 5) {
      drivers.push({
        id: "revenue-trend-no-driver",
        category: "Revenue",
        title: `Revenue is ${multiPeriodRevenueChange >= 0 ? "trending upward" : "trending downward"} without a proven operating driver`,
        observation: `Revenue changed ${formatPercentValue(Math.abs(multiPeriodRevenueChange))}% across the displayed periods, but the workbook does not contain enough operating detail to establish what is driving the trend.`,
        evidence: [
          `Multi-period revenue change: ${percent(multiPeriodRevenueChange)}`,
          `Latest-period revenue change: ${percent(revenueChange)}`,
          `Displayed periods: ${historicalSeries.find((series) => clean(series.name) === "revenue")?.values.length ?? trend.length}`,
        ],
        direction: multiPeriodRevenueChange >= 0 ? "up" : "down",
        severity: "Watch",
        impact: 0,
        confidence: 65,
        managementQuestion: "Which customers, products, pricing changes, or operating events explain the revenue trend?",
      });
    } else {
      drivers.push({
        id: "stable-trend",
        category: "Revenue",
        title: "No dominant financial driver detected",
        observation: "The supplied data does not show a material exception that clearly dominates the current period.",
        evidence: [
          `Revenue change: ${percent(revenueChange)}`,
          `Gross margin: ${formatPercentValue(grossMargin)}%`,
          `Cash change: ${percent(cashChange)}`,
        ],
        direction: "watch",
        severity: "Watch",
        impact: 0,
        confidence: 68,
        managementQuestion: "What business event or operational change should management investigate next?",
      });
    }
  }

  drivers.sort((a, b) => {
    const severityRank = { High: 3, Medium: 2, Watch: 1 };
    const contextualRank: Record<string, number> = {
      "historical-opex-spike": 120,
      "revenue-trend-no-driver": 110,
      "multi-period-margin-compression": 110,
      "multi-period-cash-deterioration": 100,
      "cash-decline": 80,
      "margin-compression": 75,
      "inventory-growth": 90,
      "opex-growth": 65,
      "mro-spike": 55,
      "unusual-spend": 50,
    };
    return (
      (severityRank[b.severity] - severityRank[a.severity]) ||
      ((contextualRank[b.id] ?? 0) - (contextualRank[a.id] ?? 0)) ||
      (b.confidence - a.confidence)
    );
  });

  const highDriverCount = drivers.filter((driver) => driver.severity === "High").length;
  const mediumDriverCount = drivers.filter((driver) => driver.severity === "Medium").length;
  health =
    highDriverCount > 0
      ? "needs attention"
      : mediumDriverCount > 0
      ? "watch"
      : "strong";

  if (drivers.some((driver) => driver.id === "multi-period-margin-compression")) {
    recommendation =
      "Decompose the multi-period margin deterioration into pricing, material costs, labor, mix, or other operating drivers before prescribing a corrective action.";
  } else if (drivers.some((driver) => driver.id === "historical-opex-spike")) {
    recommendation =
      "Review the one-period operating expense spike, confirm what caused it, and determine whether it was truly non-recurring.";
  } else if (drivers.some((driver) => driver.id === "inventory-growth")) {
    recommendation =
      "Review inventory aging, purchasing cadence, and demand support to determine whether inventory growth is absorbing cash without matching sales.";
  } else if (drivers.some((driver) => driver.id === "multi-period-cash-deterioration")) {
    recommendation =
      "Reconcile the sustained cash decline to collections, inventory, purchasing, financing, and upcoming payments to identify the strongest liquidity pressure.";
  } else if (drivers.some((driver) => driver.id === "revenue-trend-no-driver")) {
    recommendation =
      "Investigate the customer, product, pricing, or volume factors behind the multi-period revenue trend before drawing a stronger conclusion.";
  }

  const relationships: string[] = [];

  if (revenueChange < 0 && marginChange < 0) {
    relationships.push("Revenue and gross margin are both declining, increasing the risk that weaker sales are being accompanied by weaker profitability.");
  }

  if (inventoryChange >= 5 && inventoryChange > revenueChange + 3) {
    relationships.push("Inventory is increasing faster than revenue, which can tie up cash without a matching increase in sales.");
  }

  if (inventoryChange >= 5 && cashChange <= -5) {
    relationships.push("Inventory is rising while cash is falling, a combination that can indicate working capital is being absorbed by stock growth.");
  }

  if (operatingExpenseChange > revenueChange && operatingExpenseChange > 5 && marginChange < 0) {
    relationships.push("Operating expenses are growing faster than revenue while margin is declining, which may be compounding pressure on operating profitability.");
  }

  if (unusualExpense > 0 && cashChange < 0) {
    relationships.push("An unusual expense occurred during a period of cash decline, so management should determine whether the spend is contributing to the liquidity movement or is unrelated.");
  }

  if (priorMro > 0 && latestMro > priorMro * 1.25 && marginChange < 0) {
    relationships.push("MRO / Repairs spending is spiking while gross margin is declining, making maintenance or downtime-related cost drivers worth investigating.");
  }

  /*
   * ------------------------------------------------------------
   * CONFIDENCE
   * ------------------------------------------------------------
   *
   * Confidence is based on how much usable financial
   * information ClearCFO actually found.
   * ------------------------------------------------------------
   */

  let confidence = 50;

  if (revenue !== 0) {
    confidence += 15;
  }

  if (previousRevenue !== 0) {
    confidence += 10;
  }

  if (grossMargin !== 0) {
    confidence += 10;
  }

  if (cash !== 0) {
    confidence += 5;
  }

  if (inventory !== 0) {
    confidence += 5;
  }

  if (trend.length >= 3) {
    confidence += 5;
  }

  confidence = Math.min(
    95,
    confidence
  );

  const detailDrivers = buildDetailDrivers(
    latest,
    previous,
    metricRows,
    isMetricRowFormat,
    latestMetricIndex,
    previousMetricIndex,
    [
      ...revenueAliases,
      ...grossMarginAliases,
      ...grossProfitAliases,
      ...cogsAliases,
      ...operatingExpenseAliases,
      ...mroAliases,
      ...unusualExpenseAliases,
    ]
  );

  const trendInsights = buildTrendInsights(historicalSeries, revenueChange);

  const unknowns: string[] = [];

  if (drivers.some((driver) => driver.id === "revenue-trend-no-driver")) {
    alerts.push("Revenue is showing a meaningful multi-period trend, but the workbook does not contain enough operating detail to establish the driver.");
  }

  if (drivers.some((driver) => driver.id === "inventory-growth")) {
    unknowns.push("The workbook does not identify which inventory categories or SKUs are driving the increase.");
  }

  if (drivers.some((driver) => driver.id === "margin-compression")) {
    unknowns.push("The workbook does not establish whether margin pressure is coming from pricing, materials, labor, mix, or another operating factor.");
  }

  if (drivers.some((driver) => driver.id === "cash-decline")) {
    unknowns.push("The available statements do not fully reconcile the cash movement to collections, purchasing, debt, and other cash flows.");
  }

  if (drivers.some((driver) => driver.id === "opex-growth")) {
    unknowns.push("The workbook does not identify which operating expense categories are recurring versus discretionary.");
  }

  if (drivers.some((driver) => driver.id === "mro-spike")) {
    unknowns.push("The workbook does not establish whether the MRO increase is planned maintenance, downtime-related, or recurring.");
  }

  if (drivers.some((driver) => driver.id === "unusual-spend" || driver.id === "historical-opex-spike")) {
    unknowns.push("The workbook does not establish whether the unusual expense will recur.");
  }

  if (drivers.some((driver) => driver.id === "revenue-trend-no-driver")) {
    unknowns.push("The workbook shows a multi-period revenue trend but does not contain customer, product, pricing, or volume detail to establish the root cause.");
  }

  /*
   * ------------------------------------------------------------
   * FALLBACKS
   * ------------------------------------------------------------
   */

  if (!trend.length) {
    trend = [revenue];
  }

  if (!periods.length) {
    periods = trend.map(
      (_, index) =>
        `P-${trend.length - index}`
    );
  }

  return {
    companyName,
    revenue,
    revenueChange,
    grossMargin,
    marginChange,
    cash,
    cashChange,
    inventory,
    inventoryChange,
    attention: alerts.length,
    alerts:
      alerts.length > 0
        ? alerts
        : [
            "No major exceptions detected in the uploaded periods.",
          ],
    recommendation,
    impact: estimatedImpact,
    impactReason,
    trend,
    periods: periods.slice(-trend.length),
    health,
    confidence,
    source: "upload",
    drivers,
    relationships,
    detailDrivers,
    trendInsights,
    trendSeries: historicalSeries.slice(-12),
    unknowns: unknowns.slice(0, 6),
  };
}


export function scoreDriverAction(driver: FinancialDriver): number {
  const severityScore =
    driver.severity === "High" ? 34 :
    driver.severity === "Medium" ? 24 : 14;
  const impactScore = Math.min(30, Math.round(driver.impact > 0 ? 10 + Math.log10(driver.impact + 1) * 4 : 8));
  const confidenceScore = Math.min(25, Math.round(driver.confidence * 0.25));
  const relationshipBonus = driver.evidence.length >= 2 ? 8 : 3;
  return Math.max(0, Math.min(100, severityScore + impactScore + confidenceScore + relationshipBonus));
}

export function scoreAIAction(action: AIAction): number {
  if (typeof action.score === "number" && Number.isFinite(action.score)) {
    return Math.max(0, Math.min(100, Math.round(action.score)));
  }
  return action.priority === "High" ? 85 : action.priority === "Medium" ? 65 : 45;
}

export function buildDeterministicExecutiveSummary(data: BriefingData): {
  summary: string;
  primaryDriver: string;
  whyItMatters: string;
  managementQuestion: string;
  actions: AIAction[];
  unknowns: string[];
} {
  const primary = data.drivers[0];
  const summaryParts: string[] = [];

  if (data.revenueChange < 0) {
    summaryParts.push(`Revenue is down ${formatPercentValue(Math.abs(data.revenueChange))}%`);
  } else {
    summaryParts.push(`Revenue is up ${formatPercentValue(data.revenueChange)}%`);
  }

  if (data.marginChange < 0) {
    summaryParts.push(`gross margin is down ${Math.abs(data.marginChange).toFixed(1)} points`);
  } else {
    summaryParts.push(`gross margin is up ${data.marginChange.toFixed(1)} points`);
  }

  if (data.cashChange < 0) {
    summaryParts.push(`cash is down ${formatPercentValue(Math.abs(data.cashChange))}%`);
  } else {
    summaryParts.push(`cash is up ${formatPercentValue(data.cashChange)}%`);
  }

  const trendContext = data.trendInsights[0] ?? "The available history does not establish a stronger multi-period pattern.";
  const summary = `${summaryParts.join(', while ')}. ${data.relationships[0] ?? 'No dominant cross-metric relationship was detected in the supplied data.'} ${trendContext}`;
  const primaryDriver = primary?.title ?? 'No dominant financial driver detected';
  const whyItMatters = primary?.observation ?? 'The supplied data does not show a material exception that clearly dominates the current period.';
  const managementQuestion = primary?.managementQuestion ?? 'What business event or operational change should management investigate next?';

  const actions: AIAction[] = data.drivers.slice(0, 3).map((driver, index) => ({
    title: index === 0 ? `Investigate ${driver.title.toLowerCase()}` : driver.managementQuestion,
    rationale: driver.evidence.slice(0, 2).join('; '),
    priority: driver.severity,
    score: scoreDriverAction(driver),
  })).sort((a, b) => scoreAIAction(b) - scoreAIAction(a));

  return { summary, primaryDriver, whyItMatters, managementQuestion, actions, unknowns: data.unknowns.slice(0, 4) };
}
