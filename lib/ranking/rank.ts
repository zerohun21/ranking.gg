import { bayesianScore, categoryMean, computeM, MIN_RATINGS_FOR_TIER } from "./score";
import { tierFor } from "./tier";
import type { Tier } from "@/lib/db/schema";

export type RankInput = {
  id: number;
  title: string;
  avg: number; // 0.5~5
  count: number;
  approved?: boolean;
  prevRank?: number | null;
};

export type RankOutput = {
  id: number;
  bayesianScore: number;
  rank: number | null;
  tier: Tier | null;
  prevRank: number | null;
  rankDelta: number | null;
};

/** 바이트 순 비교 — Postgres `collate "C"` 와 동일 */
function cmpC(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * 카테고리 하나를 통째로 재계산. Postgres `recompute_category` 의 TS 미러.
 * 정렬: bayesian desc → count desc → title (C collation)
 */
export function rankCategory(items: RankInput[]): RankOutput[] {
  const c = categoryMean(items);
  const m = computeM(items);
  const scored = items.map((it) => ({ ...it, score: bayesianScore(it.avg, it.count, c, m) }));
  const approved = scored.filter((s) => s.approved !== false);
  approved.sort((a, b) => b.score - a.score || b.count - a.count || cmpC(a.title, b.title));

  const eligibleCount = approved.filter((s) => s.count >= MIN_RATINGS_FOR_TIER).length;
  let eligibleRank = 0;
  const out = new Map<number, RankOutput>();
  approved.forEach((s, i) => {
    const rank = i + 1;
    let tier: Tier | null = null;
    if (s.count >= MIN_RATINGS_FOR_TIER) {
      eligibleRank += 1;
      tier = tierFor(eligibleRank, eligibleCount);
    }
    const prevRank = s.prevRank ?? null;
    out.set(s.id, {
      id: s.id,
      bayesianScore: s.score,
      rank,
      tier,
      prevRank,
      rankDelta: prevRank == null ? null : prevRank - rank,
    });
  });
  for (const s of scored) {
    if (!out.has(s.id)) out.set(s.id, { id: s.id, bayesianScore: s.score, rank: null, tier: null, prevRank: null, rankDelta: null });
  }
  return items.map((it) => out.get(it.id)!);
}
