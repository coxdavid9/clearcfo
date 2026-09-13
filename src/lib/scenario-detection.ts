/**
 * scenario-detection.ts
 *
 * Pure, framework-free financial-pattern detectors shared by the client
 * workbook parser (CFOBriefing) and the /api/cfo-analysis route.
 */

export type SpikeDetection = {
  index: number;
  length: number;
  peak: number;
  baseline: number;
  excess: number;
};

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function detectExpenseSpikeRecovery(
  values: number[],
  opts: {
    singlePeriodRatio?: number;
    singlePeriodRecoveryTolerance?: number;
    plateauMinAvgRatio?: number;
    plateauMinPeriodRatio?: number;
    plateauRecoveryTolerance?: number;
    maxPlateauLength?: number;
    minExcessDollars?: number;
  } = {}
): SpikeDetection | null {
  const {
    singlePeriodRatio = 1.5,
    singlePeriodRecoveryTolerance = 0.2,
    plateauMinAvgRatio = 1.12,
    plateauMinPeriodRatio = 1.05,
    plateauRecoveryTolerance = 0.3,
    maxPlateauLength = 6,
    minExcessDollars = 0,
  } = opts;

  const clean = values.filter((value) => Number.isFinite(value));
  if (clean.length < 4) return null;

  let best: SpikeDetection | null = null;
  const consider = (candidate: SpikeDetection) => {
    if (candidate.excess < minExcessDollars) return;
    if (!best || candidate.excess > best.excess) best = candidate;
  };

  for (let i = 1; i < clean.length - 1; i += 1) {
    const before = clean[i - 1];
    const peak = clean[i];
    const after = clean[i + 1];
    if (before <= 0 || peak <= 0 || after <= 0) continue;
    const baseline = (before + after) / 2;
    if (baseline <= 0) continue;
    const deviation = (peak - baseline) / baseline;
    const recovery = Math.abs(after - baseline) / baseline;
    if (deviation >= singlePeriodRatio - 1 && recovery <= singlePeriodRecoveryTolerance) {
      consider({ index: i, length: 1, peak, baseline, excess: Math.max(0, peak - baseline) });
    }
  }

  for (let k = 2; k <= maxPlateauLength; k += 1) {
    for (let i = 1; i + k + 1 < clean.length; i += 1) {
      const pre = clean.slice(Math.max(0, i - 3), i);
      const window = clean.slice(i, i + k);
      const post = clean.slice(i + k, i + k + 3);
      if (pre.length < 2 || post.length < 2) continue;
      if (pre.some((value) => value <= 0) || window.some((value) => value <= 0) || post.some((value) => value <= 0)) continue;
      const baseline = mean(pre);
      if (baseline <= 0) continue;
      const windowMean = mean(window);
      if (windowMean < baseline * plateauMinAvgRatio) continue;
      if (window.some((value) => value < baseline * plateauMinPeriodRatio)) continue;
      const postMean = mean(post);
      if (Math.abs(postMean - baseline) / baseline > plateauRecoveryTolerance) continue;
      consider({
        index: i,
        length: k,
        peak: Math.max(...window),
        baseline,
        excess: Math.max(0, window.reduce((sum, value) => sum + value, 0) - k * baseline),
      });
    }
  }

  return best;
}

export type InventoryOutpacing = {
  invGrowth: number;
  revGrowth: number;
};

export function inventoryOutpacesRevenue(
  inventoryValues: number[],
  revenueValues: number[],
  minGapPoints = 3,
  minAbsoluteGrowth = 15
): InventoryOutpacing | null {
  const inv = inventoryValues.filter((value) => Number.isFinite(value));
  const rev = revenueValues.filter((value) => Number.isFinite(value));
  const n = Math.min(inv.length, rev.length);
  if (n < 3) return null;
  const invStart = inv[0];
  const invEnd = inv[n - 1];
  const revStart = rev[0];
  const revEnd = rev[n - 1];
  if (!(invStart > 0) || !(revStart > 0)) return null;
  const invGrowth = ((invEnd - invStart) / Math.abs(invStart)) * 100;
  const revGrowth = ((revEnd - revStart) / Math.abs(revStart)) * 100;
  if (invGrowth >= minAbsoluteGrowth && invGrowth > revGrowth + minGapPoints) {
    return { invGrowth, revGrowth };
  }
  return null;
}
