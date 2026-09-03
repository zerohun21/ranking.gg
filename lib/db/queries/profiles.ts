import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { battleVotes, battles, categories, comments, contents, contentStats, profiles, ratings, reviews } from "@/lib/db/schema";

export async function getProfileByNickname(nickname: string) {
  const rows = await db.select().from(profiles).where(eq(profiles.nickname, nickname)).limit(1);
  return rows[0] ?? null;
}

export async function getProfileStats(userId: string) {
  const [r] = await db.execute<{ ratings: number; reviews: number; comments: number; votes: number; avg: string | null; mode: string | null }>(sql`
    select (select count(*)::int from ratings where user_id = ${userId}) ratings,
           (select count(*)::int from reviews where user_id = ${userId} and not is_hidden) reviews,
           (select count(*)::int from comments where user_id = ${userId}) comments,
           (select count(*)::int from battle_votes where user_id = ${userId}) votes,
           (select round(avg(score), 2)::text from ratings where user_id = ${userId}) avg,
           (select score::text from ratings where user_id = ${userId} group by score order by count(*) desc, score desc limit 1) mode`);
  const dist = await db.execute<{ score: string; n: number }>(sql`select score::text, count(*)::int n from ratings where user_id = ${userId} group by score order by score`);
  const d = Array(10).fill(0) as number[];
  for (const x of dist) d[Math.round(Number(x.score) * 2) - 1] = x.n;
  return { ...r, dist: d };
}

export type MyRatedRow = { id: number; title: string; slug: string; posterUrl: string | null; categorySlug: string; categoryIcon: string; score: string; rank: number | null; tier: "S" | "A" | "B" | "C" | "D" | null; createdAt: Date };
/** 내 티어표용: 별점 구간(S/A/B/C/D)별 최대 perBucket 개 */
export async function getMyTierBoardRows(userId: string, perBucket = 40): Promise<MyRatedRow[]> {
  const rows = await db.execute<Record<string, unknown>>(sql`
    select * from (
      select c.id, c.title, c.slug, c.poster_url, k.slug category_slug, k.icon category_icon, r.score::text score, s.rank, s.tier, r.updated_at created_at,
        row_number() over (partition by (case when r.score >= 4.5 then 'S' when r.score >= 4 then 'A' when r.score >= 3.5 then 'B' when r.score >= 2.5 then 'C' else 'D' end) order by r.updated_at desc) rn
      from ratings r join contents c on c.id = r.content_id join categories k on k.id = c.category_id join content_stats s on s.content_id = c.id
      where r.user_id = ${userId}
    ) x where rn <= ${perBucket} order by score desc, created_at desc`);
  return [...rows].map((r) => ({ id: r.id as number, title: r.title as string, slug: r.slug as string, posterUrl: r.poster_url as string | null, categorySlug: r.category_slug as string, categoryIcon: r.category_icon as string, score: r.score as string, rank: r.rank as number | null, tier: r.tier as MyRatedRow["tier"], createdAt: r.created_at as Date }));
}

export async function getMyRatings(userId: string, limit = 60): Promise<MyRatedRow[]> {
  return db
    .select({ id: contents.id, title: contents.title, slug: contents.slug, posterUrl: contents.posterUrl, categorySlug: categories.slug, categoryIcon: categories.icon, score: ratings.score, rank: contentStats.rank, tier: contentStats.tier, createdAt: ratings.updatedAt })
    .from(ratings)
    .innerJoin(contents, eq(contents.id, ratings.contentId))
    .innerJoin(categories, eq(categories.id, contents.categoryId))
    .innerJoin(contentStats, eq(contentStats.contentId, contents.id))
    .where(eq(ratings.userId, userId))
    .orderBy(desc(ratings.updatedAt))
    .limit(limit);
}

export async function getMyReviews(userId: string, limit = 30) {
  return db
    .select({ id: reviews.id, body: reviews.body, score: reviews.score, likeCount: reviews.likeCount, createdAt: reviews.createdAt, isSpoiler: reviews.isSpoiler, title: contents.title, slug: contents.slug, posterUrl: contents.posterUrl, categorySlug: categories.slug })
    .from(reviews)
    .innerJoin(contents, eq(contents.id, reviews.contentId))
    .innerJoin(categories, eq(categories.id, contents.categoryId))
    .where(eq(reviews.userId, userId))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
}

export async function getMyComments(userId: string, limit = 30) {
  return db.select({ id: comments.id, body: comments.body, targetType: comments.targetType, targetId: comments.targetId, likeCount: comments.likeCount, createdAt: comments.createdAt }).from(comments).where(eq(comments.userId, userId)).orderBy(desc(comments.createdAt)).limit(limit);
}

export async function getMyBattles(userId: string, limit = 30) {
  return db
    .select({ id: battleVotes.id, battleId: battleVotes.battleId, choice: battleVotes.choice, createdAt: battleVotes.createdAt, aTitle: sql<string>`(select title from contents where id = ${battles.contentAId})`, bTitle: sql<string>`(select title from contents where id = ${battles.contentBId})`, votesA: battles.votesA, votesB: battles.votesB })
    .from(battleVotes)
    .innerJoin(battles, eq(battles.id, battleVotes.battleId))
    .where(eq(battleVotes.userId, userId))
    .orderBy(desc(battleVotes.createdAt))
    .limit(limit);
}

export type ActivityRow = { kind: "rating" | "review" | "comment" | "vote"; at: Date; title: string; href: string; extra: string };
export async function getActivity(userId: string, limit = 30): Promise<ActivityRow[]> {
  const rows = await db.execute<{ kind: ActivityRow["kind"]; at: Date; title: string; href: string; extra: string }>(sql`
    select * from (
      select 'rating' kind, r.updated_at at, c.title, '/c/' || k.slug || '/' || c.slug href, r.score::text extra
        from ratings r join contents c on c.id = r.content_id join categories k on k.id = c.category_id where r.user_id = ${userId}
      union all
      select 'review', v.created_at, c.title, '/c/' || k.slug || '/' || c.slug, left(v.body, 60)
        from reviews v join contents c on c.id = v.content_id join categories k on k.id = c.category_id where v.user_id = ${userId}
      union all
      select 'comment', m.created_at, m.target_type::text, case when m.target_type = 'post' then '/community/x/' || m.target_id else '/battle/' || m.target_id end, left(m.body, 60)
        from comments m where m.user_id = ${userId} and m.target_type in ('post','battle')
      union all
      select 'vote', bv.created_at, a.title || ' vs ' || b.title, '/battle/' || bv.battle_id, bv.choice::text
        from battle_votes bv join battles bt on bt.id = bv.battle_id join contents a on a.id = bt.content_a_id join contents b on b.id = bt.content_b_id where bv.user_id = ${userId}
    ) x order by at desc limit ${limit}`);
  return [...rows];
}
