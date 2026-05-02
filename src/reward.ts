import type { ChaosClassification } from "./chaos-classify.js";
import { crossCreatureDrift } from "./drift.js";
import type { Loot, TrollVerdict } from "./types.js";

export function shinies(loot: Loot, verdict: TrollVerdict): number {
  const cross = crossCreatureDrift(loot.output, loot.creatureKind);
  const driftPenalty = Math.min(0.5, cross * 4);
  const trollScore = clamp01(verdict.score);
  const passBonus = verdict.passed ? 0.1 : 0;
  return clamp01(trollScore - driftPenalty + passBonus);
}

/**
 * Enhanced reward that factors in Gremlin chaos classification.
 *
 * - If the Gremlin found NO defects, the output gets a resilience bonus.
 * - If there are critical/major defects, a severity penalty is applied on top
 *   of the drift penalty.
 * - Falls back to plain `shinies` if no classification is provided.
 */
export function informedShinies(
  loot: Loot,
  verdict: TrollVerdict,
  chaos?: ChaosClassification,
): number {
  const base = shinies(loot, verdict);
  if (!chaos) return base;

  if (chaos.noDefectsFound) {
    // Gremlin couldn't break it — reward resilience
    return clamp01(base + 0.08);
  }
  // Severity penalty: severityScore is 0-1, scale to max 0.15 penalty
  const severityPenalty = chaos.severityScore * 0.15;
  return clamp01(base - severityPenalty);
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
