import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, contents, contentStats } from "@/lib/db/schema";

export type SearchHit = { id: number; title: string; titleOriginal: string | null; slug: string; posterUrl: string | null; releaseYear: number | null; categorySlug: string; categoryName: string; categoryIcon: string; categoryId: number; tier: string | null; rank: number | null; score: string; ratingCount: number; sim: number };

/** pg_trgm similarity + ILIKE. 카테고리별 상위 perCategory */
export async function searchContents(q: string, opts: { perCategory?: number; limit?: number; categoryId?: number; offset?: number } = {}): Promise<SearchHit[]> {
  const term = q.trim();
  if (!term) return [];
  const perCategory = opts.perCategory ?? 5;
  const rows = await db.execute<Record<string, unknown>>(sql`
    with hits as (
      select c.id, c.title, c.title_original, c.slug, c.poster_url, c.release_year, c.category_id,
        greatest(similarity(c.title, ${term}), coalesce(similarity(c.title_original, ${term}), 0)) sim,
        (c.title ilike ${term + "%"}) prefix,
        (c.title ilike ${"%" + term + "%"} or c.title_original ilike ${"%" + term + "%"}) contains
      from contents c
      where c.is_approved and not c.is_adult
        ${opts.categoryId ? sql`and c.category_id = ${opts.categoryId}` : sql``}
        and (c.title ilike ${"%" + term + "%"} or c.title_original ilike ${"%" + term + "%"} or c.title % ${term} or c.title_original % ${term})
    ),
    ranked as (
      select h.*, row_number() over (partition by h.category_id order by h.prefix desc, h.contains desc, h.sim desc, s.rating_count desc) rn,
        s.tier, s.rank, s.bayesian_score, s.rating_count
      from hits h join content_stats s on s.content_id = h.id
    )
    select r.*, k.slug category_slug, k.name_ko category_name, k.icon category_icon
    from ranked r join categories k on k.id = r.category_id
    where r.rn <= ${perCategory}
    order by r.prefix desc, r.contains desc, r.sim desc, r.rating_count desc
    limit ${opts.limit ?? 30} offset ${opts.offset ?? 0}`);
  return [...rows].map((r) => ({
    id: r.id as number,
    title: r.title as string,
    titleOriginal: r.title_original as string | null,
    slug: r.slug as string,
    posterUrl: r.poster_url as string | null,
    releaseYear: r.release_year as number | null,
    categorySlug: r.category_slug as string,
    categoryName: r.category_name as string,
    categoryIcon: r.category_icon as string,
    categoryId: r.category_id as number,
    tier: r.tier as string | null,
    rank: r.rank as number | null,
    score: String(r.bayesian_score),
    ratingCount: r.rating_count as number,
    sim: Number(r.sim),
  }));
}

export async function searchCountByCategory(q: string) {
  const term = q.trim();
  if (!term) return [];
  return db
    .select({ categoryId: categories.id, slug: categories.slug, nameKo: categories.nameKo, nameEn: categories.nameEn, icon: categories.icon, count: sql<number>`count(*)::int` })
    .from(contents)
    .innerJoin(categories, eq(categories.id, contents.categoryId))
    .innerJoin(contentStats, eq(contentStats.contentId, contents.id))
    .where(sql`${contents.isApproved} and not ${contents.isAdult} and (${contents.title} ilike ${"%" + term + "%"} or ${contents.titleOriginal} ilike ${"%" + term + "%"} or ${contents.title} % ${term})`)
    .groupBy(categories.id)
    .orderBy(sql`count(*) desc`);
}
