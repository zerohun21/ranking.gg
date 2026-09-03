import { unstable_cache } from "next/cache";
import { and, asc, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, contentGenres, contents, contentStats, genres, type Tier } from "@/lib/db/schema";

export type RankingSort = "rank" | "ratings" | "hot" | "elo" | "newest";
export type RankingFilters = {
  genres?: string[];
  platforms?: string[];
  yearFrom?: number;
  yearTo?: number;
  status?: string[];
  tiers?: Tier[];
  minRatings?: number;
  sort?: RankingSort;
  page?: number;
  perPage?: number;
  adult?: boolean;
  kind?: string; // drama: 'tv' | 'variety'
  q?: string;
};

export type RankingRow = {
  id: number;
  slug: string;
  title: string;
  titleOriginal: string | null;
  posterUrl: string | null;
  releaseYear: number | null;
  metadata: Record<string, unknown>;
  isAdult: boolean;
  externalScore: number | null;
  rank: number | null;
  prevRank: number | null;
  rankDelta: number | null;
  tier: Tier | null;
  bayesianScore: string;
  ratingCount: number;
  ratingAvg: string;
  hotScore: number;
  elo: number;
  eloWins: number;
  eloLosses: number;
  reviewCount: number;
  dist: number[];
  bestComment: string | null;
};

function buildWhere(categoryId: number, f: RankingFilters): SQL {
  const conds: SQL[] = [eq(contents.categoryId, categoryId), eq(contents.isApproved, true)];
  if (!f.adult) conds.push(eq(contents.isAdult, false));
  if (f.genres?.length) {
    conds.push(
      sql`exists (select 1 from ${contentGenres} cg join ${genres} g on g.id = cg.genre_id where cg.content_id = ${contents.id} and g.slug in (${sql.join(f.genres.map((g) => sql`${g}`), sql`, `)}))`,
    );
  }
  if (f.platforms?.length) conds.push(sql`(${contents.metadata} -> 'platforms') ?| ${sql`array[${sql.join(f.platforms.map((p) => sql`${p}`), sql`, `)}]::text[]`}`);
  if (f.yearFrom) conds.push(gte(contents.releaseYear, f.yearFrom));
  if (f.yearTo) conds.push(lte(contents.releaseYear, f.yearTo));
  if (f.status?.length) conds.push(sql`(${contents.metadata} ->> 'status') in (${sql.join(f.status.map((s) => sql`${s}`), sql`, `)})`);
  if (f.kind) conds.push(sql`(${contents.metadata} ->> 'kind') = ${f.kind}`);
  if (f.tiers?.length) conds.push(sql`${contentStats.tier} in (${sql.join(f.tiers.map((t) => sql`${t}::tier`), sql`, `)})`);
  if (f.minRatings) conds.push(gte(contentStats.ratingCount, f.minRatings));
  if (f.q) conds.push(sql`(${contents.title} ilike ${"%" + f.q + "%"} or ${contents.titleOriginal} ilike ${"%" + f.q + "%"})`);
  return and(...conds)!;
}

function orderBy(sort: RankingSort | undefined) {
  switch (sort) {
    case "ratings":
      return [desc(contentStats.ratingCount), asc(contentStats.rank)];
    case "hot":
      return [desc(contentStats.hotScore), asc(contentStats.rank)];
    case "elo":
      return [desc(contentStats.elo), asc(contentStats.rank)];
    case "newest":
      return [sql`${contents.releaseDate} desc nulls last`, asc(contentStats.rank)];
    default:
      return [sql`${contentStats.rank} asc nulls last`, desc(contentStats.ratingCount), asc(contents.title)];
  }
}

const rowSelect = {
  id: contents.id,
  slug: contents.slug,
  title: contents.title,
  titleOriginal: contents.titleOriginal,
  posterUrl: contents.posterUrl,
  releaseYear: contents.releaseYear,
  metadata: contents.metadata,
  isAdult: contents.isAdult,
  externalScore: contents.externalScore,
  rank: contentStats.rank,
  prevRank: contentStats.prevRank,
  rankDelta: contentStats.rankDelta,
  tier: contentStats.tier,
  bayesianScore: contentStats.bayesianScore,
  ratingCount: contentStats.ratingCount,
  ratingAvg: contentStats.ratingAvg,
  hotScore: contentStats.hotScore,
  elo: contentStats.elo,
  eloWins: contentStats.eloWins,
  eloLosses: contentStats.eloLosses,
  reviewCount: contentStats.reviewCount,
  dist: sql<number[]>`array[${contentStats.dist1},${contentStats.dist2},${contentStats.dist3},${contentStats.dist4},${contentStats.dist5},${contentStats.dist6},${contentStats.dist7},${contentStats.dist8},${contentStats.dist9},${contentStats.dist10}]`,
  bestComment: sql<string | null>`(select r.body from reviews r where r.content_id = ${contents.id} and not r.is_hidden order by (r.like_count - r.dislike_count) desc, r.created_at desc limit 1)`,
};

async function _getRanking(categoryId: number, f: RankingFilters): Promise<{ rows: RankingRow[]; total: number }> {
  const perPage = Math.min(100, f.perPage ?? 50);
  const page = Math.max(1, f.page ?? 1);
  const where = buildWhere(categoryId, f);
  const [rows, totalRow] = await Promise.all([
    db
      .select(rowSelect)
      .from(contents)
      .innerJoin(contentStats, eq(contentStats.contentId, contents.id))
      .where(where)
      .orderBy(...orderBy(f.sort))
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.select({ n: sql<number>`count(*)::int` }).from(contents).innerJoin(contentStats, eq(contentStats.contentId, contents.id)).where(where),
  ]);
  return { rows: rows as RankingRow[], total: totalRow[0]?.n ?? 0 };
}

export const getRanking = (categoryId: number, f: RankingFilters) =>
  unstable_cache(() => _getRanking(categoryId, f), ["ranking", String(categoryId), JSON.stringify(f)], { revalidate: 60, tags: [`ranking-${categoryId}`] })();

/** 티어 보드용: 티어별 상위 N (포스터 그리드) */
export const getTierBoard = (categoryId: number, f: RankingFilters, perTier = 40) =>
  unstable_cache(
    async () => {
      const where = buildWhere(categoryId, { ...f, tiers: undefined });
      const rows = await db
        .select(rowSelect)
        .from(contents)
        .innerJoin(contentStats, eq(contentStats.contentId, contents.id))
        .where(and(where, sql`${contentStats.tier} is not null`))
        .orderBy(sql`${contentStats.rank} asc nulls last`)
        .limit(perTier * 5 + 200);
      const out: Record<Tier, RankingRow[]> = { S: [], A: [], B: [], C: [], D: [] };
      for (const r of rows as RankingRow[]) if (r.tier && out[r.tier].length < perTier) out[r.tier].push(r);
      return out;
    },
    ["tierboard", String(categoryId), JSON.stringify(f), String(perTier)],
    { revalidate: 60, tags: [`ranking-${categoryId}`] },
  )();

export type CategorySummary = {
  items: number;
  ratings: number;
  riser: RankingRow | null;
  faller: RankingRow | null;
  years: { min: number | null; max: number | null };
  genres: { slug: string; nameKo: string; nameEn: string; count: number }[];
  platforms: { key: string; count: number }[];
};

export const getCategorySummary = (categoryId: number) =>
  unstable_cache(
    async (): Promise<CategorySummary> => {
      const [agg] = await db
        .select({ items: sql<number>`count(*)::int`, ratings: sql<number>`coalesce(sum(${contentStats.ratingCount}),0)::int`, minYear: sql<number | null>`min(${contents.releaseYear})`, maxYear: sql<number | null>`max(${contents.releaseYear})` })
        .from(contents)
        .innerJoin(contentStats, eq(contentStats.contentId, contents.id))
        .where(and(eq(contents.categoryId, categoryId), eq(contents.isApproved, true)));
      const movers = await db
        .select(rowSelect)
        .from(contents)
        .innerJoin(contentStats, eq(contentStats.contentId, contents.id))
        .where(and(eq(contents.categoryId, categoryId), eq(contents.isApproved, true), eq(contents.isAdult, false), sql`${contentStats.rankDelta} is not null`, gte(contentStats.ratingCount, 5)))
        .orderBy(desc(contentStats.rankDelta))
        .limit(1);
      const fallers = await db
        .select(rowSelect)
        .from(contents)
        .innerJoin(contentStats, eq(contentStats.contentId, contents.id))
        .where(and(eq(contents.categoryId, categoryId), eq(contents.isApproved, true), eq(contents.isAdult, false), sql`${contentStats.rankDelta} is not null`, gte(contentStats.ratingCount, 5)))
        .orderBy(asc(contentStats.rankDelta))
        .limit(1);
      const genreRows = await db
        .select({ slug: genres.slug, nameKo: genres.nameKo, nameEn: genres.nameEn, count: sql<number>`count(*)::int` })
        .from(genres)
        .innerJoin(contentGenres, eq(contentGenres.genreId, genres.id))
        .where(eq(genres.categoryId, categoryId))
        .groupBy(genres.id)
        .orderBy(desc(sql`count(*)`))
        .limit(30);
      const platformRows = await db.execute<{ key: string; count: number }>(
        sql`select p as key, count(*)::int as count from contents c, jsonb_array_elements_text(coalesce(c.metadata->'platforms','[]'::jsonb)) p where c.category_id = ${categoryId} and c.is_approved group by p order by count desc limit 20`,
      );
      return {
        items: agg?.items ?? 0,
        ratings: agg?.ratings ?? 0,
        riser: (movers[0] as RankingRow) ?? null,
        faller: (fallers[0] as RankingRow) ?? null,
        years: { min: agg?.minYear ?? null, max: agg?.maxYear ?? null },
        genres: genreRows,
        platforms: [...platformRows],
      };
    },
    ["category-summary", String(categoryId)],
    { revalidate: 120, tags: [`ranking-${categoryId}`] },
  )();

export const getTopN = (categoryId: number, n = 10) =>
  unstable_cache(
    async () =>
      (await db
        .select(rowSelect)
        .from(contents)
        .innerJoin(contentStats, eq(contentStats.contentId, contents.id))
        .where(and(eq(contents.categoryId, categoryId), eq(contents.isApproved, true), eq(contents.isAdult, false), sql`${contentStats.rank} is not null`))
        .orderBy(asc(contentStats.rank))
        .limit(n)) as RankingRow[],
    ["topn", String(categoryId), String(n)],
    { revalidate: 60, tags: [`ranking-${categoryId}`] },
  )();

export type RisingRow = RankingRow & { categorySlug: string; categoryName: string; categoryIcon: string };
export const getRising = (n = 10, categoryId?: number) =>
  unstable_cache(
    async () =>
      (await db
        .select({ ...rowSelect, categorySlug: categories.slug, categoryName: categories.nameKo, categoryIcon: categories.icon })
        .from(contents)
        .innerJoin(contentStats, eq(contentStats.contentId, contents.id))
        .innerJoin(categories, eq(categories.id, contents.categoryId))
        .where(and(eq(contents.isApproved, true), eq(contents.isAdult, false), sql`${contentStats.hotScore} > 0`, categoryId ? eq(contents.categoryId, categoryId) : undefined))
        .orderBy(desc(contentStats.hotScore))
        .limit(n)) as RisingRow[],
    ["rising", String(n), String(categoryId ?? "all")],
    { revalidate: 60, tags: ["ranking"] },
  )();
