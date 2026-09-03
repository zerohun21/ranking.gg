export const ELO_K = 24;
export const ELO_INITIAL = 1500;

export function eloExpected(ra: number, rb: number): number {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400));
}

/** winner='a' 면 a 승. 반환은 새 레이팅 */
export function eloUpdate(ra: number, rb: number, winner: "a" | "b", k = ELO_K): { a: number; b: number } {
  const ea = eloExpected(ra, rb);
  const sa = winner === "a" ? 1 : 0;
  const a = ra + k * (sa - ea);
  const b = rb + k * (1 - sa - (1 - ea));
  return { a, b };
}
