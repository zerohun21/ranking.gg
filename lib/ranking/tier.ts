import type { Tier } from "@/lib/db/schema";

/**
 * 티어 = 카테고리 내 (평가 수 ≥ 5 인 항목들 사이) 순위 백분위
 *   p = (eligibleRank - 1) / eligibleCount   (0 = 최상위)
 *   S: p < 0.05 · A: < 0.15 · B: < 0.35 · C: < 0.70 · D: 나머지
 */
export const TIER_CUTS: ReadonlyArray<[Tier, number]> = [
  ["S", 0.05],
  ["A", 0.15],
  ["B", 0.35],
  ["C", 0.7],
];

export function tierForPercentile(p: number): Tier {
  for (const [tier, cut] of TIER_CUTS) if (p < cut) return tier;
  return "D";
}

export function tierFor(eligibleRank: number, eligibleCount: number): Tier | null {
  if (eligibleCount <= 0 || eligibleRank <= 0) return null;
  return tierForPercentile((eligibleRank - 1) / eligibleCount);
}

export const TIER_COLORS: Record<Tier, string> = {
  S: "#ff4e50",
  A: "#ff8a3d",
  B: "#5383e8",
  C: "#00bba3",
  D: "#9aa4af",
};
export const TIER_ORDER: Tier[] = ["S", "A", "B", "C", "D"];
