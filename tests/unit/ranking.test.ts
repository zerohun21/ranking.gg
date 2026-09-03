import { describe, expect, it } from "vitest";
import { bayesianScore, categoryMean, computeM, percentileCont, round2 } from "@/lib/ranking/score";
import { tierFor, tierForPercentile } from "@/lib/ranking/tier";
import { rankCategory } from "@/lib/ranking/rank";
import { eloExpected, eloUpdate } from "@/lib/ranking/elo";
import { hotScore } from "@/lib/ranking/hot";

describe("bayesian", () => {
  it("weights toward category mean when few ratings", () => {
    // R=5, v=1, C=3, m=10 → (1/11)*5 + (10/11)*3 = 3.1818 → ×2 = 6.36
    expect(bayesianScore(5, 1, 3, 10)).toBe(6.36);
  });
  it("approaches own average with many ratings", () => {
    expect(bayesianScore(4.5, 10_000, 3, 10)).toBe(9.0);
  });
  it("zero ratings → 0", () => {
    expect(bayesianScore(4, 0, 3, 10)).toBe(0);
  });
  it("round2 rounds half away from zero like postgres", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
  });
  it("categoryMean is weighted", () => {
    expect(categoryMean([{ avg: 5, count: 1 }, { avg: 1, count: 3 }])).toBe(2);
    expect(categoryMean([])).toBe(0);
  });
  it("percentile_cont interpolates linearly", () => {
    expect(percentileCont([1, 2, 3, 4], 0.25)).toBe(1.75);
    expect(percentileCont([10], 0.25)).toBe(10);
  });
  it("m has floor of 10", () => {
    expect(computeM([{ avg: 3, count: 1 }, { avg: 3, count: 2 }])).toBe(10);
    expect(computeM([{ avg: 3, count: 100 }, { avg: 3, count: 200 }, { avg: 3, count: 300 }, { avg: 3, count: 400 }])).toBe(175);
  });
});

describe("tier", () => {
  it("cutoffs", () => {
    expect(tierForPercentile(0)).toBe("S");
    expect(tierForPercentile(0.049)).toBe("S");
    expect(tierForPercentile(0.05)).toBe("A");
    expect(tierForPercentile(0.149)).toBe("A");
    expect(tierForPercentile(0.15)).toBe("B");
    expect(tierForPercentile(0.35)).toBe("C");
    expect(tierForPercentile(0.7)).toBe("D");
    expect(tierForPercentile(0.99)).toBe("D");
  });
  it("distribution over 100 items", () => {
    const tiers = Array.from({ length: 100 }, (_, i) => tierFor(i + 1, 100));
    const count = (t: string) => tiers.filter((x) => x === t).length;
    expect(count("S")).toBe(5);
    expect(count("A")).toBe(10);
    expect(count("B")).toBe(20);
    expect(count("C")).toBe(35);
    expect(count("D")).toBe(30);
  });
  it("first item is always S", () => {
    expect(tierFor(1, 1)).toBe("S");
    expect(tierFor(1, 3)).toBe("S");
  });
});

describe("rankCategory", () => {
  it("orders by score, then count, then title; assigns tier only when count>=5", () => {
    const out = rankCategory([
      { id: 1, title: "b", avg: 4.5, count: 100 },
      { id: 2, title: "a", avg: 4.5, count: 100 },
      { id: 3, title: "c", avg: 5, count: 2 },
      { id: 4, title: "d", avg: 1, count: 50, prevRank: 1 },
      { id: 5, title: "e", avg: 3, count: 0 },
    ]);
    const byId = Object.fromEntries(out.map((o) => [o.id, o]));
    expect(byId[2].rank).toBe(1);
    expect(byId[1].rank).toBe(2);
    expect(byId[3].tier).toBeNull();
    expect(byId[5].rank).toBe(5);
    expect(byId[5].bayesianScore).toBe(0);
    expect(byId[4].rankDelta).toBe(1 - byId[4].rank!);
    expect(byId[1].rankDelta).toBeNull();
  });
  it("unapproved items get null rank", () => {
    const out = rankCategory([
      { id: 1, title: "a", avg: 4, count: 10, approved: false },
      { id: 2, title: "b", avg: 3, count: 10 },
    ]);
    expect(out[0].rank).toBeNull();
    expect(out[1].rank).toBe(1);
  });
});

describe("elo", () => {
  it("equal ratings → 0.5 expected", () => {
    expect(eloExpected(1500, 1500)).toBe(0.5);
  });
  it("K=24 update is symmetric", () => {
    const { a, b } = eloUpdate(1500, 1500, "a");
    expect(a).toBe(1512);
    expect(b).toBe(1488);
  });
});

describe("hot", () => {
  const now = new Date("2026-09-03T00:00:00Z");
  it("fresh events count fully, 3-day-old at half, >7d ignored", () => {
    const d = (days: number) => new Date(now.getTime() - days * 86_400_000);
    expect(hotScore([{ type: "review", at: d(0) }], now)).toBe(3);
    expect(hotScore([{ type: "rating", at: d(3) }], now)).toBeCloseTo(0.5);
    expect(hotScore([{ type: "vote", at: d(8) }], now)).toBe(0);
  });
});
