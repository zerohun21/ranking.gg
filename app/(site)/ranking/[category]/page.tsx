import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { eq, and, inArray } from "drizzle-orm";
import { getCategoryBySlug } from "@/lib/db/queries/categories";
import { getCategorySummary, getRanking, getTierBoard } from "@/lib/db/queries/ranking";
import { rankingParamsCache } from "@/lib/ranking-params";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ratings } from "@/lib/db/schema";
import { RankingTable } from "@/components/ranking/ranking-table";
import { TierBoard } from "@/components/ranking/tier-board";
import { FilterSidebar, Pagination, ViewSortBar, type FilterMeta } from "@/components/ranking/filters";
import { RankDelta } from "@/components/ranking/rank-delta";
import { Poster } from "@/components/content/poster";
import { PLATFORM_FILTERS } from "@/lib/constants/categories";
import { contentHref, formatCount } from "@/lib/format";

type Props = { params: Promise<{ category: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const cat = await getCategoryBySlug(category);
  if (!cat) return {};
  return { title: `${cat.nameKo} 티어표`, description: `${cat.nameKo} ${cat.itemCount}개 작품의 랭킹과 티어. ${cat.description ?? ""}`, openGraph: { images: [`/api/og/category/${cat.id}`] } };
}

export default async function RankingPage({ params, searchParams }: Props) {
  const { category } = await params;
  const p = await rankingParamsCache.parse(searchParams);
  const cat = await getCategoryBySlug(category);
  if (!cat) notFound();
  const t = await getTranslations("ranking");
  const locale = await getLocale();
  const user = await getCurrentUser();

  const filters = {
    genres: p.genre,
    platforms: p.platform,
    yearFrom: p.yearFrom ?? undefined,
    yearTo: p.yearTo ?? undefined,
    status: p.status,
    tiers: p.tier,
    minRatings: p.minRatings || undefined,
    sort: p.sort,
    page: p.page,
    perPage: 50,
    adult: p.adult,
    kind: p.kind ?? undefined,
    q: p.q ?? undefined,
  };

  const [summary, listData, board] = await Promise.all([
    getCategorySummary(cat.id),
    p.view === "list" ? getRanking(cat.id, filters) : Promise.resolve(null),
    p.view === "board" ? getTierBoard(cat.id, filters) : Promise.resolve(null),
  ]);

  let myRatings: Map<number, number> | undefined;
  if (user && listData) {
    const ids = listData.rows.map((r) => r.id);
    if (ids.length) {
      const mine = await db.select({ contentId: ratings.contentId, score: ratings.score }).from(ratings).where(and(eq(ratings.userId, user.id), inArray(ratings.contentId, ids)));
      myRatings = new Map(mine.map((m) => [m.contentId, Number(m.score)]));
    }
  }

  const platformLabels = PLATFORM_FILTERS[cat.slug] ?? [];
  const meta: FilterMeta = {
    genres: summary.genres,
    platforms: (platformLabels.length ? platformLabels.map((pl) => ({ ...pl, count: summary.platforms.find((x) => x.key === pl.key)?.count })) : summary.platforms.slice(0, 8).map((x) => ({ key: x.key, label: x.key, count: x.count }))).filter((x) => x.count == null || x.count > 0),
    years: summary.years,
    hasStatus: cat.slug === "webtoon",
    hasKind: cat.slug === "drama",
  };
  const name = locale === "en" ? cat.nameEn : cat.nameKo;

  return (
    <div className="space-y-4">
      {/* 요약 카드 */}
      <section className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-[1fr_auto_auto]">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold">
            <span style={{ color: cat.color }}>{cat.icon}</span> {t("title", { name })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground tabular">{t("summary", { items: formatCount(summary.items, locale), ratings: formatCount(summary.ratings, locale) })}</p>
          {cat.description && <p className="mt-1 text-xs text-muted-foreground">{cat.description}</p>}
        </div>
        {[
          { label: t("topRiser"), row: summary.riser },
          { label: t("topFaller"), row: summary.faller },
        ].map(({ label, row }) =>
          row ? (
            <Link key={label} href={contentHref(cat.slug, row.slug)} className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2 hover:border-primary">
              <Poster src={row.posterUrl} alt={row.title} size="xs" />
              <div className="min-w-0">
                <div className="text-[10px] font-semibold text-muted-foreground">{label}</div>
                <div className="max-w-[160px] truncate text-sm font-bold">{row.title}</div>
                <div className="flex items-center gap-1 text-xs tabular">
                  #{row.rank} <RankDelta delta={row.rankDelta} prevRank={row.prevRank} />
                </div>
              </div>
            </Link>
          ) : null,
        )}
      </section>

      <ViewSortBar total={listData?.total ?? summary.items} />

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <FilterSidebar meta={meta} className="hidden rounded-lg border border-border bg-card p-4 lg:block lg:self-start lg:sticky lg:top-[120px]" />
        <div className="min-w-0">
          {p.view === "list" && listData ? (
            listData.rows.length ? (
              <>
                <RankingTable rows={listData.rows} categorySlug={cat.slug} loggedIn={!!user} myRatings={myRatings} />
                <Pagination page={p.page} total={listData.total} perPage={50} />
              </>
            ) : (
              <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">{t("noResults")}</div>
            )
          ) : board ? (
            <TierBoard board={board} categorySlug={cat.slug} />
          ) : null}
        </div>
      </div>
      <div className="lg:hidden">
        <details className="rounded-lg border border-border bg-card p-4">
          <summary className="cursor-pointer text-sm font-bold">{t("filters")}</summary>
          <FilterSidebar meta={meta} className="mt-3" />
        </details>
      </div>
    </div>
  );
}
