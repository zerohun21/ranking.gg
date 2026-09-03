import { unstable_cache } from "next/cache";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { battles, categories, contents, contentStats, profiles, ratings, reviews } from "@/lib/db/schema";

export const getSiteStats = unstable_cache(
  async () => {
    const [r] = await db.execute<{ contents: number; ratings: number; today: number; users: number; reviews: number }>(sql`
      select (select count(*)::int from contents where is_approved) contents,
             (select count(*)::int from ratings) ratings,
             (select count(*)::int from ratings where created_at > now() - interval '1 day') today,
             (select count(distinct user_id)::int from ratings where created_at > now() - interval '7 days') users,
             (select count(*)::int from reviews where not is_hidden) reviews`);
    return r ?? { contents: 0, ratings: 0, today: 0, users: 0, reviews: 0 };
  },
  ["site-stats"],
  { revalidate: 60 },
);

export type LiveReview = { id: number; body: string; score: string | null; isSpoiler: boolean; createdAt: Date; nickname: string; avatarUrl: string | null; title: string; slug: string; categorySlug: string; posterUrl: string | null };
export async function getLiveReviews(n = 20): Promise<LiveReview[]> {
  return db
    .select({ id: reviews.id, body: reviews.body, score: reviews.score, isSpoiler: reviews.isSpoiler, createdAt: reviews.createdAt, nickname: profiles.nickname, avatarUrl: profiles.avatarUrl, title: contents.title, slug: contents.slug, categorySlug: categories.slug, posterUrl: contents.posterUrl })
    .from(reviews)
    .innerJoin(profiles, eq(profiles.id, reviews.userId))
    .innerJoin(contents, eq(contents.id, reviews.contentId))
    .innerJoin(categories, eq(categories.id, contents.categoryId))
    .where(eq(reviews.isHidden, false))
    .orderBy(desc(reviews.createdAt))
    .limit(n);
}

export type BattleCard = {
  id: number;
  categoryId: number;
  categorySlug: string;
  votesA: number;
  votesB: number;
  a: { id: number; title: string; slug: string; posterUrl: string | null; tier: string | null; rank: number | null; score: string; elo: number; wins: number; losses: number };
  b: { id: number; title: string; slug: string; posterUrl: string | null; tier: string | null; rank: number | null; score: string; elo: number; wins: number; losses: number };
  myChoice?: "a" | "b" | null;
};
export async function getBattleCards(opts: { categoryId?: number; featured?: boolean; random?: boolean; n?: number; excludeIds?: number[]; viewerId?: string; ids?: number[] }): Promise<BattleCard[]> {
  const n = opts.n ?? 3;
  const rows = await db.execute<Record<string, unknown>>(sql`
    select b.id, b.category_id, k.slug category_slug, b.votes_a, b.votes_b,
      a.id a_id, a.title a_title, a.slug a_slug, a.poster_url a_poster, sa.tier a_tier, sa.rank a_rank, sa.bayesian_score a_score, sa.elo a_elo, sa.elo_wins a_wins, sa.elo_losses a_losses,
      c.id b_id, c.title b_title, c.slug b_slug, c.poster_url b_poster, sb.tier b_tier, sb.rank b_rank, sb.bayesian_score b_score, sb.elo b_elo, sb.elo_wins b_wins, sb.elo_losses b_losses,
      ${opts.viewerId ? sql`(select choice from battle_votes v where v.battle_id = b.id and v.user_id = ${opts.viewerId})` : sql`null`} my_choice
    from battles b
    join categories k on k.id = b.category_id
    join contents a on a.id = b.content_a_id join content_stats sa on sa.content_id = a.id
    join contents c on c.id = b.content_b_id join content_stats sb on sb.content_id = c.id
    where a.is_approved and c.is_approved and not a.is_adult and not c.is_adult
      ${opts.categoryId ? sql`and b.category_id = ${opts.categoryId}` : sql``}
      ${opts.featured ? sql`and b.is_featured` : sql``}
      ${opts.ids?.length ? sql`and b.id in (${sql.join(opts.ids.map((i) => sql`${i}`), sql`, `)})` : sql``}
      ${opts.excludeIds?.length ? sql`and b.id not in (${sql.join(opts.excludeIds.map((i) => sql`${i}`), sql`, `)})` : sql``}
    order by ${opts.random ? sql`random()` : sql`(b.votes_a + b.votes_b) desc`}
    limit ${n}`);
  return [...rows].map((r) => ({
    id: r.id as number,
    categoryId: r.category_id as number,
    categorySlug: r.category_slug as string,
    votesA: r.votes_a as number,
    votesB: r.votes_b as number,
    a: { id: r.a_id as number, title: r.a_title as string, slug: r.a_slug as string, posterUrl: r.a_poster as string | null, tier: r.a_tier as string | null, rank: r.a_rank as number | null, score: String(r.a_score), elo: Number(r.a_elo), wins: r.a_wins as number, losses: r.a_losses as number },
    b: { id: r.b_id as number, title: r.b_title as string, slug: r.b_slug as string, posterUrl: r.b_poster as string | null, tier: r.b_tier as string | null, rank: r.b_rank as number | null, score: String(r.b_score), elo: Number(r.b_elo), wins: r.b_wins as number, losses: r.b_losses as number },
    myChoice: (r.my_choice as "a" | "b" | null) ?? null,
  }));
}

export async function getBattleById(id: number, viewerId?: string) {
  const r = await getBattleCards({ ids: [id], n: 1, viewerId });
  return r[0] ?? null;
}

export { battles, contentStats, ratings };
