import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Trophy } from "lucide-react";
import { getOfficialCategories, getCategoryBySlug } from "@/lib/db/queries/categories";
import { getBattleCards } from "@/lib/db/queries/home";
import { getEloLeaderboard } from "@/lib/db/queries/battles";
import { getCurrentUser } from "@/lib/auth";
import { BattleArena } from "@/components/battle/battle-arena";
import { CreateBattleForm } from "@/components/battle/create-battle";
import { Poster } from "@/components/content/poster";
import { TierBadge } from "@/components/ranking/tier-badge";
import { contentHref } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "1:1 대결" };

export default async function BattlePage({ searchParams }: { searchParams: Promise<{ category?: string; tab?: string }> }) {
  const { category, tab } = await searchParams;
  const t = await getTranslations("battle");
  const locale = await getLocale();
  const [user, cats] = await Promise.all([getCurrentUser(), getOfficialCategories()]);
  const cat = category ? await getCategoryBySlug(category) : null;
  const [initial, board] = await Promise.all([getBattleCards({ categoryId: cat?.id, random: true, n: 5, viewerId: user?.id }), getEloLeaderboard(cat?.id, 50)]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold">⚔️ {t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("sub")}</p>
        </div>
        <div className="scrollbar-none flex gap-1 overflow-x-auto">
          <Link href={`/battle${tab ? `?tab=${tab}` : ""}`} className={cn("shrink-0 rounded-full border px-3 py-1 text-xs font-semibold", !cat ? "border-primary bg-primary text-white" : "border-border bg-card")}>
            {locale === "en" ? "All" : "전체"}
          </Link>
          {cats.map((c) => (
            <Link key={c.slug} href={`/battle?category=${c.slug}${tab ? `&tab=${tab}` : ""}`} className={cn("shrink-0 rounded-full border px-3 py-1 text-xs font-semibold", cat?.slug === c.slug ? "border-primary bg-primary text-white" : "border-border bg-card")}>
              {c.icon} {locale === "en" ? c.nameEn : c.nameKo}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex gap-1 border-b border-border text-sm">
        {[
          ["", t("title")],
          ["leaderboard", t("leaderboard")],
          ["create", t("create")],
        ].map(([k, label]) => (
          <Link key={k} href={`/battle?${cat ? `category=${cat.slug}&` : ""}${k ? `tab=${k}` : ""}`} className={cn("border-b-2 px-3 py-2 font-semibold", (tab ?? "") === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {label}
          </Link>
        ))}
      </div>

      {(tab ?? "") === "" && (
        <div className="mx-auto max-w-2xl">
          <BattleArena initial={initial} loggedIn={!!user} categorySlug={cat?.slug} />
        </div>
      )}
      {tab === "leaderboard" && (
        <section className="rounded-lg border border-border bg-card">
          <h2 className="flex items-center gap-1.5 border-b border-border px-4 py-3 text-sm font-bold">
            <Trophy className="h-4 w-4 text-tier-a" /> {t("leaderboard")} <span className="text-xs font-normal text-muted-foreground">{t("leaderboardSub")}</span>
          </h2>
          <ol className="divide-y divide-border">
            {board.map((r, i) => {
              const total = r.wins + r.losses;
              return (
                <li key={r.id}>
                  <Link href={contentHref(r.categorySlug, r.slug)} className="flex items-center gap-3 px-4 py-2 hover:bg-accent/60">
                    <span className={cn("w-6 text-center text-base font-extrabold tabular", i < 3 ? "text-tier-s" : "text-muted-foreground")}>{i + 1}</span>
                    <Poster src={r.posterUrl} alt={r.title} size="xs" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{r.title}</div>
                      <div className="text-[11px] text-muted-foreground">{r.categoryIcon} #{r.rank ?? "–"} · {t("record", { wins: r.wins, losses: r.losses })} · {t("winRate", { rate: total ? Math.round((r.wins / total) * 100) : 0 })}</div>
                    </div>
                    <span className="text-base font-extrabold tabular">{Math.round(r.elo)}</span>
                    <TierBadge tier={r.tier} size="sm" />
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      )}
      {tab === "create" && (
        <div className="mx-auto max-w-2xl">
          <CreateBattleForm loggedIn={!!user} />
        </div>
      )}
    </div>
  );
}
