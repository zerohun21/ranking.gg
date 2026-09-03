import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { TierBadge } from "./tier-badge";
import { RankDelta } from "./rank-delta";
import { Score } from "./score";
import { DistBar } from "./dist-bar";
import { QuickRate } from "./quick-rate";
import { Poster } from "@/components/content/poster";
import { contentHref, displayTitle, formatCount } from "@/lib/format";
import type { RankingRow } from "@/lib/db/queries/ranking";
import { cn } from "@/lib/utils";
import { PLATFORM_FILTERS } from "@/lib/constants/categories";

function metaLine(r: RankingRow, locale: string): string {
  const m = r.metadata as Record<string, unknown>;
  const parts: string[] = [];
  if (r.releaseYear) parts.push(String(r.releaseYear));
  const genres = (m.genres as string[] | undefined)?.slice(0, 2);
  if (genres?.length) parts.push(genres.join(" · "));
  if (m.author) parts.push(String(m.author));
  if (m.artist) parts.push(String(m.artist));
  if (locale === "en" && m.title_ko) parts.push(String(m.title_ko));
  return parts.join(" · ");
}

export function PlatformIcons({ metadata, categorySlug }: { metadata: Record<string, unknown>; categorySlug: string }) {
  const list = (metadata.platforms as string[] | undefined) ?? [];
  if (!list.length) return null;
  const labels = PLATFORM_FILTERS[categorySlug] ?? [];
  return (
    <span className="inline-flex flex-wrap gap-1">
      {list.slice(0, 4).map((p) => (
        <span key={p} className="rounded bg-muted px-1 py-px text-[10px] font-semibold text-muted-foreground">
          {labels.find((l) => l.key === p)?.label ?? p}
        </span>
      ))}
    </span>
  );
}

/* 단일 반응형 마크업: 모바일 = [순위][포스터][제목/메타][티어+점수+평가], lg = 전체 컬럼 */
const GRID = "grid-cols-[32px_48px_minmax(0,1fr)_auto] lg:grid-cols-[36px_40px_52px_minmax(0,2.2fr)_40px_78px_56px_64px_minmax(0,1.3fr)_52px_84px]";

export async function RankingTable({ rows, categorySlug, loggedIn, myRatings, startIndex = 0, showRank = true }: { rows: RankingRow[]; categorySlug: string; loggedIn: boolean; myRatings?: Map<number, number>; startIndex?: number; showRank?: boolean }) {
  const t = await getTranslations("ranking");
  const locale = await getLocale();
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className={cn("hidden items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 text-[11px] font-semibold text-muted-foreground lg:grid", GRID)}>
        <span>{t("colRank")}</span>
        <span>{t("colChange")}</span>
        <span />
        <span>{t("colTitle")}</span>
        <span>{t("colTier")}</span>
        <span>{t("colScore")}</span>
        <span className="text-right">{t("colRatings")}</span>
        <span>{t("colDist")}</span>
        <span>{t("colBest")}</span>
        <span className="text-right">{t("colWinRate")}</span>
        <span />
      </div>
      <ul>
        {rows.map((r, i) => {
          const href = contentHref(categorySlug, r.slug);
          const total = r.eloWins + r.eloLosses;
          const wr = total ? Math.round((r.eloWins / total) * 100) : null;
          const title = displayTitle(r, locale);
          const rank = showRank ? r.rank ?? "–" : startIndex + i + 1;
          return (
            <li key={r.id} className={cn("group relative border-b border-border last:border-0 transition-colors hover:bg-accent/60", i % 2 === 1 && "bg-muted/20")}>
              <Link href={href} className="absolute inset-0 z-0" aria-label={title} />
              <div className={cn("relative z-10 grid items-center gap-2 px-3 py-2 pointer-events-none", GRID)}>
                {/* 순위 (+모바일 변동) */}
                <span className="flex flex-col items-center lg:block">
                  <span className={cn("text-base font-extrabold tabular lg:text-lg", (r.rank ?? 99) <= 3 ? "text-tier-s" : "text-foreground")}>{rank}</span>
                  <RankDelta delta={r.rankDelta} prevRank={r.prevRank} className="text-[10px] lg:hidden" />
                </span>
                <span className="hidden lg:block">
                  <RankDelta delta={r.rankDelta} prevRank={r.prevRank} />
                </span>
                <Poster src={r.posterUrl} alt={title} size="sm" priority={i < 4} sizes="48px" className="h-14 w-10 lg:h-16 lg:w-12" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">{title}</div>
                  <div className="truncate text-[11px] text-muted-foreground lg:text-xs">{metaLine(r, locale)}</div>
                  <div className="mt-0.5 flex items-center gap-2 lg:hidden">
                    <span className="text-[11px] text-muted-foreground tabular">{formatCount(r.ratingCount, locale)} {t("colRatings")}</span>
                    <DistBar dist={r.dist} height={10} />
                    {wr != null && <span className={cn("text-[11px] font-semibold tabular", wr >= 50 ? "text-win" : "text-lose")}>{wr}%</span>}
                  </div>
                  <span className="hidden lg:inline-flex">
                    <PlatformIcons metadata={r.metadata} categorySlug={categorySlug} />
                  </span>
                </div>
                {/* 모바일: 우측 세로 묶음 / lg: display:contents 로 풀려 각각 그리드 셀이 됨 */}
                <div className="flex flex-col items-end gap-1 lg:contents">
                  <span className="lg:order-none"><TierBadge tier={r.tier} size="sm" className="lg:h-8 lg:w-8 lg:text-sm" /></span>
                  <span><Score score={r.bayesianScore} size="sm" showStars={false} className="lg:hidden" /><Score score={r.bayesianScore} size="md" className="hidden lg:inline-flex" /></span>
                  <span className="hidden text-right text-sm tabular text-muted-foreground lg:block">{formatCount(r.ratingCount, locale)}</span>
                  <span className="hidden lg:block"><DistBar dist={r.dist} /></span>
                  <span className="hidden truncate text-xs text-muted-foreground lg:block">{r.bestComment ? `“${r.bestComment}”` : ""}</span>
                  <span className={cn("hidden text-right text-sm font-semibold tabular lg:block", wr == null ? "text-muted-foreground" : wr >= 50 ? "text-win" : "text-lose")}>{wr == null ? "–" : `${wr}%`}</span>
                  <span className="pointer-events-auto flex justify-end">
                    <QuickRate contentId={r.id} title={title} loggedIn={loggedIn} initial={myRatings?.get(r.id) ?? null} className="h-6 px-1.5 text-[10px] lg:h-7 lg:px-2 lg:text-xs" />
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
