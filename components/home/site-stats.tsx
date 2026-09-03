import { getLocale, getTranslations } from "next-intl/server";
import { BarChart3 } from "lucide-react";
import { getSiteStats } from "@/lib/db/queries/home";
import { formatCount } from "@/lib/format";

export async function SiteStats() {
  const t = await getTranslations("home");
  const locale = await getLocale();
  const s = await getSiteStats();
  const items = [
    [t("totalContents"), s.contents],
    [t("totalRatings"), s.ratings],
    [t("todayRatings"), s.today],
    [t("activeUsers"), s.users],
  ] as const;
  return (
    <section className="rounded-lg border border-border bg-card">
      <h2 className="flex items-center gap-1.5 border-b border-border px-4 py-3 text-sm font-bold">
        <BarChart3 className="h-4 w-4 text-primary" /> {t("stats")}
      </h2>
      <div className="grid grid-cols-2 gap-px bg-border">
        {items.map(([label, v]) => (
          <div key={label} className="bg-card px-4 py-3">
            <div className="text-[11px] text-muted-foreground">{label}</div>
            <div className="text-xl font-extrabold tabular">{formatCount(v, locale)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
