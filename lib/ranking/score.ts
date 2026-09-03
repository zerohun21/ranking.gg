/**
 * 베이지안 점수 (IMDb 방식)
 *   score = (v/(v+m))*R + (m/(v+m))*C
 *   R = 항목 평균(0.5~5), v = 평가 수, C = 카테고리 전체 평균(가중), m = 평가 수 25백분위(최소 10)
 * 표시는 10점 만점(×2), 소수 2자리. Postgres `recompute_category` 와 동일 결과를 내야 한다.
 */

export const MIN_M = 10;
export const MIN_RATINGS_FOR_TIER = 5;

export type RatedItem = { avg: number; count: number };

/** Postgres round(numeric, 2) 와 동일: half away from zero */
export function round2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

/** 카테고리 전체 평균 C (가중 평균, 5점 척도). 평가가 없으면 0 */
export function categoryMean(items: RatedItem[]): number {
  let sum = 0;
  let n = 0;
  for (const it of items) {
    sum += it.avg * it.count;
    n += it.count;
  }
  return n === 0 ? 0 : sum / n;
}

/** percentile_cont(p) — 선형 보간. Postgres 와 동일 */
export function percentileCont(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = p * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (pos - lo) * (sorted[hi] - sorted[lo]);
}

/** m = 평가 수(>0 인 항목만) 25 백분위, 최소 MIN_M */
export function computeM(items: RatedItem[]): number {
  const counts = items.filter((i) => i.count > 0).map((i) => i.count);
  return Math.max(MIN_M, percentileCont(counts, 0.25));
}

/** 10점 만점 베이지안 점수. 평가 0개면 0 */
export function bayesianScore(avg: number, count: number, c: number, m: number): number {
  if (count <= 0) return 0;
  const v = count;
  const raw = (v / (v + m)) * avg + (m / (v + m)) * c;
  return round2(raw * 2);
}
