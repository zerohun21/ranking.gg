import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ExternalLink, Swords } from "lucide-react";
import { getContentBySlug, getRivals, getRankHistory, getCategoryTop5, getSameGenre, getUserRating, getReviews, getBattlesForContent, getPostsForContent } from "@/lib/db/queries/content";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { reviews } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { Poster } from "@/components/content/poster";
import { TierBadge } from "@/components/ranking/tier-badge";
import { RankDelta } from "@/components/ranking/rank-delta";
import { Score } from "@/components/ranking/score";
import { RatingWidget } from "@/components/content/rating-widget";
import { DistributionChart, RankHistoryChart } from "@/components/content/charts";
import { RivalCard } from "@/components/content/rival-card";
import { ReviewSection } from "@/components/content/review-section";
import { ShareButton } from "@/components/content/share-button";
import { ViewPing } from "@/components/content/view-ping";
import { distFromStats } from "@/components/ranking/dist-bar";
import { PlatformIcons } from "@/components/ranking/ranking-table";
import { contentHref, displayTitle, formatCount, formatScore } from "@/lib/format";
import { Button } from "@/components/ui/button";

type Props = { params: Promise<{ category: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, slug } = await params;
  const d = await getContentBySlug(category, decodeURIComponent(slug));
  if (!d) return {};
  const title = `${d.content.title} — ${d.category.nameKo} #${d.stats.rank ?? "?"} · ${d.stats.tier ?? "?"}티어`;
  return {
    title,
    description: d.content.description?.slice(0, 150) ?? `${d.content.title} 랭킹, 티어, 별점 분포와 리뷰`,
    openGraph: { title, images: [`/api/og/content/${d.content.id}`], type: "article" },
    twitter: { card: "summary_large_image", images: [`/api/og/content/${d.content.id}`] },
  };
}

const SOURCE_LABEL: Record<string, string> = { tmdb: "TMDB", rawg: "RAWG", naver: "네이버웹툰", kakao: "카카오웹툰(추정)", apple: "Apple Music(추정)", google_books: "Google Books", aladin: "알라딘", user: "" };

export default async function ContentPage({ params }: Props) {
  const { category, slug } = await params;
  const d = await getContentBySlug(category, decodeURIComponent(slug));
  if (!d) notFound();
  const { content: c, category: cat, stats: s } = d;
  const t = await getTranslations();
  const locale = await getLocale();
  const user = await getCurrentUser();
  const viewer = user?.profile ? { id: user.id, isAdmin: user.profile.isAdmin, nickname: user.profile.nickname } : null;

  const [rivals, history, top5, sameGenre, myRating, initialReviews, battleRows, postRows, myReviewRows] = await Promise.all([
    getRivals(cat.id, s.rank),
    getRankHistory(c.id),
    getCategoryTop5(cat.id, c.id),
    getSameGenre(cat.id, c.id, d.genres.map((g) => g.slug)),
    getUserRating(c.id, user?.id),
    getReviews(c.id, "best", 1, user?.id),
    getBattlesForContent(c.id),
    getPostsForContent(c.id),
    user ? db.select({ id: reviews.id }).from(reviews).where(and(eq(reviews.contentId, c.id), eq(reviews.userId, user.id))).limit(1) : Promise.resolve([]),
  ]);
  const myReview = myReviewRows[0] ? (initialReviews.find((r) => r.id === myReviewRows[0].id) ?? (await getReviews(c.id, "newest", 1, user?.id)).find((r) => r.userId === user?.id) ?? null) : null;

  const m = c.metadata as Record<string, unknown>;
  const title = displayTitle(c, locale);
  const catName = locale === "en" ? cat.nameEn : cat.nameKo;
  const metaChips: string[] = [];
  if (c.releaseYear) metaChips.push(String(c.releaseYear));
  if (m.runtime) metaChips.push(t("content.runtime", { min: m.runtime as number }));
  if (m.seasons) metaChips.push(t("content.seasons", { n: m.seasons as number }));
  if (m.age) metaChips.push(String(m.age));
  if (m.status) metaChips.push(m.status === "finished" ? t("ranking.statusFinished") : m.status === "rest" ? t("ranking.statusRest") : m.status === "ongoing" ? t("ranking.statusOngoing") : "");
  const people: [string, unknown][] = [
    [t("content.director"), m.directors],
    [t("content.cast"), m.cast],
    [t("content.author"), m.authors ?? m.author],
    [t("content.artist"), m.artist],
    [t("content.developer"), m.developers],
    [t("content.publisher"), m.publishers ?? m.publisher],
    [t("content.weekdays"), m.weekdays],
  ];
  const me = { id: c.id, title: c.title, slug: c.slug, posterUrl: c.posterUrl, rank: s.rank, tier: s.tier, bayesianScore: s.bayesianScore, ratingCount: s.ratingCount, eloWins: s.eloWins, eloLosses: s.eloLosses };

  return (
    <div className="space-y-4">
      <ViewPing contentId={c.id} />
      {/* 헤더 */}
      <section className="relative overflow-hidden rounded-xl border border-border bg-card">
        {c.backdropUrl && (
          <div className="absolute inset-0">
            <Image src={c.backdropUrl} alt="" fill className="object-cover opacity-30 blur-md scale-110" sizes="1080px" unoptimized={c.backdropUrl.startsWith("/api/img")} priority />
            <div className="absolute inset-0 bg-gradient-to-r from-card via-card/90 to-card/60" />
          </div>
        )}
        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:p-6">
          <Poster src={c.posterUrl} alt={title} size="lg" className="mx-auto shadow-xl ring-1 ring-black/20 sm:mx-0" priority sizes="160px" />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Link href={`/ranking/${cat.slug}`} className="font-semibold hover:underline">
                {cat.icon} {catName}
              </Link>
              {metaChips.filter(Boolean).map((x) => (
                <span key={x}>· {x}</span>
              ))}
              {c.isAdult && <span className="rounded bg-lose px-1 text-[10px] font-bold text-white">19</span>}
            </div>
            <div>
              <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">{title}</h1>
              {c.titleOriginal && c.titleOriginal !== title && <p className="text-sm text-muted-foreground">{c.titleOriginal}</p>}
              {typeof m.title_ko === "string" && locale === "ko" && <p className="text-sm text-muted-foreground">{m.title_ko}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {d.genres.map((g) => (
                <Link key={g.slug} href={`/ranking/${cat.slug}?genre=${encodeURIComponent(g.slug)}`} className="rounded-full border border-border bg-background px-2 py-0.5 hover:border-primary">
                  {locale === "en" ? g.nameEn : g.nameKo}
                </Link>
              ))}
              <PlatformIcons metadata={m} categorySlug={cat.slug} />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <TierBadge tier={s.tier} size="xl" />
              <div>
                <div className="flex items-center gap-2 text-sm font-bold">
                  {s.rank ? t("content.rankIn", { category: catName, rank: s.rank }) : t("common.unranked")}
                  <RankDelta delta={s.rankDelta} prevRank={s.prevRank} isNew={s.rank != null && s.prevRank == null} />
                </div>
                <div className="flex items-end gap-3">
                  <Score score={s.bayesianScore} size="xl" />
                  <span className="pb-1 text-sm text-muted-foreground tabular">{t("common.ratingsCount", { count: formatCount(s.ratingCount, locale) })}</span>
                </div>
              </div>
              {c.externalScore != null && (
                <div className="rounded-md border border-border bg-background/70 px-3 py-2 text-xs">
                  <div className="text-muted-foreground">{t("common.external")} · {SOURCE_LABEL[c.externalSource] ?? c.externalSource}</div>
                  <div className="text-base font-extrabold tabular">
                    {formatScore(c.externalScore)} <span className="text-xs font-normal text-muted-foreground">({formatCount(c.externalScoreCount, locale)})</span>
                  </div>
                </div>
              )}
              <div className="rounded-md border border-border bg-background/70 px-3 py-2 text-xs">
                <div className="text-muted-foreground">{t("battle.title")}</div>
                <div className="text-base font-extrabold tabular">
                  <span className="text-win">{s.eloWins}</span> : <span className="text-lose">{s.eloLosses}</span> <span className="text-xs font-normal text-muted-foreground">ELO {Math.round(s.elo)}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {c.externalUrl && (
                <Button variant="outline" size="sm" className="h-8" nativeButton={false} render={<a href={c.externalUrl} target="_blank" rel="noreferrer" />}>
                  <ExternalLink className="mr-1 h-3.5 w-3.5" /> {t("common.openExternal")}
                </Button>
              )}
              <ShareButton title={title} />
              <Button variant="outline" size="sm" className="h-8" nativeButton={false} render={<Link href={`/battle?category=${cat.slug}`} />}>
                <Swords className="mr-1 h-3.5 w-3.5" /> {t("battle.title")}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <RatingWidget contentId={c.id} initial={myRating ? Number(myRating.score) : null} loggedIn={!!user} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          {c.description && (
            <details className="group rounded-lg border border-border bg-card p-4" open>
              <summary className="cursor-pointer text-sm font-bold">{t("content.synopsis")}</summary>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{c.description}</p>
              {people.some(([, v]) => Array.isArray(v) ? v.length : v) && (
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  {people.map(([k, v]) => {
                    const val = Array.isArray(v) ? v.filter(Boolean).join(", ") : typeof v === "string" ? v : "";
                    return val ? (
                      <div key={k} className="contents">
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd>{val}</dd>
                      </div>
                    ) : null;
                  })}
                </dl>
              )}
            </details>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <DistributionChart dist={distFromStats(s)} mine={myRating ? Number(myRating.score) : null} />
            <RankHistoryChart history={history.map((h) => ({ week: String(h.week), rank: h.rank, score: String(h.score) }))} current={{ rank: s.rank, score: s.bayesianScore }} />
          </div>
          {(rivals.above || rivals.below) && (
            <div className="grid gap-3 md:grid-cols-2">
              {rivals.above && <RivalCard me={me} rival={rivals.above} categorySlug={cat.slug} loggedIn={!!user} label={`▲ #${rivals.above.rank}`} />}
              {rivals.below && <RivalCard me={me} rival={rivals.below} categorySlug={cat.slug} loggedIn={!!user} label={`▼ #${rivals.below.rank}`} />}
            </div>
          )}
          <ReviewSection contentId={c.id} initial={initialReviews} viewer={viewer} myRating={myRating ? Number(myRating.score) : null} myReview={myReview} />
        </div>

        <aside className="space-y-4">
          <SideList title={t("content.sameCategoryTop")} rows={top5} categorySlug={cat.slug} />
          {sameGenre.length > 0 && <SideList title={t("content.sameGenre")} rows={sameGenre} categorySlug={cat.slug} />}
          {battleRows.length > 0 && (
            <section className="rounded-lg border border-border bg-card">
              <h2 className="border-b border-border px-4 py-2.5 text-sm font-bold">{t("content.battlesWith")}</h2>
              <ul className="divide-y divide-border">
                {battleRows.map(({ battle: b, aTitle, bTitle }) => {
                  const total = b.votesA + b.votesB || 1;
                  const isA = b.contentAId === c.id;
                  const my = isA ? b.votesA : b.votesB;
                  return (
                    <li key={b.id}>
                      <Link href={`/battle/${b.id}`} className="block px-4 py-2 text-xs hover:bg-accent/60">
                        <div className="flex justify-between font-semibold">
                          <span className="truncate">{isA ? bTitle : aTitle}</span>
                          <span className={my / total >= 0.5 ? "text-win" : "text-lose"}>{Math.round((my / total) * 100)}%</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded bg-muted"><div className="h-full bg-win" style={{ width: `${(my / total) * 100}%` }} /></div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {postRows.length > 0 && (
            <section className="rounded-lg border border-border bg-card">
              <h2 className="border-b border-border px-4 py-2.5 text-sm font-bold">{t("content.posts")}</h2>
              <ul className="divide-y divide-border">
                {postRows.map((p) => (
                  <li key={p.id}>
                    <Link href={`/community/${p.categorySlug}/${p.id}`} className="block px-4 py-2 text-xs hover:bg-accent/60">
                      <div className="truncate font-semibold">{p.title}</div>
                      <div className="text-muted-foreground">{p.nickname} · 💬 {p.commentCount}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function SideList({ title, rows, categorySlug }: { title: string; rows: { id: number; slug: string; title: string; posterUrl: string | null; rank: number | null; tier: "S" | "A" | "B" | "C" | "D" | null; bayesianScore: string }[]; categorySlug: string }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <h2 className="border-b border-border px-4 py-2.5 text-sm font-bold">{title}</h2>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={contentHref(categorySlug, r.slug)} className="flex items-center gap-2 px-4 py-2 hover:bg-accent/60">
              <span className="w-6 text-xs font-bold text-muted-foreground tabular">#{r.rank}</span>
              <Poster src={r.posterUrl} alt={r.title} size="xs" />
              <span className="min-w-0 flex-1 truncate text-sm">{r.title}</span>
              <span className="text-xs font-bold tabular">{formatScore(r.bayesianScore)}</span>
              <TierBadge tier={r.tier} size="sm" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
