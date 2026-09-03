import { createSearchParamsCache, parseAsArrayOf, parseAsBoolean, parseAsInteger, parseAsString, parseAsStringEnum } from "nuqs/server";
import type { Tier } from "@/lib/db/schema";

export const SORTS = ["rank", "ratings", "hot", "elo", "newest"] as const;
export const VIEWS = ["list", "board"] as const;

export const rankingParsers = {
  view: parseAsStringEnum([...VIEWS]).withDefault("list"),
  sort: parseAsStringEnum([...SORTS]).withDefault("rank"),
  page: parseAsInteger.withDefault(1),
  genre: parseAsArrayOf(parseAsString).withDefault([]),
  platform: parseAsArrayOf(parseAsString).withDefault([]),
  status: parseAsArrayOf(parseAsString).withDefault([]),
  tier: parseAsArrayOf(parseAsStringEnum<Tier>(["S", "A", "B", "C", "D"])).withDefault([]),
  yearFrom: parseAsInteger,
  yearTo: parseAsInteger,
  minRatings: parseAsInteger.withDefault(0),
  kind: parseAsString,
  adult: parseAsBoolean.withDefault(false),
  q: parseAsString,
};
export const rankingParamsCache = createSearchParamsCache(rankingParsers);
export type RankingParams = ReturnType<typeof rankingParamsCache.parse>;
