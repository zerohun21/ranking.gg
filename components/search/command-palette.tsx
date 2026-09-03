"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Poster } from "@/components/content/poster";
import { TierBadge } from "@/components/ranking/tier-badge";
import { contentHref, formatScore } from "@/lib/format";
import type { SearchHit } from "@/lib/db/queries/search";
import type { Tier } from "@/lib/db/schema";

export function useSearchHits(q: string, delay = 150) {
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!q.trim()) {
      setHits([]);
      return;
    }
    const id = setTimeout(async () => {
      ctrl.current?.abort();
      const c = new AbortController();
      ctrl.current = c;
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, { signal: c.signal });
        if (res.ok) setHits(await res.json());
      } catch {}
      setLoading(false);
    }, delay);
    return () => clearTimeout(id);
  }, [q, delay]);
  return { hits, loading };
}

export function CommandPalette({ open, onOpenChange, initialQuery = "" }: { open: boolean; onOpenChange: (o: boolean) => void; initialQuery?: string }) {
  const t = useTranslations("search");
  const locale = useLocale();
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const { hits, loading } = useSearchHits(q);
  useEffect(() => {
    if (open) setQ(initialQuery);
  }, [open, initialQuery]);

  const groups = hits.reduce<Record<string, SearchHit[]>>((acc, h) => ((acc[h.categorySlug] ??= []).push(h), acc), {});
  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0" showCloseButton={false}>
        <DialogTitle className="sr-only">{t("placeholder")}</DialogTitle>
        <Command shouldFilter={false} className="rounded-none">
          <CommandInput value={q} onValueChange={setQ} placeholder={t("placeholder")} autoFocus onKeyDown={(e) => { if (e.key === "Enter" && q.trim() && hits.length === 0) go(`/search?q=${encodeURIComponent(q.trim())}`); }} />
          <CommandList className="max-h-[420px]">
            {q.trim() && !loading && hits.length === 0 && <CommandEmpty>{t("noResults")}</CommandEmpty>}
            {!q.trim() && <div className="p-4 text-center text-xs text-muted-foreground">{t("typeToSearch")}</div>}
            {q.trim() && (
              <CommandGroup>
                <CommandItem value={`__all_${q}`} onSelect={() => go(`/search?q=${encodeURIComponent(q.trim())}`)} className="text-sm">
                  🔍 <span className="font-semibold">“{q}”</span> {t("all")}
                </CommandItem>
              </CommandGroup>
            )}
            {Object.entries(groups).map(([slug, rows]) => (
              <CommandGroup key={slug} heading={`${rows[0].categoryIcon} ${rows[0].categoryName}`}>
                {rows.map((h) => (
                  <CommandItem key={h.id} value={`${h.id}`} onSelect={() => go(contentHref(h.categorySlug, h.slug))} className="gap-3">
                    <Poster src={h.posterUrl} alt={h.title} size="xs" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{locale === "en" && h.titleOriginal ? h.titleOriginal : h.title}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {h.releaseYear ?? ""} {h.titleOriginal && h.titleOriginal !== h.title ? `· ${h.titleOriginal}` : ""}
                      </div>
                    </div>
                    <span className="text-xs tabular text-muted-foreground">#{h.rank ?? "–"} · {formatScore(h.score)}</span>
                    <TierBadge tier={h.tier as Tier | null} size="sm" />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
        <div className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">↑↓ · Enter · Esc · {t("hint")}</div>
      </DialogContent>
    </Dialog>
  );
}

/** 전역 Cmd/Ctrl+K 리스너 */
export function GlobalCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("rgg:open-search", () => setOpen(true));
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return <CommandPalette open={open} onOpenChange={setOpen} />;
}
