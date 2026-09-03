import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Flame } from "lucide-react";
import { getRising } from "@/lib/db/queries/ranking";
import { Poster } from "@/components/content/poster";
import { TierBadge } from "@/components/ranking/tier-badge";
import { RankDelta } from "@/components/ranking/rank-delta";
import { contentHref, displayTitle, formatScore } from "@/lib/format";

export async function RisingList() {
  const t = await getTranslations("home");
  const locale = await getLocale();
  const rows = await getRising(10);
  return (
    <section className="rounded-lg border border-border bg-card">
      <h2 className="flex items-center gap-1.5 border-b border-border px-4 py-3 text-sm font-bold">
        <Flame className="h-4 w-4 text-tier-s" /> {t("rising")}
      </h2>
      <ol>
        {rows.map((r, i) => {
          const title = displayTitle(r, locale);
          return (
            <li key={r.id}>
              <Link href={contentHref(r.categorySlug, r.slug)} className="flex items-center gap-3 px-4 py-2 hover:bg-accent/60">
                <span className="w-4 text-center text-sm font-extrabold text-muted-foreground tabular">{i + 1}</span>
                <Poster src={r.posterUrl} alt={title} size="xs" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {r.categoryIcon} {r.categoryName} · #{r.rank} · {formatScore(r.bayesianScore)}
                  </div>
                </div>
                <RankDelta delta={r.rankDelta} prevRank={r.prevRank} />
                <TierBadge tier={r.tier} size="sm" />
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
