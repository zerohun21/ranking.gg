import { and, desc, eq, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { categories, contents, contentStats } from "@/lib/db/schema";

export const getEloLeaderboard = (categoryId: number | undefined, n = 50) =>
  unstable_cache(
    async () =>
      db
        .select({ id: contents.id, slug: contents.slug, title: contents.title, posterUrl: contents.posterUrl, categorySlug: categories.slug, categoryIcon: categories.icon, elo: contentStats.elo, wins: contentStats.eloWins, losses: contentStats.eloLosses, tier: contentStats.tier, rank: contentStats.rank })
        .from(contentStats)
        .innerJoin(contents, eq(contents.id, contentStats.contentId))
        .innerJoin(categories, eq(categories.id, contents.categoryId))
        .where(and(categoryId ? eq(contents.categoryId, categoryId) : undefined, eq(contents.isApproved, true), eq(contents.isAdult, false), sql`${contentStats.eloWins} + ${contentStats.eloLosses} > 0`))
        .orderBy(desc(contentStats.elo))
        .limit(n),
    ["elo-leaderboard", String(categoryId ?? "all"), String(n)],
    { revalidate: 60, tags: ["ranking"] },
  )();
