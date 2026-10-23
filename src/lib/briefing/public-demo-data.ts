import type { BriefingData } from "./engine";

/**
 * Fictitious accounting scenario, intentionally isolated from every customer
 * workspace, QuickBooks connection, billing flow, local cache and Supabase.
 * This fixture powers the REAL CFOBriefing component on the public demo page.
 * The figures below are illustrative, not an AI-generated customer analysis.
 */
const months = ["Apr 2026", "May 2026", "Jun 2026", "Jul 2026", "Aug 2026", "Sep 2026"];

export const publicDemoBriefing: BriefingData = {
  companyName: "Oak Street Supply (fictional)",
  source: "demo",
  revenue: 132000,
  revenueChange: 10,
  grossProfit: 39600,
  grossMargin: 30,
  marginChange: -5,
  operatingExpense: 25000,
  previousOperatingExpense: 23000,
  operatingIncome: 14600,
  cash: 42000,
  previousCash: 58000,
  cashChange: (42000 - 58000) / 58000 * 100,
  cashAsOfDate: "Sep 30, 2026",
  inventory: 112000,
  previousInventory: 80000,
  inventoryChange: 40,
  attention: 3,
  alerts: [
    "Inventory grew 40.0% while monthly revenue grew 10.0%.",
    "Cash declined by $16,000 while receivables rose by $15,000.",
    "Gross margin declined by 5 percentage points.",
  ],
  recommendation: "Review inventory purchasing, receivable collections and the gross-margin drivers before changing operations.",
  impact: 0,
  impactReason: "Financial movements warrant investigation; potential savings cannot be estimated from these totals alone.",
  trend: [105000, 110000, 112000, 116000, 120000, 132000],
  periods: months,
  health: "watch",
  confidence: 0.8,
  drivers: [
    {
      id: "inventory-building", category: "Inventory", severity: "High", direction: "up",
      title: "Inventory is building faster than sales",
      observation: "Inventory increased $32,000 (40.0%) versus a $12,000 (10.0%) revenue increase.",
      evidence: ["Inventory: $80,000 → $112,000", "Revenue: $120,000 → $132,000"],
      impact: 0, confidence: 0.95,
      managementQuestion: "Are buying levels aligned with demand and stock turnover?",
    },
    {
      id: "cash-decline", category: "Cash", severity: "Medium", direction: "down",
      title: "Cash fell despite stronger sales",
      observation: "Cash fell $16,000, from $58,000 to $42,000, while receivables grew by $15,000. These movements do not establish causation.",
      evidence: ["Cash: $58,000 → $42,000", "Receivables: $46,000 → $61,000"],
      impact: 0, confidence: 0.95,
      managementQuestion: "What do the receivables aging and cash-flow statement reveal about the timing?",
    },
    {
      id: "margin-narrowing", category: "Margin", severity: "Medium", direction: "down",
      title: "Gross margin narrowed",
      observation: "Gross margin decreased from 35.0% to 30.0% even though revenue rose.",
      evidence: ["Gross profit: $42,000 → $39,600", "Cost of goods sold: $78,000 → $92,400"],
      impact: 0, confidence: 0.95,
      managementQuestion: "Was the margin change driven by pricing, direct costs, or product mix?",
    },
  ],
  managementQuestions: [
    { category: "Inventory", question: "Inventory increased $32,000 while sales increased $12,000. What does the stock-aging report and purchasing schedule show?" },
    { category: "Cash", question: "Cash fell by $16,000 while receivables increased by $15,000. What changed in collections, payments, and owner distributions?" },
    { category: "Margin", question: "Gross margin fell from 35.0% to 30.0%. Which products, prices or cost categories contributed to the change?" },
  ],
  relationships: [
    "Inventory grew faster than revenue.",
    "Revenue rose while cash declined; no cause is established from monthly totals.",
  ],
  detailDrivers: [],
  trendInsights: [
    "September revenue exceeded August revenue by $12,000.",
    "Cash declined in the latest reported period.",
    "Gross margin declined from 35% to 30%.",
  ],
  trendSeries: [
    { name: "Revenue", values: [105000, 110000, 112000, 116000, 120000, 132000], periods: months },
    { name: "Gross Margin", values: [36, 36, 35, 35, 35, 30], periods: months },
    { name: "Cash Position", values: [66000, 62000, 60000, 59000, 58000, 42000], periods: months },
    { name: "Inventory", values: [68000, 74000, 77000, 79000, 80000, 112000], periods: months },
  ],
  unknowns: [
    "We do not have inventory aging or item-level sales history.",
    "We do not have a cash-flow statement to explain the decline.",
    "We do not have product-level pricing and cost mix.",
  ],
  dataAvailability: { cash: true, inventory: true },
  kpiBreakdowns: {
    revenue: {
      title: "Revenue by channel (illustrative)", periodLabel: "September 2026", variant: "bars",
      rows: [
        { label: "Wholesale", previous: 72000, current: 78000 },
        { label: "Retail", previous: 48000, current: 54000 },
      ],
      insight: "Wholesale and retail together account for all $132,000 in illustrated September sales.",
    },
    margin: {
      title: "Gross profit bridge (illustrative)", periodLabel: "September 2026", variant: "walk",
      rows: [
        { label: "Revenue", previous: 120000, current: 132000 },
        { label: "Cost of goods sold", previous: 78000, current: 92400 },
        { label: "Gross profit", previous: 42000, current: 39600 },
      ],
      insight: "Sales rose, but cost of goods sold rose faster; the example does not isolate the underlying business cause.",
    },
    cash: {
      title: "Cash at period end (illustrative)", periodLabel: "September 2026", variant: "walk",
      rows: [{ label: "Month-end cash balance", previous: 58000, current: 42000 }],
      insight: "A $16,000 change in cash is observable; the cash-flow statement is needed to explain its drivers.",
    },
    inventory: {
      title: "Inventory composition (illustrative)", periodLabel: "September 2026", variant: "bars",
      rows: [
        { label: "Finished goods", previous: 47000, current: 68000 },
        { label: "Materials", previous: 33000, current: 44000 },
      ],
      insight: "The example does not contain inventory aging or usage. These balances alone cannot identify slow-moving stock.",
    },
  },
  emergingConstraints: [],
};
