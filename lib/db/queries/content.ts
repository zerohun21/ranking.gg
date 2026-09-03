import { unstable_cache } from "next/cache";
import { and, asc, desc, eq, gte, inArray, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { battles, categories, comments, contentGenres, contents, contentStats, genres, posts, profiles, rankSnapshots, ratings, reviews, type Category, type Content, type ContentStat } from "@/lib/db/schema";

export type ContentDetail = {
  content: Content;
  category: Category;
  stats: ContentStat;
  genres: { slug: string; nameKo: string; nameEn: string }[];
};

export async function getContentBySlug(categorySlug: string, slug: string): Promise<ContentDetail | null> {
  const rows = await db
    .select({ content: contents, category: categories, stats: contentStats })
    .from(contents)
    .innerJoin(categories, eq(categories.id, contents.categoryId))
    .innerJoin(contentStats, eq(contentStats.contentId, contents.id))
    .where(and(eq(categories.slug, categorySlug), eq(contents.slug, slug)))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  const g = await db
    .select({ slug: genres.slug, nameKo: genres.nameKo, nameEn: genres.nameEn })
    .from(contentGenres)
    .innerJoin(genres, eq(genres.id, contentGenres.genreId))
    .where(eq(contentGenres.contentId, r.content.id));
  return { ...r, genres: g };
}

export async function getContentById(id: number) {
  const rows = await db
    .select({ content: contents, category: categories, stats: contentStats })
    .from(contents)
    .innerJoin(categories, eq(categories.id, contents.categoryId))
    .innerJoin(contentStats, eq(contentStats.contentId, contents.id))
    .where(eq(contents.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export type RivalRow = { id: number; slug: string; title: string; posterUrl: string | null; rank: number | null; tier: ContentStat["tier"]; bayesianScore: string; ratingCount: number; elo: number; eloWins: number; eloLosses: number };
const rivalSelect = { id: contents.id, slug: contents.slug, title: contents.title, posterUrl: contents.posterUrl, rank: contentStats.rank, tier: contentStats.tier, bayesianScore: contentStats.bayesianScore, ratingCount: contentStats.ratingCount, elo: contentStats.elo, eloWins: contentStats.eloWins, eloLosses: contentStats.eloLosses };

/** 바로 위 / 아래 순위 */
export async function getRivals(categoryId: number, rank: number | null): Promise<{ above: RivalRow | null; below: RivalRow | null }> {
  if (!rank) return { above: null, below: null };
  const rows = await db
    .select(rivalSelect)
    .from(contents)
    .innerJoin(contentStats, eq(contentStats.contentId, contents.id))
    .where(and(eq(contents.categoryId, categoryId), or(eq(contentStats.rank, rank - 1), eq(contentStats.rank, rank + 1))));
  return { above: rows.find((r) => r.rank === rank - 1) ?? null, below: rows.find((r) => r.rank === rank + 1) ?? null };
}

export async function getRankHistory(contentId: number) {
  return db
    .select({ week: rankSnapshots.snapshotWeek, rank: rankSnapshots.rank, score: rankSnapshots.bayesianScore })
    .from(rankSnapshots)
    .where(eq(rankSnapshots.contentId, contentId))
    .orderBy(asc(rankSnapshots.snapshotWeek))
    .limit(26);
}

export const getCategoryTop5 = (categoryId: number, excludeId: number) =>
  unstable_cache(
    () =>
      db
        .select(rivalSelect)
        .from(contents)
        .innerJoin(contentStats, eq(contentStats.contentId, contents.id))
        .where(and(eq(contents.categoryId, categoryId), ne(contents.id, excludeId), eq(contents.isAdult, false), sql`${contentStats.rank} is not null`))
        .orderBy(asc(contentStats.rank))
        .limit(5),
    ["top5", String(categoryId), String(excludeId)],
    { revalidate: 300 },
  )();

export async function getSameGenre(categoryId: number, contentId: number, genreSlugs: string[], n = 5): Promise<RivalRow[]> {
  if (!genreSlugs.length) return [];
  return db
    .select(rivalSelect)
    .from(contents)
    .innerJoin(contentStats, eq(contentStats.contentId, contents.id))
    .where(
      and(
        eq(contents.categoryId, categoryId),
        ne(contents.id, contentId),
        eq(contents.isAdult, false),
        sql`${contentStats.rank} is not null`,
        sql`exists (select 1 from ${contentGenres} cg join ${genres} g on g.id = cg.genre_id where cg.content_id = ${contents.id} and g.slug in (${sql.join(genreSlugs.map((g) => sql`${g}`), sql`, `)}))`,
      ),
    )
    .orderBy(asc(contentStats.rank))
    .limit(n);
}

export async function getUserRating(contentId: number, userId: string | undefined) {
  if (!userId) return null;
  const r = await db.select({ id: ratings.id, score: ratings.score }).from(ratings).where(and(eq(ratings.contentId, contentId), eq(ratings.userId, userId))).limit(1);
  return r[0] ?? null;
}

export type ReviewSort = "best" | "newest" | "high" | "low";
export type ReviewRow = {
  id: number;
  body: string;
  score: string | null;
  isSpoiler: boolean;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  createdAt: Date;
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  isSeed: boolean;
  myReaction: "like" | "dislike" | null;
};
export async function getReviews(contentId: number, sort: ReviewSort, page: number, viewerId?: string, perPage = 10): Promise<ReviewRow[]> {
  const order =
    sort === "newest" ? [desc(reviews.createdAt)] : sort === "high" ? [desc(reviews.score), desc(reviews.likeCount)] : sort === "low" ? [asc(reviews.score), desc(reviews.likeCount)] : [desc(sql`${reviews.likeCount} - ${reviews.dislikeCount}`), desc(reviews.createdAt)];
  return db
    .select({
      id: reviews.id,
      body: reviews.body,
      score: reviews.score,
      isSpoiler: reviews.isSpoiler,
      likeCount: reviews.likeCount,
      dislikeCount: reviews.dislikeCount,
      commentCount: reviews.commentCount,
      createdAt: reviews.createdAt,
      userId: reviews.userId,
      nickname: profiles.nickname,
      avatarUrl: profiles.avatarUrl,
      isSeed: profiles.isSeed,
      myReaction: viewerId ? sql<"like" | "dislike" | null>`(select kind from reactions x where x.user_id = ${viewerId} and x.target_type = 'review' and x.target_id = ${reviews.id})` : sql<null>`null`,
    })
    .from(reviews)
    .innerJoin(profiles, eq(profiles.id, reviews.userId))
    .where(and(eq(reviews.contentId, contentId), eq(reviews.isHidden, false)))
    .orderBy(...order)
    .limit(perPage)
    .offset((page - 1) * perPage);
}

export type CommentRow = {
  id: number;
  parentId: number | null;
  body: string;
  likeCount: number;
  dislikeCount: number;
  createdAt: Date;
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  isSeed: boolean;
  isHidden: boolean;
  myReaction: "like" | "dislike" | null;
};
export async function getComments(targetType: "content" | "review" | "post" | "battle", targetId: number, viewerId?: string, limit = 200): Promise<CommentRow[]> {
  return db
    .select({
      id: comments.id,
      parentId: comments.parentId,
      body: comments.body,
      likeCount: comments.likeCount,
      dislikeCount: comments.dislikeCount,
      createdAt: comments.createdAt,
      userId: comments.userId,
      nickname: profiles.nickname,
      avatarUrl: profiles.avatarUrl,
      isSeed: profiles.isSeed,
      isHidden: comments.isHidden,
      myReaction: viewerId ? sql<"like" | "dislike" | null>`(select kind from reactions x where x.user_id = ${viewerId} and x.target_type = 'comment' and x.target_id = ${comments.id})` : sql<null>`null`,
    })
    .from(comments)
    .innerJoin(profiles, eq(profiles.id, comments.userId))
    .where(and(eq(comments.targetType, targetType), eq(comments.targetId, targetId)))
    .orderBy(asc(comments.createdAt))
    .limit(limit);
}

export async function getBattlesForContent(contentId: number, n = 5) {
  const rows = await db
    .select({ battle: battles, aTitle: sql<string>`(select title from contents where id = ${battles.contentAId})`, bTitle: sql<string>`(select title from contents where id = ${battles.contentBId})`, aPoster: sql<string | null>`(select poster_url from contents where id = ${battles.contentAId})`, bPoster: sql<string | null>`(select poster_url from contents where id = ${battles.contentBId})` })
    .from(battles)
    .where(or(eq(battles.contentAId, contentId), eq(battles.contentBId, contentId)))
    .orderBy(desc(sql`${battles.votesA} + ${battles.votesB}`))
    .limit(n);
  return rows;
}

export async function getPostsForContent(contentId: number, n = 5) {
  return db
    .select({ id: posts.id, title: posts.title, tag: posts.tag, commentCount: posts.commentCount, likeCount: posts.likeCount, createdAt: posts.createdAt, categorySlug: categories.slug, nickname: profiles.nickname })
    .from(posts)
    .innerJoin(categories, eq(categories.id, posts.categoryId))
    .innerJoin(profiles, eq(profiles.id, posts.userId))
    .where(and(eq(posts.contentId, contentId), eq(posts.isHidden, false)))
    .orderBy(desc(posts.createdAt))
    .limit(n);
}

export async function getContentsByIds(ids: number[]) {
  if (!ids.length) return [];
  return db
    .select({ content: contents, stats: contentStats, categorySlug: categories.slug })
    .from(contents)
    .innerJoin(contentStats, eq(contentStats.contentId, contents.id))
    .innerJoin(categories, eq(categories.id, contents.categoryId))
    .where(inArray(contents.id, ids));
}

export async function getYearBounds(categoryId: number) {
  const [r] = await db.select({ min: sql<number | null>`min(${contents.releaseYear})`, max: sql<number | null>`max(${contents.releaseYear})` }).from(contents).where(and(eq(contents.categoryId, categoryId), gte(contents.releaseYear, 1900), lte(contents.releaseYear, 2100)));
  return r;
}
