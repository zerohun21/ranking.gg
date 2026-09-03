"use client";
import { useQueryStates } from "nuqs";
import { useLocale, useTranslations } from "next-intl";
import { LayoutList, LayoutGrid, SlidersHorizontal, X } from "lucide-react";
import { rankingParsers, SORTS } from "@/lib/ranking-params";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TIER_ORDER } from "@/lib/ranking/tier";
import { TierBadge } from "./tier-badge";
import { cn } from "@/lib/utils";
import type { Tier } from "@/lib/db/schema";

export type FilterMeta = {
  genres: { slug: string; nameKo: string; nameEn: string; count: number }[];
  platforms: { key: string; label: string; count?: number }[];
  years: { min: number | null; max: number | null };
  hasStatus: boolean;
  hasKind: boolean;
};

export function ViewSortBar({ total }: { total: number }) {
  const t = useTranslations("ranking");
  const [p, setP] = useQueryStates(rankingParsers, { shallow: false });
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <ToggleGroup value={[p.view]} onValueChange={(v) => v[0] && setP({ view: v[0] as "list" | "board", page: 1 })} className="rounded-md border border-border bg-card">
          <ToggleGroupItem value="list" aria-label={t("viewList")} className="h-8 gap-1 px-2 text-xs data-[pressed]:bg-primary data-[pressed]:text-white">
            <LayoutList className="h-3.5 w-3.5" /> {t("viewList")}
          </ToggleGroupItem>
          <ToggleGroupItem value="board" aria-label={t("viewBoard")} className="h-8 gap-1 px-2 text-xs data-[pressed]:bg-primary data-[pressed]:text-white">
            <LayoutGrid className="h-3.5 w-3.5" /> {t("viewBoard")}
          </ToggleGroupItem>
        </ToggleGroup>
        <span className="text-xs text-muted-foreground tabular">{total.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-2">
        <Select value={p.sort} onValueChange={(v) => v && setP({ sort: v as (typeof SORTS)[number], page: 1 })}>
          <SelectTrigger className="h-8 w-[130px] text-xs" aria-label={t("sort")}>
            <SelectValue>{t(`sort${p.sort[0].toUpperCase()}${p.sort.slice(1)}` as "sortRank")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`sort${s[0].toUpperCase()}${s.slice(1)}` as "sortRank")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Sheet>
          <SheetTrigger className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card px-2 text-xs font-semibold lg:hidden">
            <SlidersHorizontal className="h-3.5 w-3.5" /> {t("filters")}
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{t("filters")}</SheetTitle>
            </SheetHeader>
            <div id="mobile-filters-slot" />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

export function FilterSidebar({ meta, className }: { meta: FilterMeta; className?: string }) {
  const t = useTranslations("ranking");
  const locale = useLocale();
  const [p, setP] = useQueryStates(rankingParsers, { shallow: false });
  const toggle = (key: "genre" | "platform" | "status", v: string) => {
    const cur = p[key] as string[];
    setP({ [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v], page: 1 });
  };
  const toggleTier = (v: Tier) => setP({ tier: p.tier.includes(v) ? p.tier.filter((x) => x !== v) : [...p.tier, v], page: 1 });
  const active = p.genre.length + p.platform.length + p.status.length + p.tier.length + (p.yearFrom ? 1 : 0) + (p.yearTo ? 1 : 0) + (p.minRatings ? 1 : 0) + (p.kind ? 1 : 0);

  return (
    <aside className={cn("space-y-5 text-sm", className)}>
      <div className="flex items-center justify-between">
        <h3 className="font-bold">{t("filters")}</h3>
        {active > 0 && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setP({ genre: [], platform: [], status: [], tier: [], yearFrom: null, yearTo: null, minRatings: 0, kind: null, page: 1 })}>
            <X className="mr-1 h-3 w-3" /> {t("reset")} ({active})
          </Button>
        )}
      </div>

      <section>
        <h4 className="mb-2 text-xs font-semibold text-muted-foreground">{t("colTier")}</h4>
        <div className="flex gap-1.5">
          {TIER_ORDER.map((tier) => (
            <button key={tier} type="button" onClick={() => toggleTier(tier)} className={cn("rounded-md transition-opacity", p.tier.length && !p.tier.includes(tier) && "opacity-30")} aria-pressed={p.tier.includes(tier)}>
              <TierBadge tier={tier} size="md" />
            </button>
          ))}
        </div>
      </section>

      {meta.hasKind && (
        <section>
          <h4 className="mb-2 text-xs font-semibold text-muted-foreground">{locale === "en" ? "Type" : "종류"}</h4>
          <ToggleGroup value={p.kind ? [p.kind] : []} onValueChange={(v) => setP({ kind: v[0] ?? null, page: 1 })} className="flex-wrap gap-1">
            {[
              ["tv", locale === "en" ? "Drama" : "드라마"],
              ["variety", locale === "en" ? "Variety" : "예능"],
            ].map(([k, label]) => (
              <ToggleGroupItem key={k} value={k} className="h-7 rounded-md border border-border px-2 text-xs data-[pressed]:bg-primary data-[pressed]:text-white">
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </section>
      )}

      {meta.platforms.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-semibold text-muted-foreground">{t("colTitle") === "Title" ? "Platform / OTT" : "플랫폼 / OTT"}</h4>
          <div className="flex flex-wrap gap-1">
            {meta.platforms.map((pl) => (
              <button
                key={pl.key}
                type="button"
                onClick={() => toggle("platform", pl.key)}
                className={cn("rounded-md border px-2 py-1 text-xs font-semibold transition-colors", p.platform.includes(pl.key) ? "border-primary bg-primary text-white" : "border-border bg-card hover:border-primary")}
              >
                {pl.label}
                {pl.count != null && <span className="ml-1 opacity-60 tabular">{pl.count}</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      {meta.genres.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-semibold text-muted-foreground">{locale === "en" ? "Genre" : "장르"}</h4>
          <div className="grid max-h-64 grid-cols-2 gap-1 overflow-y-auto pr-1">
            {meta.genres.map((g) => (
              <Label key={g.slug} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs font-normal hover:bg-accent">
                <Checkbox checked={p.genre.includes(g.slug)} onCheckedChange={() => toggle("genre", g.slug)} />
                <span className="truncate">{locale === "en" ? g.nameEn : g.nameKo}</span>
                <span className="ml-auto text-[10px] text-muted-foreground tabular">{g.count}</span>
              </Label>
            ))}
          </div>
        </section>
      )}

      {meta.hasStatus && (
        <section>
          <h4 className="mb-2 text-xs font-semibold text-muted-foreground">{t("status")}</h4>
          <div className="flex flex-wrap gap-1">
            {[
              ["ongoing", t("statusOngoing")],
              ["finished", t("statusFinished")],
              ["rest", t("statusRest")],
            ].map(([k, label]) => (
              <button key={k} type="button" onClick={() => toggle("status", k)} className={cn("rounded-md border px-2 py-1 text-xs font-semibold", p.status.includes(k) ? "border-primary bg-primary text-white" : "border-border bg-card hover:border-primary")}>
                {label}
              </button>
            ))}
          </div>
        </section>
      )}

      {meta.years.min && meta.years.max && (
        <section>
          <h4 className="mb-2 text-xs font-semibold text-muted-foreground">{t("yearRange")}</h4>
          <div className="flex items-center gap-2">
            <Input type="number" className="h-8 text-xs" placeholder={String(meta.years.min)} min={meta.years.min} max={meta.years.max} value={p.yearFrom ?? ""} onChange={(e) => setP({ yearFrom: e.target.value ? Number(e.target.value) : null, page: 1 })} />
            <span className="text-muted-foreground">–</span>
            <Input type="number" className="h-8 text-xs" placeholder={String(meta.years.max)} min={meta.years.min} max={meta.years.max} value={p.yearTo ?? ""} onChange={(e) => setP({ yearTo: e.target.value ? Number(e.target.value) : null, page: 1 })} />
          </div>
        </section>
      )}

      <section>
        <h4 className="mb-2 text-xs font-semibold text-muted-foreground">{t("minRatings")}</h4>
        <ToggleGroup value={[String(p.minRatings)]} onValueChange={(v) => v[0] != null && setP({ minRatings: Number(v[0]), page: 1 })} className="flex-wrap gap-1">
          {[0, 5, 50, 200].map((n) => (
            <ToggleGroupItem key={n} value={String(n)} className="h-7 rounded-md border border-border px-2 text-xs tabular data-[pressed]:bg-primary data-[pressed]:text-white">
              {n === 0 ? (locale === "en" ? "All" : "전체") : `${n}+`}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="mt-2 text-[11px] text-muted-foreground">{t("unrankedNote")}</p>
      </section>
    </aside>
  );
}

export function Pagination({ page, total, perPage }: { page: number; total: number; perPage: number }) {
  const t = useTranslations("ranking");
  const [, setP] = useQueryStates(rankingParsers, { shallow: false, scroll: true });
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;
  const from = (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);
  return (
    <div className="flex items-center justify-between gap-2 py-3 text-xs">
      <span className="text-muted-foreground tabular">{t("showing", { from, to, total })}</span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" className="h-8" disabled={page <= 1} onClick={() => setP({ page: page - 1 })}>
          ‹
        </Button>
        {Array.from({ length: Math.min(7, pages) }, (_, i) => {
          const start = Math.max(1, Math.min(page - 3, pages - 6));
          const n = start + i;
          return (
            <Button key={n} variant={n === page ? "default" : "outline"} size="sm" className="h-8 w-8 px-0 tabular" onClick={() => setP({ page: n })}>
              {n}
            </Button>
          );
        })}
        <Button variant="outline" size="sm" className="h-8" disabled={page >= pages} onClick={() => setP({ page: page + 1 })}>
          ›
        </Button>
      </div>
    </div>
  );
}
