"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale } from "next-intl";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearchHits } from "./command-palette";
import { Poster } from "@/components/content/poster";
import { TierBadge } from "@/components/ranking/tier-badge";
import { contentHref, formatScore } from "@/lib/format";
import type { Tier } from "@/lib/db/schema";

/** 헤더/히어로 검색창 + 인라인 자동완성 드롭다운 */
export function SearchBox({ placeholder, className, size = "md" }: { placeholder: string; className?: string; size?: "md" | "xl" }) {
  const router = useRouter();
  const locale = useLocale();
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const [active, setActive] = useState(-1);
  const { hits } = useSearchHits(q);
  const show = focus && q.trim().length > 0 && hits.length > 0;
  const submit = () => {
    if (active >= 0 && hits[active]) router.push(contentHref(hits[active].categorySlug, hits[active].slug));
    else if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
    setFocus(false);
  };
  return (
    <form
      role="search"
      className={cn("relative", className)}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Search className={cn("pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground", size === "xl" ? "h-5 w-5" : "h-4 w-4")} />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(-1);
        }}
        onFocus={() => setFocus(true)}
        onBlur={() => setTimeout(() => setFocus(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(hits.length - 1, a + 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
          if (e.key === "Escape") setFocus(false);
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        aria-autocomplete="list"
        className={cn(
          "w-full rounded-md border border-border bg-card text-card-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary",
          size === "xl" ? "h-14 pl-11 pr-4 text-base shadow-lg" : "h-9 pl-9 pr-16 text-sm",
        )}
      />
      {size === "md" && <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:block">⌘K</kbd>}
      {show && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[400px] overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-xl" role="listbox">
          {hits.map((h, i) => (
            <li key={h.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  router.push(contentHref(h.categorySlug, h.slug));
                  setFocus(false);
                }}
                className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-accent", i === active && "bg-accent")}
              >
                <Poster src={h.posterUrl} alt={h.title} size="xs" className="h-10 w-7" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{locale === "en" && h.titleOriginal ? h.titleOriginal : h.title}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{h.categoryIcon} {h.categoryName} {h.releaseYear ? `· ${h.releaseYear}` : ""}</div>
                </div>
                <span className="text-[11px] tabular text-muted-foreground">#{h.rank ?? "–"} · {formatScore(h.score)}</span>
                <TierBadge tier={h.tier as Tier | null} size="sm" />
              </button>
            </li>
          ))}
          <li>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={submit} className="w-full rounded px-2 py-1.5 text-left text-xs font-semibold text-primary hover:bg-accent">
              🔍 “{q}” →
            </button>
          </li>
        </ul>
      )}
    </form>
  );
}
