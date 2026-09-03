/**
 * HOT 점수: 최근 7일 활동 가중합 + 시간 감쇠(반감기 3일)
 *   별점 ×1 · 리뷰 ×3 · 댓글 ×1 · 대결 투표 ×0.5
 */
export const HOT_WEIGHTS = { rating: 1, review: 3, comment: 1, vote: 0.5 } as const;
export const HOT_WINDOW_DAYS = 7;
export const HOT_HALF_LIFE_DAYS = 3;

export type HotEvent = { type: keyof typeof HOT_WEIGHTS; at: Date };

export function decay(ageDays: number, halfLife = HOT_HALF_LIFE_DAYS): number {
  return Math.pow(0.5, ageDays / halfLife);
}

export function hotScore(events: HotEvent[], now: Date = new Date()): number {
  let s = 0;
  for (const e of events) {
    const ageDays = (now.getTime() - e.at.getTime()) / 86_400_000;
    if (ageDays < 0 || ageDays > HOT_WINDOW_DAYS) continue;
    s += HOT_WEIGHTS[e.type] * decay(ageDays);
  }
  return s;
}
