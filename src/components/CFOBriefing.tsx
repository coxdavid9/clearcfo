"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import Navbar from "./Navbar";
import Footer from "./Footer";

type BriefingData = {
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

type DetailDriver = {
  name: string;
  current: number;
  previous: number;
  change: number;
  percentChange: number;
  direction: "up" | "down";
  impact: number;
  contributionPct?: number;
};

type FinancialDriver = {
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

type AIAction = {
  title: string;
  rationale: string;
  priority: "High" | "Medium" | "Watch";
  score?: number;
};

type AIAnalysis = {
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

type ExpandedMetric =
  | "revenue"
  | "margin"
  | "cash"
  | "attention"
  | null;

const demoDrivers: FinancialDriver[] = [
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

const demoData: BriefingData = {
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

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const percent = (value: number) =>
  `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;

const formatCurrency = (value: number): string =>
  currency.format(value);

const normalizePercent = (value: number | null): number | null => {
  if (value === null) return null;
  if (Math.abs(value) > 0 && Math.abs(value) <= 1.5) {
    return value * 100;
  }
  return value;
};

const formatPeriod = (value: unknown): string => {
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

function clean(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function toNumber(value: unknown): number {
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

function asRows(
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

function asMatrix(
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

function findSheet(
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

function findValue(
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

function findCompany(
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

  return "Your Business";
}

function buildDetailDrivers(
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

function buildTrendInsights(
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
        `Operating expenses are growing ${Math.abs(opex).toFixed(1)}% across the recent periods versus ${Math.abs(revenue).toFixed(1)}% for revenue. The widening gap suggests operating leverage is weakening.`
      );
    } else if (gap <= -5) {
      insights.push(
        `Revenue is growing ${Math.abs(revenue).toFixed(1)}% across the recent periods while operating expenses are growing ${Math.abs(opex).toFixed(1)}%. The business is currently gaining operating leverage.`
      );
    }
  }

  if (typeof revenue === "number" && typeof margin === "number") {
    if (margin <= -2 && revenue >= 0) {
      insights.push(
        `Gross margin has declined ${Math.abs(margin).toFixed(1)}% across the recent periods while revenue increased ${Math.abs(revenue).toFixed(1)}%. Growth is not fully translating into gross-profit improvement.`
      );
    } else if (margin >= 2 && revenue >= 0) {
      insights.push(
        `Gross margin has improved ${Math.abs(margin).toFixed(1)}% while revenue increased ${Math.abs(revenue).toFixed(1)}%. The business is generating better economics on its sales base.`
      );
    }
  }

  if (typeof mro === "number" && Math.abs(mro) >= 5) {
    insights.push(
      `MRO / Repairs changed ${mro >= 0 ? "up" : "down"} ${Math.abs(mro).toFixed(1)}% across the recent periods. A sustained move can affect operating leverage and deserves a driver-level review.`
    );
  }

  if (typeof unusual === "number" && Math.abs(unusual) >= 5) {
    insights.push(
      `Unusual spend changed ${unusual >= 0 ? "up" : "down"} ${Math.abs(unusual).toFixed(1)}% across the recent periods. Management should determine whether the movement is isolated or becoming recurring.`
    );
  }

  // Only fall back to a generic trend statement when the data does not support
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
        insights.push(`${series.name} has risen consistently${span}, increasing ${Math.abs(change).toFixed(1)}% over the displayed span.`);
      } else if (falling >= Math.max(2, diffs.length - 1)) {
        insights.push(`${series.name} has declined consistently${span}, decreasing ${Math.abs(change).toFixed(1)}% over the displayed span.`);
      } else if (Math.abs(change) >= 5) {
        insights.push(`${series.name} is volatile across the displayed periods, with a net ${change >= 0 ? "increase" : "decrease"} of ${Math.abs(change).toFixed(1)}%.`);
      }
      if (insights.length >= 3) break;
    }
  }

  if (!insights.length && fallbackRevenueChange !== 0) {
    insights.push(
      `Revenue changed ${Math.abs(fallbackRevenueChange).toFixed(1)}% versus the prior period, but the available history does not support a stronger multi-period relationship.`
    );
  }

  return Array.from(new Set(insights)).slice(0, 3);
}

function workbookContainsFinancialSignal(
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

function compactWhyItMatters(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  let compact = sentences.slice(0, 3).join(" ").trim();
  const words = compact.split(/\s+/).filter(Boolean);
  if (words.length > 55) {
    compact = words.slice(0, 55).join(" ").replace(/[,:;]$/, "") + "…";
  }
  return compact;
}

function analyzeWorkbook(
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
    "cash and equivalents",
    "cash equivalents",
    "cash and cash equivalents",
    "cash & equivalents",
    "cash & cash equivalents",
  ];

  const inventoryAliases = [
    "inventory",
    "inventory asset",
    "total inventory",
  ];

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

  const inventory =
    inventoryFromBalanceSheet ??
    inventoryFromFinancials ??
    0;

  const previousInventory =
    previousInventoryFromBalanceSheet ??
    previousInventoryFromFinancials ??
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
      `Inventory is growing ${inventoryChange.toFixed(
        1
      )}% while revenue is changing ${revenueChange.toFixed(
        1
      )}%.`;

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
      `Cash declined ${Math.abs(
        cashChange
      ).toFixed(
        1
      )}% from the prior period.`;

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
      `Operating expenses increased ${operatingExpenseChange.toFixed(
        1
      )}% while revenue changed ${revenueChange.toFixed(
        1
      )}%.`;

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

  if (inventory > 0 && previousInventory > 0 && inventoryChange > 0 && inventoryChange > revenueChange + 3) {
    const inventoryImpact = Math.max(0, Math.round(inventory - previousInventory));
    drivers.push({
      id: "inventory-growth",
      category: "Inventory",
      title: "Inventory is outpacing revenue",
      observation: `Inventory increased ${inventoryChange.toFixed(1)}% while revenue changed ${revenueChange.toFixed(1)}%.`,
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
        `Current gross margin: ${grossMargin.toFixed(1)}%`,
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
      observation: `Cash declined ${Math.abs(cashChange).toFixed(1)}% from the prior period.`,
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
      observation: `Operating expenses increased ${operatingExpenseChange.toFixed(1)}% while revenue changed ${revenueChange.toFixed(1)}%.`,
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

  // Detect isolated historical operating-expense spikes even when the latest
  // period has normalized. This matters for workbooks where the anomaly
  // occurred in the prior month rather than the current month.
  const expenseSeries = historicalSeries.find(
    (series) => clean(series.name) === "operating expenses"
  );

  if (expenseSeries && expenseSeries.values.length >= 3) {
    const values = expenseSeries.values;
    let spikeIndex = -1;
    let spikeValue = 0;
    let spikeBaseline = 0;

    for (let i = 1; i < values.length - 1; i += 1) {
      const prior = values[i - 1];
      const current = values[i];
      const next = values[i + 1];
      if (prior <= 0 || current <= 0 || next <= 0) continue;

      const baseline = (prior + next) / 2;
      if (baseline > 0 && current >= baseline * 1.5) {
        const normalizedNext = Math.abs(next - baseline) / baseline;
        if (normalizedNext <= 0.2 && current > spikeValue) {
          spikeIndex = i;
          spikeValue = current;
          spikeBaseline = baseline;
        }
      }
    }

    if (spikeIndex >= 0) {
      const spikeImpact = Math.max(0, Math.round(spikeValue - spikeBaseline));
      const spikePeriod = expenseSeries.periods[spikeIndex] || "a prior period";
      const alreadyCovered = drivers.some(
        (driver) => driver.id === "opex-growth" || driver.id === "unusual-spend"
      );

      if (!alreadyCovered) {
        drivers.push({
          id: "historical-opex-spike",
          category: "Unusual Spend",
          title: "A one-period operating expense spike was detected",
          observation: `Operating expenses spiked to ${formatCurrency(spikeValue)} in ${spikePeriod}, then returned near the surrounding-period baseline of ${formatCurrency(spikeBaseline)}.`,
          evidence: [
            `Spike period: ${spikePeriod}`,
            `Peak operating expenses: ${formatCurrency(spikeValue)}`,
            `Estimated excess versus surrounding periods: ${formatCurrency(spikeImpact)}`,
          ],
          direction: "up",
          severity: spikeImpact >= Math.max(25000, revenue * 0.05) ? "High" : "Medium",
          impact: spikeImpact,
          confidence: 94,
          managementQuestion: "What caused the one-period operating expense spike, and was it truly non-recurring?",
        });
        alerts.push(`A one-period operating expense spike was detected in ${spikePeriod}.`);
        priorities.push({ level: spikeImpact >= Math.max(25000, revenue * 0.05) ? "high" : "medium", message: `A one-period operating expense spike was detected in ${spikePeriod}.` });
      }
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
        observation: `Revenue declined ${Math.abs(multiPeriodRevenueChange).toFixed(1)}% across the displayed periods while gross margin remained broadly stable.`,
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
          `Current gross margin: ${grossMargin.toFixed(1)}%`,
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
        observation: `Cash declined ${Math.abs(multiPeriodCashChange).toFixed(1)}% from the first to latest displayed period.`,
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
        observation: `Revenue changed ${Math.abs(multiPeriodRevenueChange).toFixed(1)}% across the displayed periods, but the workbook does not contain enough operating detail to establish what is driving the trend.`,
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
          `Gross margin: ${grossMargin.toFixed(1)}%`,
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

  if (inventoryChange > 0 && revenueChange < inventoryChange) {
    relationships.push("Inventory is increasing faster than revenue, which can tie up cash without a matching increase in sales.");
  }

  if (inventoryChange > 0 && cashChange < 0) {
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
    trendSeries: historicalSeries.slice(-6),
    unknowns: unknowns.slice(0, 6),
  };
}


function scoreDriverAction(driver: FinancialDriver): number {
  const severityScore =
    driver.severity === "High" ? 34 :
    driver.severity === "Medium" ? 24 : 14;
  const impactScore = Math.min(30, Math.round(driver.impact > 0 ? 10 + Math.log10(driver.impact + 1) * 4 : 8));
  const confidenceScore = Math.min(25, Math.round(driver.confidence * 0.25));
  const relationshipBonus = driver.evidence.length >= 2 ? 8 : 3;
  return Math.max(0, Math.min(100, severityScore + impactScore + confidenceScore + relationshipBonus));
}

function scoreAIAction(action: AIAction): number {
  if (typeof action.score === "number" && Number.isFinite(action.score)) {
    return Math.max(0, Math.min(100, Math.round(action.score)));
  }
  return action.priority === "High" ? 85 : action.priority === "Medium" ? 65 : 45;
}

function buildDeterministicExecutiveSummary(data: BriefingData): {
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
    summaryParts.push(`Revenue is down ${Math.abs(data.revenueChange).toFixed(1)}%`);
  } else {
    summaryParts.push(`Revenue is up ${data.revenueChange.toFixed(1)}%`);
  }

  if (data.marginChange < 0) {
    summaryParts.push(`gross margin is down ${Math.abs(data.marginChange).toFixed(1)} points`);
  } else {
    summaryParts.push(`gross margin is up ${data.marginChange.toFixed(1)} points`);
  }

  if (data.cashChange < 0) {
    summaryParts.push(`cash is down ${Math.abs(data.cashChange).toFixed(1)}%`);
  } else {
    summaryParts.push(`cash is up ${data.cashChange.toFixed(1)}%`);
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

export default function CFOBriefing() {
  const fileRef = useRef<HTMLInputElement>(null);

  const [data, setData] =
    useState<BriefingData>(
      demoData
    );

  const [hasValidAnalysis, setHasValidAnalysis] =
    useState(true);

  const [uploading, setUploading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [showAnalysis, setShowAnalysis] =
    useState(false);

  const [aiAnalysis, setAiAnalysis] =
    useState<AIAnalysis | null>(null);

  const [aiLoading, setAiLoading] =
    useState(false);

  const [aiError, setAiError] =
    useState("");

  const [expandedMetric, setExpandedMetric] =
    useState<ExpandedMetric>(null);

  const showFinancialDetail = true;

  const trendChange =
    data.trend.length >= 2 && data.trend[0] !== 0
      ? ((data.trend[data.trend.length - 1] - data.trend[0]) /
          Math.abs(data.trend[0])) *
        100
      : 0;

  // The uploaded trend contains real dollar values, not CSS percentages.
  // Normalize them only for the visual bar heights so the chart reflects the
  // actual period-to-period movement without forcing huge values into CSS.
  const trendHeights = useMemo(() => {
    const values = data.trend.filter((value) => Number.isFinite(value));
    if (!values.length) return [];

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    if (range === 0) return values.map(() => 55);

    return data.trend.map((value) =>
      18 + ((value - min) / range) * 72
    );
  }, [data.trend]);

  const deterministicAnalysis =
    buildDeterministicExecutiveSummary(data);

  useEffect(() => {
    if (!showAnalysis) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [showAnalysis]);


  const toggleMetric = (metric: ExpandedMetric) => {
    setExpandedMetric((current) =>
      current === metric ? null : metric
    );
  };

  async function handleUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    setUploading(true);
    setHasValidAnalysis(false);
    setError("");
    setAiError("");
    setAiAnalysis(null);
    setShowAnalysis(false);

    try {
      const buffer =
        await file.arrayBuffer();

      const workbook =
        XLSX.read(buffer, {
          cellDates: true,
        });

      const analyzed =
        analyzeWorkbook(
          workbook
        );

      setData(analyzed);
      setHasValidAnalysis(true);
      await generateAIAnalysis(analyzed);
    } catch (err) {
      setHasValidAnalysis(false);
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't read that workbook. Please check the file format and sheet names."
      );
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function generateAIAnalysis(inputData: BriefingData = data) {
    setAiLoading(true);
    setAiError("");

    try {
      const response = await fetch("/api/cfo-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyName: inputData.companyName,
          financialSnapshot: {
            revenue: inputData.revenue,
            revenueChange: inputData.revenueChange,
            grossMargin: inputData.grossMargin,
            marginChange: inputData.marginChange,
            cash: inputData.cash,
            cashChange: inputData.cashChange,
            inventory: inputData.inventory,
            inventoryChange: inputData.inventoryChange,
          },
          detectedIssues: inputData.alerts,
          financialDrivers: inputData.drivers,
          driverRelationships: inputData.relationships,
          detailDrivers: inputData.detailDrivers,
          currentRecommendation: inputData.recommendation,
          businessHealth: inputData.health,
          analysisConfidence: inputData.confidence,
          recentRevenueTrend: inputData.trend.slice(-12),
          periods: inputData.periods.slice(-12),
          multiPeriodInsights: inputData.trendInsights,
          knownUnknowns: inputData.unknowns,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            "ClearCFO could not generate the AI analysis."
        );
      }

      setAiAnalysis(payload.analysis as AIAnalysis);
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : "ClearCFO could not generate the AI analysis."
      );
    } finally {
      setAiLoading(false);
    }
  }

  const emptyState = (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm sm:p-12">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-xl text-blue-600">
        ✦
      </div>

      <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
        ClearCFO Intelligence
      </p>

      <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
        Your CFO Briefing starts with your data.
      </h2>

      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">
        Upload a financial workbook to generate KPIs,
        trends, exceptions, and prioritized
        recommendations.
      </p>

      <button
        type="button"
        onClick={() =>
          fileRef.current?.click()
        }
        className="mt-7 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-600/15 transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30"
      >
        {uploading
          ? "Analyzing…"
          : "Upload Financial Data"}
      </button>

      <p className="mt-3 text-xs text-slate-400">
        Your real customer dashboard will start here —
        no fake numbers.
      </p>
    </div>
  );

  if (!hasValidAnalysis) {
    return (
      <div className="px-5 py-8 sm:px-8 sm:py-12 lg:py-16">
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUpload} />
        {error && (
          <div className="mx-auto mb-4 w-full max-w-6xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">{error}</div>
        )}
        <div className="mx-auto w-full max-w-6xl">{emptyState}</div>
      </div>
    );
  }

  return (
    <div className="px-5 py-8 sm:px-8 sm:py-12 lg:py-16">
      <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_25px_80px_-35px_rgba(15,23,42,0.35)]">
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleUpload}
      />

      <div className="border-b border-slate-200 bg-white px-6 py-6 sm:px-8 sm:py-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs text-white">✦</span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">ClearCFO Intelligence</p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Financial briefing</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{data.source === "upload" ? `Last analyzed: ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "Demo financial data"}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-slate-50 hover:text-slate-900 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30">{uploading || aiLoading ? "Analyzing…" : "Upload Excel"}</button>
            <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${data.health === "strong" ? "border border-emerald-100 bg-emerald-50 text-emerald-700" : data.health === "watch" ? "border border-amber-100 bg-amber-50 text-amber-700" : "border border-red-100 bg-red-50 text-red-700"}`}>
              <span className={`h-2 w-2 rounded-full ${data.health === "strong" ? "bg-emerald-500" : data.health === "watch" ? "bg-amber-500" : "bg-red-500"}`} />Business health: {data.health}
            </div>
          </div>
        </div>
      </div>

      <div className="p-7 sm:p-10">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Today&apos;s CFO Briefing</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.7rem]">Hello, David — here&apos;s what deserves your attention today.</h2>
          <p className="mt-1 text-sm text-slate-500">{data.source === "upload" ? data.companyName : "Your financial data"}</p>
        </div>
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Financial signals</p>
                <p className="mt-1 text-xs text-slate-500">A quick read on what is improving, changing, or needs attention.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Positive</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Monitor</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Attention</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  key: "revenue" as const,
                  label: "Revenue",
                  value: currency.format(data.revenue),
                  change: percent(data.revenueChange),
                  tone: data.revenueChange > 0 ? "text-emerald-600" : data.revenueChange < 0 ? "text-red-600" : "text-amber-600",
                  signal: data.revenueChange > 0 ? "bg-emerald-500" : data.revenueChange < 0 ? "bg-red-500" : "bg-amber-400",
                  detail: "Current revenue and the change from the prior reporting period. Use the expanded view to compare the prior-period level, recent trend, and whether growth is keeping pace with the rest of the business.",
                },
                {
                  key: "margin" as const,
                  label: "Gross Margin",
                  value: `${data.grossMargin.toFixed(1)}%`,
                  change: `${data.marginChange >= 0 ? "+" : ""}${data.marginChange.toFixed(1)} pts`,
                  tone: data.marginChange > 0 ? "text-emerald-600" : data.marginChange < 0 ? "text-red-600" : "text-amber-600",
                  signal: data.marginChange > 0 ? "bg-emerald-500" : data.marginChange < 0 ? "bg-red-500" : "bg-amber-400",
                  detail: "Margin performance compared with the prior reporting period. The expanded view shows the implied prior-period margin and why margin movement matters for every sales dollar.",
                },
                {
                  key: "cash" as const,
                  label: "Cash Position",
                  value: currency.format(data.cash),
                  change: percent(data.cashChange),
                  tone: data.cashChange > 0 ? "text-emerald-600" : data.cashChange < 0 ? "text-red-600" : "text-amber-600",
                  signal: data.cashChange > 0 ? "bg-emerald-500" : data.cashChange < 0 ? "bg-red-500" : "bg-amber-400",
                  detail: "Current cash available and the change from the prior reporting period. The expanded view adds prior-period cash and context for interpreting cash alongside working capital and operating performance.",
                },
                {
                  key: "attention" as const,
                  label: "Needs Attention",
                  value: String(data.attention),
                  change: `${data.attention} ${data.attention === 1 ? "issue" : "issues"}`,
                  tone: data.attention > 0 ? "text-red-600" : "text-emerald-600",
                  signal: data.attention > 0 ? "bg-red-500" : "bg-emerald-500",
                  detail: "Detected exceptions that deserve management attention. The expanded view shows the actual issues ClearCFO found so the count has useful context rather than being just a number.",
                },
              ].map((metric) => {
                const isExpanded = expandedMetric === metric.key;

                return (
                  <button
                    type="button"
                    key={metric.key}
                    onClick={() => toggleMetric(metric.key)}
                    aria-expanded={isExpanded}
                    className={`relative min-h-[132px] rounded-2xl border p-5 text-left shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 ${
                      isExpanded
                        ? "z-10 border-blue-300 bg-blue-50/70 shadow-lg shadow-blue-900/10 md:-translate-y-1 md:scale-[1.02]"
                        : expandedMetric
                          ? "border-slate-200 bg-white opacity-65 hover:opacity-100"
                          : "border-slate-200 bg-white hover:-translate-y-1 hover:border-blue-200 hover:shadow-md hover:shadow-blue-900/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${metric.signal}`} aria-hidden="true" />
                        <p className="text-xs font-medium text-slate-500 sm:text-sm">
                          {metric.label}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-slate-400">
                        {isExpanded ? "Selected" : "View detail"}
                      </span>
                    </div>

                    <p className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                      {metric.value}
                    </p>

                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold sm:text-sm">
                      <span className={metric.tone}>{metric.change}</span>
                      <span className="font-normal text-slate-400">vs. prior period</span>
                    </div>

                                      </button>
                );
              })}
            </div>

            {expandedMetric && (() => {
              const selected = [
                {
                  key: "revenue" as const,
                  label: "Revenue",
                  detail: `Current revenue is ${currency.format(data.revenue)}. The implied prior-period level is approximately ${currency.format(data.revenue / (1 + data.revenueChange / 100))}, a ${data.revenueChange >= 0 ? "gain" : "decline"} of ${Math.abs(data.revenueChange).toFixed(1)}%.`,
                  context: `Across the available trend, revenue has ${trendChange >= 0 ? "increased" : "declined"} ${Math.abs(trendChange).toFixed(1)}%.`,
                  why: "Revenue growth is useful context for judging whether costs, margins, and working capital are keeping pace.",
                },
                {
                  key: "margin" as const,
                  label: "Gross Margin",
                  detail: `Current gross margin is ${data.grossMargin.toFixed(1)}%. The implied prior-period margin is approximately ${(data.grossMargin - data.marginChange).toFixed(1)}%, a ${data.marginChange >= 0 ? "gain" : "decline"} of ${Math.abs(data.marginChange).toFixed(1)} points.`,
                  context: `Margin is ${data.marginChange >= 0 ? "improving" : "declining"} versus the prior period.`,
                  why: "Margin shows how much of each sales dollar remains after direct costs and helps explain whether revenue growth is translating into gross profit.",
                },
                {
                  key: "cash" as const,
                  label: "Cash Position",
                  detail: `Current cash is ${currency.format(data.cash)}. The implied prior-period position is approximately ${currency.format(data.cash / (1 + data.cashChange / 100))}, a ${data.cashChange >= 0 ? "gain" : "decline"} of ${Math.abs(data.cashChange).toFixed(1)}%.`,
                  context: "Cash should be read alongside inventory, receivables, payables, and operating performance.",
                  why: "A stronger cash balance is useful, but the source and sustainability of the movement matter.",
                },
                {
                  key: "attention" as const,
                  label: "Needs Attention",
                  detail: `${data.attention} ${data.attention === 1 ? "issue is" : "issues are"} currently flagged for management attention.`,
                  context: data.alerts.slice(0, 3).join(" "),
                  why: "This is a shortcut to the exceptions ClearCFO believes deserve investigation before lower-priority details.",
                },
              ].find((item) => item.key === expandedMetric);

              if (!selected) return null;

              return (
                <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/40 p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">KPI detail</p>
                      <h3 className="mt-1 text-lg font-bold text-slate-900">{selected.label}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedMetric(null)}
                      className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition-colors hover:bg-white hover:text-blue-600"
                    >
                      Close
                    </button>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div className="rounded-xl border border-white bg-white/80 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">What changed</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{selected.detail}</p>
                    </div>
                    <div className="rounded-xl border border-white bg-white/80 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Context</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{selected.context}</p>
                    </div>
                    <div className="rounded-xl border border-white bg-white/80 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Why it matters</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{selected.why}</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="mt-6 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      KPI trend — Revenue performance
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Trailing{" "}
                      {data.trend.length}{" "}
                      periods
                    </p>
                  </div>

                  <div className="text-right">
                    <p
                      className={`text-sm font-bold ${
                        trendChange >= 0
                          ? "text-emerald-600"
                          : "text-red-600"
                      }`}
                    >
                      {percent(
                        trendChange
                      )}
                    </p>

                    <p className="text-xs text-slate-400">
                      trend
                    </p>
                  </div>
                </div>

                <div className="relative mt-6 h-32 overflow-hidden rounded-xl border border-slate-100 bg-slate-50/50 px-2 pt-3">
                  <div className="pointer-events-none absolute inset-x-2 top-5 border-t border-slate-200/80" />
                  <div className="pointer-events-none absolute inset-x-2 top-1/2 border-t border-slate-200/70" />
                  <div className="pointer-events-none absolute inset-x-2 bottom-5 border-t border-slate-200/80" />
                  <div className="relative flex h-full items-end gap-2">
                  {data.trend.map(
                    (
                      height,
                      index
                    ) => (
                      <div
                        key={index}
                        className="flex h-full flex-1 items-end"
                      >
                        <div
                          className={`w-full rounded-t-md transition-all duration-500 ${
                            index ===
                            data.trend.length - 1
                              ? "bg-blue-600"
                              : "bg-blue-200"
                          }`}
                          style={{
                            height: `${trendHeights[index] ?? 55}%`,
                          }}
                        />
                      </div>
                    )
                  )}
                  </div>
                </div>

                <div className="mt-2 flex justify-between text-[10px] text-slate-400">
                  <span>
                    {data.periods?.[0] ??
                      "Prior"}
                  </span>

                  <span>
                    {data.periods?.[
                      data.periods.length -
                        1
                    ] ??
                      "Current"}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6 shadow-sm sm:p-7">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">
                    What needs attention
                  </p>

                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                    {data.attention}{" "}
                    {data.attention === 1
                      ? "alert"
                      : "alerts"}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {data.alerts
                    .slice(0, 3)
                    .map(
                      (
                        alert,
                        index
                      ) => (
                        <div
                          key={alert}
                          className="w-full rounded-xl border border-amber-100 bg-white/80 p-3 text-left"
                        >
                          <p className="text-xs font-semibold text-slate-900">
                            {index === 0
                              ? "Priority exception"
                              : "Detected variance"}
                          </p>

                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {alert}
                          </p>
                        </div>
                      )
                    )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1">
            <div className="order-2 mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Financial drivers</p>
                  <h3 className="mt-1 text-base font-bold text-slate-900 sm:text-lg">What is actually driving the result?</h3>
                  <p className="mt-1 text-sm text-slate-500">ClearCFO ranks the strongest observable financial relationships before AI reasoning is applied.</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600 sm:inline">
                    {data.drivers.length} driver{data.drivers.length === 1 ? "" : "s"}
                  </span>
                  
                </div>
              </div>

              {showFinancialDetail && (
                <>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {data.drivers.slice(0, 4).map((driver) => (
                  <div key={driver.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${driver.severity === "High" ? "bg-red-500" : driver.severity === "Medium" ? "bg-amber-400" : "bg-emerald-500"}`} aria-hidden="true" />
                            <p className="text-sm font-semibold text-slate-900">{driver.title}</p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${driver.severity === "High" ? "bg-red-50 text-red-700" : driver.severity === "Medium" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{driver.severity === "Watch" ? "Monitor" : driver.severity}</span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-600">{driver.observation}</p>
                      </div>
                      <span className="shrink-0 text-[10px] font-semibold text-slate-400">{driver.confidence}% confidence</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {driver.evidence.slice(0, 3).map((evidence) => (
                        <span key={evidence} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-500">{evidence}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {data.detailDrivers.length > 0 && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Largest account movements</p>
                      <p className="mt-1 text-sm text-slate-500">The largest period-over-period dollar movements found in the workbook.</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">Top {Math.min(6, data.detailDrivers.length)}</span>
                  </div>
                  <div className="mt-4 grid gap-2 md:grid-cols-2">
                    {data.detailDrivers.slice(0, 6).map((driver) => (
                      <div key={driver.name} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold text-slate-900">{driver.name}</p>
                          <span className={`text-xs font-bold ${driver.direction === "up" ? "text-amber-600" : "text-emerald-600"}`}>
                            {driver.direction === "up" ? "+" : "−"}{currency.format(Math.abs(driver.change))}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {driver.percentChange >= 0 ? "+" : ""}{driver.percentChange.toFixed(1)}% vs. prior period · Current {currency.format(driver.current)}
                        </p>
                        {typeof driver.contributionPct === "number" && driver.contributionPct > 0 && (
                          <p className="mt-1 text-[10px] font-semibold text-blue-600">
                            {driver.contributionPct.toFixed(0)}% of top account movement
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.relationships.length > 0 && (
                <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Driver relationships</p>
                  <ul className="mt-2 space-y-1.5">
                    {data.relationships.slice(0, 3).map((relationship) => (
                      <li key={relationship} className="text-xs leading-5 text-slate-600">
                        <span className="mr-2 text-blue-500">•</span>{relationship}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data.unknowns.length > 0 && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-600">What ClearCFO does not know yet</p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">These are evidence gaps, not assumptions. They identify where additional detail would improve the recommendation.</p>
                  <ul className="mt-2 space-y-1.5">
                    {data.unknowns.slice(0, 4).map((unknown) => (
                      <li key={unknown} className="text-xs leading-5 text-slate-600">
                        <span className="mr-2 text-slate-400">•</span>{unknown}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
                </>
              )}
            </div>

            {data.trendSeries.length > 0 && (
              <div className="order-3 mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Financial Trends</p>
                    <h3 className="mt-1 text-base font-bold text-slate-900 sm:text-lg">What has changed over time?</h3>
                    <p className="mt-1 text-sm text-slate-600">See whether the latest result is part of a broader pattern across the available periods.</p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">Across periods</span>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {data.trendSeries.slice(0, 4).map((series) => {
                    const values = series.values.filter((v) => Number.isFinite(v));
                    const first = values[0] ?? 0;
                    const last = values[values.length - 1] ?? 0;
                    const change = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;
                    const lowerName = series.name.toLowerCase();
                    const isInventory = lowerName.includes("inventory");
                    const isExpense = lowerName.includes("expense");
                    const isCash = lowerName.includes("cash");
                    const isMargin = lowerName.includes("margin");
                    const isNegative = change < 0;
                    const tone =
                      isExpense || isInventory
                        ? isNegative ? "positive" : "monitor"
                        : isNegative ? "attention" : "positive";
                    const toneText =
                      tone === "monitor" ? "text-amber-600" :
                      tone === "attention" ? "text-red-600" :
                      "text-emerald-600";
                    const line =
                      tone === "monitor" ? "#f59e0b" :
                      tone === "attention" ? "#ef4444" :
                      "#10b981";
                    const latest = values.at(-1) ?? 0;
                    const prior = values.at(-2) ?? latest;
                    const formatTrendValue = (value: number) =>
                      isMargin ? `${value.toFixed(1)}%` : formatCurrency(value);

                    // Use every available period as a real data point. The axis
                    // labels are intentionally sparse so the chart stays readable.
                    const minValue = Math.min(...values);
                    const maxValue = Math.max(...values);
                    const valueRange = Math.max(maxValue - minValue, 1);
                    const chartMin = minValue - valueRange * 0.12;
                    const chartMax = maxValue + valueRange * 0.12;
                    const chartRange = Math.max(chartMax - chartMin, 1);
                    const plotLeft = 18;
                    const plotRight = 98;
                    const plotTop = 8;
                    const plotBottom = 72;

                    const points = values.map((value, index) => {
                      const x = values.length === 1
                        ? (plotLeft + plotRight) / 2
                        : plotLeft + (index / (values.length - 1)) * (plotRight - plotLeft);
                      const y = plotBottom - ((value - chartMin) / chartRange) * (plotBottom - plotTop);
                      return `${x},${y}`;
                    }).join(" ");

                    const axisLabelCount =
                      values.length >= 10 ? 4 :
                      values.length >= 6 ? 3 :
                      Math.min(values.length, 3);

                    const axisIndexes = Array.from({ length: axisLabelCount }, (_, i) => {
                      if (axisLabelCount === 1) return 0;
                      return Math.round((i / (axisLabelCount - 1)) * (values.length - 1));
                    });

                    const axisPeriodLabels = axisIndexes.map((index) => ({
                      index,
                      label: series.periods[index] ?? `P${index + 1}`,
                    }));

                    const trendLabel =
                      isInventory ? (change >= 0 ? "Building" : "Easing") :
                      isExpense ? (change >= 0 ? "Increasing" : "Decreasing") :
                      isCash ? (change >= 0 ? "Strengthening" : "Declining") :
                      isMargin ? (change >= 0 ? "Expanding" : "Compressing") :
                      change >= 0 ? "Growing" : "Declining";

                    return (
                      <div key={series.name} className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-slate-900">{series.name}</p>
                            <p className={`mt-1 text-sm font-bold ${toneText}`}>{change >= 0 ? "+" : ""}{change.toFixed(1)}%</p>
                          </div>
                          <span className="text-[10px] font-semibold text-slate-400">{values.length}-period</span>
                        </div>

                        <p className="mt-1 text-[11px] font-semibold text-slate-500">{trendLabel}</p>
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 pb-2 pt-3">
                <div className="flex items-center justify-between px-1 pb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Trend by period</span>
                  <span className="text-[10px] font-semibold text-slate-500">Latest {formatTrendValue(latest)}</span>
                </div>
                <svg
                  viewBox="0 0 520 190"
                  className="h-44 w-full"
                  role="img"
                  aria-label={`${series.name} historical trend across ${values.length} periods`}
                >
                  {(() => {
                    const chartLeft = 54;
                    const chartRight = 504;
                    const chartTop = 14;
                    const chartBottom = 142;
                    const chartHeight = chartBottom - chartTop;
                    const yTicks = [maxValue, (maxValue + minValue) / 2, minValue];
                    const tickLabels = yTicks.map((value) => isMargin ? `${value.toFixed(1)}%` : formatCurrency(value));
                    const xFor = (index: number) => values.length === 1
                      ? (chartLeft + chartRight) / 2
                      : chartLeft + (index / (values.length - 1)) * (chartRight - chartLeft);
                    const yFor = (value: number) => chartBottom - ((value - chartMin) / chartRange) * chartHeight;
                    const chartPoints = values.map((value, index) => `${xFor(index)},${yFor(value)}`).join(" ");
                    const areaPoints = `${chartLeft},${chartBottom} ${chartPoints} ${chartRight},${chartBottom}`;

                    return (
                      <>
                        {yTicks.map((value, index) => (
                          <g key={`y-${index}`}>
                            <line x1={chartLeft} y1={yFor(value)} x2={chartRight} y2={yFor(value)} stroke="#dbe3ec" strokeWidth="1" />
                            <text x="48" y={yFor(value) + 3} textAnchor="end" fontSize="10" fill="#64748b">{tickLabels[index]}</text>
                          </g>
                        ))}
                        <line x1={chartLeft} y1={chartBottom} x2={chartRight} y2={chartBottom} stroke="#cbd5e1" strokeWidth="1" />
                        <polygon points={areaPoints} fill={line} opacity="0.08" />
                        <polyline points={chartPoints} fill="none" stroke={line} strokeWidth="3.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />

                        {values.map((value, index) => {
                          const x = xFor(index);
                          const y = yFor(value);
                          const isLatest = index === values.length - 1;
                          return (
                            <g key={`${series.name}-${index}`}>
                              {isLatest && <circle cx={x} cy={y} r="7" fill={line} opacity="0.14" />}
                              <circle cx={x} cy={y} r={isLatest ? "4.5" : "3.2"} fill={line} stroke="#ffffff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                            </g>
                          );
                        })}

                        {axisPeriodLabels.map(({ index, label }) => {
                          const x = xFor(index);
                          return (
                            <text key={`x-${index}`} x={x} y="166" textAnchor={index === 0 ? "start" : index === values.length - 1 ? "end" : "middle"} fontSize="11" fontWeight="600" fill="#64748b">
                              {label}
                            </text>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              </div>

              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                          <span>Latest {formatTrendValue(latest)}</span>
                          <span>Prior {formatTrendValue(prior)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
                  <p className="text-xs font-semibold leading-5 text-blue-800"><span className="font-bold">The bigger picture:</span> {data.trendInsights[0] ?? "The available history shows how the latest period fits into the broader financial trend."} {data.trendInsights[1] ?? "Management should watch whether the current pattern persists."}</p>
                </div>
              </div>
            )}

            <div className="order-1 mt-6 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-white p-6 shadow-sm sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm text-white">
                    ✦
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-blue-700">
                        ClearCFO Recommendation
                      </p>

                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                        Data driven
                      </span>
                    </div>

                    <h3 className="mt-1 text-base font-bold text-slate-900 sm:text-lg">
                      {
                        data.recommendation
                      }
                    </h3>

                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">ClearCFO turns the strongest financial evidence into a focused management action. Review the drivers and evidence below to understand why it matters and what deserves attention.</p>
                  </div>
                </div>


              </div>

              <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium text-slate-500">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
                  Based on analyzed financial history
                </span>

                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">{data.source === "upload" ? `Analyzed for ${data.companyName}` : "Demo financial data"}</span>

                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">Evidence confidence: {data.confidence >= 85 ? "High" : data.confidence >= 65 ? "Moderate" : "Limited"}</span>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {aiAnalysis ? (
                  <button type="button" onClick={() => setShowAnalysis(true)} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30">View Full CFO Analysis →</button>
                ) : aiLoading ? (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">ClearCFO is analyzing your financial data…</div>
                ) : aiError ? (
                  <button type="button" onClick={() => generateAIAnalysis()} disabled={aiLoading} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30">Retry Analysis</button>
                ) : null}
              </div>
              {aiError && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800">
                  {aiError}
                  {!aiLoading && /OPENAI_API_KEY|AI analysis is not configured/i.test(aiError) && (
                    <p className="mt-1 font-medium text-red-700">
                      Add OPENAI_API_KEY to .env.local, restart the app, and retry.
                    </p>
                  )}
                </div>
              )}
            </div>
            </div>

        </>
      </div>
    </div>

      {showAnalysis && (
        <div id="cfo-analysis" className="fixed inset-0 z-50 overflow-y-auto bg-white">
          <Navbar
            onNavigate={(href) => {
              setShowAnalysis(false);
              window.setTimeout(() => {
                document.querySelector(href)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 0);
            }}
            onLogin={() => setShowAnalysis(false)}
            loginLabel="Back to Briefing"
          />

          <div id="cfo-analysis-content" className="mx-auto min-h-[calc(100vh-5rem)] max-w-5xl px-5 py-7 sm:px-7 sm:py-10">
          <div className="border-b border-slate-200 pb-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">ClearCFO Analysis</p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">What changed, why it matters, and what to do next.</h3>
          </div>

          {aiAnalysis ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/70 via-white to-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-blue-600">
                      AI CFO Reasoning
                    </p>
                    <h4 className="mt-1 text-lg font-bold text-slate-900">
                      Executive readout
                    </h4>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700">
                    {data.attention === 0 ? "Monitor" : aiAnalysis.priority} priority · {aiAnalysis.confidence >= 85 ? "High" : aiAnalysis.confidence >= 65 ? "Moderate" : "Limited"} confidence
                  </span>
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-700">
                  {aiAnalysis.executiveSummary}
                </p>
              </div>

              {aiAnalysis.evidence.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Evidence used</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {aiAnalysis.evidence.slice(0, 4).map((item) => (
                      <span key={item} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">{item}</span>
                    ))}
                  </div>
                </div>
              )}

              {aiAnalysis.unknowns && aiAnalysis.unknowns.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Evidence gaps</p>
                  <div className="mt-3 space-y-2">
                    {aiAnalysis.unknowns.slice(0, 4).map((unknown) => (
                      <p key={unknown} className="text-xs leading-5 text-slate-600">• {unknown}</p>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Primary driver
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {aiAnalysis.primaryDriver}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Why it matters
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {compactWhyItMatters(aiAnalysis.whyItMatters)}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Management question
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {aiAnalysis.managementQuestion}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                  Recommended action
                </p>
                <p className="mt-2 text-base font-semibold leading-6 text-slate-900">
                  {aiAnalysis.recommendedAction}
                </p>
              </div>

              <div>
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      Prioritized actions
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      The next management moves ClearCFO would prioritize.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> High</span>
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Medium</span>
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Monitor</span>
                  </div>
                </div>

                <div className="grid gap-3">
                  {aiAnalysis.actions.slice(0, 4).map((action, index) => (
                    <div key={`${action.title}-${index}`} className="rounded-2xl bg-white p-4 shadow-sm">
                      <div className="flex gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
                          {index + 1}
                        </span>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">
                              {action.title}
                            </p>
                            <span className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${action.priority === "High" ? "bg-red-50 text-red-700" : action.priority === "Medium" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                              <span className={`h-2 w-2 rounded-full ${action.priority === "High" ? "bg-red-500" : action.priority === "Medium" ? "bg-amber-400" : "bg-emerald-500"}`} aria-hidden="true" />
                              {action.priority === "Watch" ? "Monitor" : action.priority}
                            </span>
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                              Score {scoreAIAction(action)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {action.rationale}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Executive readout</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{deterministicAnalysis.summary}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Primary driver</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{deterministicAnalysis.primaryDriver}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{deterministicAnalysis.whyItMatters}</p>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Management question</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{deterministicAnalysis.managementQuestion}</p>
                </div>

                <div className="rounded-2xl bg-emerald-50/60 p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Recommended action</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-800">{data.recommendation}</p>
                </div>
              </div>

              {deterministicAnalysis.unknowns.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Evidence gaps</p>
                  <div className="mt-2 space-y-1.5">
                    {deterministicAnalysis.unknowns.slice(0, 4).map((unknown) => (
                      <p key={unknown} className="text-xs leading-5 text-slate-600">• {unknown}</p>
                    ))}
                  </div>
                </div>
              )}

              {deterministicAnalysis.actions.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Prioritized actions</p>
                  <div className="mt-3 grid gap-3">
                    {deterministicAnalysis.actions.map((action, index) => (
                      <div key={`${action.title}-${index}`} className="rounded-2xl bg-white p-4 shadow-sm">
                        <div className="flex gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">{index + 1}</span>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900">{action.title}</p>
                              <span className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${action.priority === "High" ? "bg-red-50 text-red-700" : action.priority === "Medium" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}><span className={`h-2 w-2 rounded-full ${action.priority === "High" ? "bg-red-500" : action.priority === "Medium" ? "bg-amber-400" : "bg-emerald-500"}`} aria-hidden="true" />{action.priority === "Watch" ? "Monitor" : action.priority}</span>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-slate-500">{action.rationale}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          </div>

          <Footer onNavigate={(href) => {
            setShowAnalysis(false);
            window.setTimeout(() => {
              document.querySelector(href)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 0);
          }} />
        </div>
      )}
    </div>
  );
}
