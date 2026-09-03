import Link from "next/link";
import { getLocale } from "next-intl/server";
import { TierBadge } from "./tier-badge";
import { Poster } from "@/components/content/poster";
import { TIER_ORDER } from "@/lib/ranking/tier";
import type { RankingRow } from "@/lib/db/queries/ranking";
import type { Tier } from "@/lib/db/schema";
import { contentHref, displayTitle, formatScore } from "@/lib/format";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const ROW_BG: Record<Tier, string> = { S: "bg-tier-s/10", A: "bg-tier-a/10", B: "bg-tier-b/10", C: "bg-tier-c/10", D: "bg-tier-d/10" };

export async function TierBoard({ board, categorySlug }: { board: Record<Tier, RankingRow[]>; categorySlug: string }) {
  const locale = await getLocale();
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {TIER_ORDER.map((tier) => (
        <div key={tier} className={`flex border-b border-border last:border-0 ${ROW_BG[tier]}`}>
          <div className="flex w-16 shrink-0 items-start justify-center border-r border-border py-3 sm:w-20">
            <TierBadge tier={tier} size="lg" />
          </div>
          <div className="flex flex-1 flex-wrap gap-1.5 p-2">
            {board[tier].length === 0 && <span className="px-2 py-3 text-xs text-muted-foreground">–</span>}
            {board[tier].map((r) => {
              const title = displayTitle(r, locale);
              return (
                <Tooltip key={r.id}>
                  <TooltipTrigger render={<Link href={contentHref(categorySlug, r.slug)} className="group relative block" />}>
                    <Poster src={r.posterUrl} alt={title} size="sm" className="h-20 w-[60px] ring-1 ring-black/10 transition-transform group-hover:scale-105 sm:h-24 sm:w-[72px]" />
                    <span className="absolute left-0.5 top-0.5 rounded bg-black/70 px-1 text-[10px] font-bold text-white tabular">#{r.rank}</span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[220px]">
                    <div className="font-bold">{title}</div>
                    <div className="text-xs opacity-80">#{r.rank} · {formatScore(r.bayesianScore)} · {r.ratingCount}</div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
