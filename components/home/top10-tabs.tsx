"use client";
import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { TierBadge } from "@/components/ranking/tier-badge";
import { RankDelta } from "@/components/ranking/rank-delta";
import { Poster } from "@/components/content/poster";
import { contentHref, displayTitle, formatScore } from "@/lib/format";
import type { RankingRow } from "@/lib/db/queries/ranking";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

type Cat = { slug: string; nameKo: string; nameEn: string; icon: string; color: string };

export function Top10Tabs({ categories, data }: { categories: Cat[]; data: Record<string, RankingRow[]> }) {
  const t = useTranslations("home");
  const locale = useLocale();
  const [active, setActive] = useState(categories[0]?.slug);
  const rows = data[active] ?? [];
  const cat = categories.find((c) => c.slug === active);
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="scrollbar-none flex gap-1 overflow-x-auto">
          {categories.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => setActive(c.slug)}
              className={cn("shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors", active === c.slug ? "border-primary bg-primary text-white" : "border-border bg-card hover:border-primary")}
            >
              <span className="mr-1">{c.icon}</span>
              {locale === "en" ? c.nameEn : c.nameKo}
            </button>
          ))}
        </div>
        {cat && (
          <Link href={`/ranking/${cat.slug}`} className="shrink-0 text-xs font-semibold text-primary hover:underline">
            {t("viewTierList")} →
          </Link>
        )}
      </div>
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-3 pb-3">
          {rows.map((r) => {
            const title = displayTitle(r, locale);
            return (
              <Link key={r.id} href={contentHref(active, r.slug)} className="group relative w-[140px] shrink-0 sm:w-[160px]">
                <Poster src={r.posterUrl} alt={title} size="card" className="h-[186px] sm:h-[213px] ring-1 ring-black/10 transition-transform group-hover:-translate-y-1" />
                <span className={cn("absolute -left-1 -top-2 text-5xl font-black italic leading-none drop-shadow-[0_2px_0_rgba(0,0,0,.6)] tabular", (r.rank ?? 99) <= 3 ? "text-tier-s" : "text-white")}>{r.rank}</span>
                <TierBadge tier={r.tier} size="sm" className="absolute right-1.5 top-1.5" />
                <div className="mt-2 space-y-0.5 whitespace-normal">
                  <div className="line-clamp-1 text-sm font-bold">{title}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-bold text-foreground tabular">{formatScore(r.bayesianScore)}</span>
                    <RankDelta delta={r.rankDelta} prevRank={r.prevRank} />
                    <span className="tabular">{r.ratingCount.toLocaleString()}</span>
                  </div>
                </div>
              </Link>
            );
          })}
          {rows.length === 0 && <div className="py-10 text-sm text-muted-foreground">–</div>}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </section>
  );
}
