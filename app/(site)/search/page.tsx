import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { searchContents, searchCountByCategory } from "@/lib/db/queries/search";
import { SearchBox } from "@/components/search/search-box";
import { Poster } from "@/components/content/poster";
import { TierBadge } from "@/components/ranking/tier-badge";
import { contentHref, formatScore } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Tier } from "@/lib/db/schema";

type Props = { searchParams: Promise<{ q?: string; category?: string; page?: string }> };
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `"${q}" 검색` : "검색", robots: { index: false } };
}

export default async function SearchPage({ searchParams }: Props) {
  const { q = "", category, page = "1" } = await searchParams;
  const t = await getTranslations("search");
  const locale = await getLocale();
  const counts = q ? await searchCountByCategory(q) : [];
  const cat = counts.find((c) => c.slug === category);
  const pageN = Math.max(1, Number(page));
  const hits = q ? await searchContents(q, { perCategory: cat ? 1000 : 5, limit: cat ? 40 : 40, categoryId: cat?.categoryId, offset: cat ? (pageN - 1) * 40 : 0 }) : [];
  const total = cat ? cat.count : counts.reduce((a, c) => a + c.count, 0);

  return (
    <div className="space-y-4">
      <SearchBox size="xl" placeholder={t("placeholder")} className="mx-auto max-w-[640px]" />
      {q && (
        <>
          <h1 className="text-lg font-extrabold">
            {t("title", { q })} <span className="text-sm font-normal text-muted-foreground tabular">{t("results", { count: total })}</span>
          </h1>
          <div className="scrollbar-none flex gap-1 overflow-x-auto">
            <Link href={`/search?q=${encodeURIComponent(q)}`} className={cn("shrink-0 rounded-full border px-3 py-1 text-xs font-semibold", !cat ? "border-primary bg-primary text-white" : "border-border bg-card")}>
              {t("all")} {counts.reduce((a, c) => a + c.count, 0)}
            </Link>
            {counts.map((c) => (
              <Link key={c.slug} href={`/search?q=${encodeURIComponent(q)}&category=${c.slug}`} className={cn("shrink-0 rounded-full border px-3 py-1 text-xs font-semibold", cat?.slug === c.slug ? "border-primary bg-primary text-white" : "border-border bg-card")}>
                {c.icon} {locale === "en" ? c.nameEn : c.nameKo} {c.count}
              </Link>
            ))}
          </div>
          {hits.length === 0 ? (
            <p className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">{t("noResults")}</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {hits.map((h) => (
                <li key={h.id}>
                  <Link href={contentHref(h.categorySlug, h.slug)} className="flex items-center gap-3 rounded-lg border border-border bg-card p-2 hover:border-primary">
                    <Poster src={h.posterUrl} alt={h.title} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{locale === "en" && h.titleOriginal ? h.titleOriginal : h.title}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {h.categoryIcon} {h.categoryName} {h.releaseYear ? `· ${h.releaseYear}` : ""} {h.titleOriginal && h.titleOriginal !== h.title ? `· ${h.titleOriginal}` : ""}
                      </div>
                      <div className="text-xs tabular">
                        #{h.rank ?? "–"} · <span className="font-bold">{formatScore(h.score)}</span> · {h.ratingCount}
                      </div>
                    </div>
                    <TierBadge tier={h.tier as Tier | null} size="md" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {cat && total > 40 && (
            <div className="flex justify-center gap-2 text-sm">
              {pageN > 1 && <Link className="rounded border border-border px-3 py-1" href={`/search?q=${encodeURIComponent(q)}&category=${cat.slug}&page=${pageN - 1}`}>‹</Link>}
              <span className="px-2 py-1 tabular">{pageN} / {Math.ceil(total / 40)}</span>
              {pageN * 40 < total && <Link className="rounded border border-border px-3 py-1" href={`/search?q=${encodeURIComponent(q)}&category=${cat.slug}&page=${pageN + 1}`}>›</Link>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
