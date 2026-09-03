import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getProfileByNickname, getProfileStats, getMyRatings, getMyTierBoardRows, getMyReviews, getMyComments, getMyBattles, getActivity } from "@/lib/db/queries/profiles";
import { getCurrentUser } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Poster } from "@/components/content/poster";
import { TierBadge } from "@/components/ranking/tier-badge";
import { Stars } from "@/components/ranking/stars";
import { ProfileEdit } from "@/components/profile/profile-edit";
import { MyDistChart } from "@/components/profile/my-dist-chart";
import { TIER_ORDER } from "@/lib/ranking/tier";
import { contentHref, relativeTime } from "@/lib/format";
import type { Tier } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ nickname: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { nickname } = await params;
  return { title: `${decodeURIComponent(nickname)} 프로필`, robots: { index: false } };
}

const BADGE_ICON: Record<string, string> = { first_rating: "⭐", ratings_10: "🔟", ratings_100: "💯", ratings_1000: "🏆", reviews_10: "✍️", best_review: "👑", battles_100: "⚔️", category_creator: "🛠", early_adopter: "🚀" };
const myTier = (s: number): Tier => (s >= 4.5 ? "S" : s >= 4 ? "A" : s >= 3.5 ? "B" : s >= 2.5 ? "C" : "D");
const ROW_BG: Record<Tier, string> = { S: "bg-tier-s/10", A: "bg-tier-a/10", B: "bg-tier-b/10", C: "bg-tier-c/10", D: "bg-tier-d/10" };

export default async function ProfilePage({ params }: Props) {
  const { nickname } = await params;
  const p = await getProfileByNickname(decodeURIComponent(nickname));
  if (!p) notFound();
  const t = await getTranslations("profile");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const me = await getCurrentUser();
  const isMe = me?.id === p.id;
  const [stats, rated, boardRows, myReviews, myComments, myBattles, activity] = await Promise.all([getProfileStats(p.id), getMyRatings(p.id), getMyTierBoardRows(p.id), getMyReviews(p.id), getMyComments(p.id), getMyBattles(p.id), getActivity(p.id)]);
  const badges = (p.badges as string[]) ?? [];
  const board: Record<Tier, typeof rated> = { S: [], A: [], B: [], C: [], D: [] };
  for (const r of boardRows) board[myTier(Number(r.score))].push(r);

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 sm:flex-row sm:items-center">
        <Avatar className="h-20 w-20 border-2 border-border">
          <AvatarImage src={p.avatarUrl ?? undefined} alt="" />
          <AvatarFallback className="text-2xl">{p.nickname.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold">{p.nickname}</h1>
            {p.isSeed && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{tc("seedUser")}</span>}
            {p.isGuest && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{tc("guest")}</span>}
            {p.isAdmin && <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">ADMIN</span>}
            {isMe && <ProfileEdit nickname={p.nickname} bio={p.bio} avatarUrl={p.avatarUrl} />}
            {isMe && me?.isAnonymous && (
              <Link href="/login?mode=signup" className="rounded-md border border-primary px-2 py-1 text-xs font-semibold text-primary">
                {t("convertGuest")}
              </Link>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t("joined", { date: new Date(p.createdAt).toLocaleDateString(locale === "en" ? "en-US" : "ko-KR") })}</p>
          {p.bio && <p className="mt-1 text-sm">{p.bio}</p>}
          <div className="mt-2 flex flex-wrap gap-1">
            {badges.map((b) => (
              <Tooltip key={b}>
                <TooltipTrigger className="rounded-full border border-border bg-background px-2 py-0.5 text-xs">
                  {BADGE_ICON[b] ?? "🏅"} {t(`badge.${b}` as "badge.first_rating")}
                </TooltipTrigger>
                <TooltipContent>{t(`badge.${b}` as "badge.first_rating")}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3 text-center sm:grid-cols-2 lg:grid-cols-4">
          {[
            [t("ratings"), stats.ratings],
            [t("reviews"), stats.reviews],
            [t("avgRating"), stats.avg ?? "–"],
            [t("modeRating"), stats.mode ?? "–"],
          ].map(([k, v]) => (
            <div key={String(k)} className="rounded-md bg-background px-3 py-2">
              <div className="text-[10px] text-muted-foreground">{k}</div>
              <div className="text-lg font-extrabold tabular">{v}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-bold">{t("myTierList")}</h2>
            <p className="mb-2 text-[11px] text-muted-foreground">{t("myTierListDesc")}</p>
            <div className="overflow-hidden rounded-md border border-border">
              {TIER_ORDER.map((tier) => (
                <div key={tier} className={cn("flex border-b border-border last:border-0", ROW_BG[tier])}>
                  <div className="flex w-14 shrink-0 items-start justify-center border-r border-border py-2">
                    <TierBadge tier={tier} size="md" />
                  </div>
                  <div className="flex flex-1 flex-wrap gap-1 p-1.5">
                    {board[tier].slice(0, 40).map((r) => (
                      <Tooltip key={r.id}>
                        <TooltipTrigger render={<Link href={contentHref(r.categorySlug, r.slug)} className="block" />}>
                          <Poster src={r.posterUrl} alt={r.title} size="xs" className="h-14 w-10 ring-1 ring-black/10" />
                        </TooltipTrigger>
                        <TooltipContent>{r.title} · ★{Number(r.score).toFixed(1)}</TooltipContent>
                      </Tooltip>
                    ))}
                    {board[tier].length >= 40 && <span className="self-center px-1 text-[10px] text-muted-foreground">…</span>}
                    {board[tier].length === 0 && <span className="px-1 py-3 text-[10px] text-muted-foreground">–</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <Tabs defaultValue="reviews">
            <TabsList>
              <TabsTrigger value="reviews">{t("tabReviews")} {stats.reviews}</TabsTrigger>
              <TabsTrigger value="comments">{t("tabComments")} {stats.comments}</TabsTrigger>
              <TabsTrigger value="battles">{t("tabBattles")} {stats.votes}</TabsTrigger>
              <TabsTrigger value="ratings">{t("tabRatings")} {stats.ratings}</TabsTrigger>
            </TabsList>
            <TabsContent value="reviews">
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {myReviews.map((r) => (
                  <li key={r.id}>
                    <Link href={contentHref(r.categorySlug, r.slug)} className="flex gap-3 p-3 hover:bg-accent/60">
                      <Poster src={r.posterUrl} alt={r.title} size="xs" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs"><span className="font-semibold">{r.title}</span>{r.score && <Stars value={Number(r.score)} size={10} />}<span className="ml-auto text-muted-foreground" suppressHydrationWarning>{relativeTime(r.createdAt, locale)}</span></div>
                        <p className="line-clamp-2 text-xs text-muted-foreground">{r.body}</p>
                      </div>
                    </Link>
                  </li>
                ))}
                {myReviews.length === 0 && <li className="p-6 text-center text-xs text-muted-foreground">{tc("empty")}</li>}
              </ul>
            </TabsContent>
            <TabsContent value="comments">
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {myComments.map((c) => (
                  <li key={c.id} className="p-3 text-xs">
                    <span className="mr-2 rounded bg-muted px-1 text-[10px] text-muted-foreground">{c.targetType}</span>
                    {c.body}
                    <span className="ml-2 text-muted-foreground" suppressHydrationWarning>{relativeTime(c.createdAt, locale)}</span>
                  </li>
                ))}
                {myComments.length === 0 && <li className="p-6 text-center text-xs text-muted-foreground">{tc("empty")}</li>}
              </ul>
            </TabsContent>
            <TabsContent value="battles">
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {myBattles.map((b) => (
                  <li key={b.id}>
                    <Link href={`/battle/${b.battleId}`} className="flex items-center gap-2 p-3 text-xs hover:bg-accent/60">
                      <span className={cn("font-semibold", b.choice === "a" && "text-win")}>{b.aTitle}</span>
                      <span className="text-muted-foreground">vs</span>
                      <span className={cn("font-semibold", b.choice === "b" && "text-lose")}>{b.bTitle}</span>
                      <span className="ml-auto text-muted-foreground tabular">{b.votesA}:{b.votesB}</span>
                    </Link>
                  </li>
                ))}
                {myBattles.length === 0 && <li className="p-6 text-center text-xs text-muted-foreground">{tc("empty")}</li>}
              </ul>
            </TabsContent>
            <TabsContent value="ratings">
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {rated.slice(0, 60).map((r) => (
                  <li key={r.id}>
                    <Link href={contentHref(r.categorySlug, r.slug)} className="flex items-center gap-2 rounded-md border border-border bg-card p-2 hover:border-primary">
                      <Poster src={r.posterUrl} alt={r.title} size="xs" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold">{r.title}</div>
                        <Stars value={Number(r.score)} size={10} />
                      </div>
                      <TierBadge tier={r.tier} size="sm" />
                    </Link>
                  </li>
                ))}
              </ul>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-2 text-sm font-bold">{t("myDistribution")}</h2>
            <MyDistChart dist={stats.dist} />
          </section>
          <section className="rounded-lg border border-border bg-card">
            <h2 className="border-b border-border px-4 py-2.5 text-sm font-bold">{t("recentActivity")}</h2>
            <ul className="divide-y divide-border">
              {activity.map((a, i) => (
                <li key={i} className="px-4 py-2 text-xs">
                  <span className="mr-1">{a.kind === "rating" ? "⭐" : a.kind === "review" ? "✍️" : a.kind === "vote" ? "⚔️" : "💬"}</span>
                  <Link href={a.href.startsWith("/community/x/") ? `/community` : a.href} className="font-semibold hover:underline">{a.title}</Link>
                  <span className="ml-1 text-muted-foreground">{a.kind === "rating" ? `★${a.extra}` : a.kind === "vote" ? "" : a.extra}</span>
                  <div className="text-[10px] text-muted-foreground" suppressHydrationWarning>{relativeTime(a.at, locale)}</div>
                </li>
              ))}
              {activity.length === 0 && <li className="p-6 text-center text-xs text-muted-foreground">{tc("empty")}</li>}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
