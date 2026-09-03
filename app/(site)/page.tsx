import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Swords, Plus } from "lucide-react";
import { Hero } from "@/components/home/hero";
import { Top10Tabs } from "@/components/home/top10-tabs";
import { RisingList } from "@/components/home/rising-list";
import { SiteStats } from "@/components/home/site-stats";
import { LiveReviews } from "@/components/home/live-reviews";
import { BattleCard } from "@/components/battle/battle-card";
import { getOfficialCategories, getUserCategories } from "@/lib/db/queries/categories";
import { getTopN } from "@/lib/db/queries/ranking";
import { getBattleCards, getLiveReviews } from "@/lib/db/queries/home";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const t = await getTranslations("home");
  const locale = await getLocale();
  const [user, official, userCats] = await Promise.all([getCurrentUser(), getOfficialCategories(), getUserCategories()]);
  const cats = [...official, ...userCats.slice(0, 3)];
  const [tops, battlesList, liveReviews] = await Promise.all([
    Promise.all(cats.map((c) => getTopN(c.id, 10))),
    getBattleCards({ featured: true, random: true, n: 3, viewerId: user?.id }),
    getLiveReviews(20),
  ]);
  // 클라이언트로 넘기는 페이로드 최소화 (metadata 등 제외)
  const data = Object.fromEntries(cats.map((c, i) => [c.slug, tops[i].map((r) => ({ id: r.id, slug: r.slug, title: r.title, titleOriginal: r.titleOriginal, posterUrl: r.posterUrl, rank: r.rank, prevRank: r.prevRank, rankDelta: r.rankDelta, tier: r.tier, bayesianScore: r.bayesianScore, ratingCount: r.ratingCount }))]));

  return (
    <div className="space-y-8">
      <Hero />
      <Top10Tabs categories={cats.map((c) => ({ slug: c.slug, nameKo: c.nameKo, nameEn: c.nameEn, icon: c.icon, color: c.color }))} data={data} />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <section>
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold">
              <Swords className="h-4 w-4 text-lose" /> {t("battles")}
              <Link href="/battle" className="ml-auto text-xs font-semibold text-primary hover:underline">
                {locale === "en" ? "All battles" : "대결 더 보기"} →
              </Link>
            </h2>
            <div className="grid gap-3 md:grid-cols-3">
              {battlesList.map((b) => (
                <BattleCard key={b.id} battle={b} loggedIn={!!user} />
              ))}
            </div>
          </section>
          <RisingList />
        </div>
        <div className="space-y-4">
          <SiteStats />
          <LiveReviews initial={liveReviews} />
        </div>
      </div>

      <section className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-8 text-center">
        <h2 className="text-lg font-extrabold">{t("createCta")}</h2>
        <p className="text-sm text-muted-foreground">{t("createCtaDesc")}</p>
        <Button nativeButton={false} render={<Link href="/create" />} className="bg-primary hover:bg-primary/90">
          <Plus className="mr-1 h-4 w-4" /> {t("createCta")}
        </Button>
      </section>
    </div>
  );
}
