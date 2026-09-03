"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { MessageSquareText } from "lucide-react";
import { Poster } from "@/components/content/poster";
import { Stars } from "@/components/ranking/stars";
import { contentHref, relativeTime } from "@/lib/format";
import type { LiveReview } from "@/lib/db/queries/home";

export function LiveReviews({ initial }: { initial: LiveReview[] }) {
  const t = useTranslations("home");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [rows, setRows] = useState(initial);
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/live-reviews", { cache: "no-store" });
        if (res.ok) setRows(await res.json());
      } catch {}
    }, 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <section className="rounded-lg border border-border bg-card">
      <h2 className="flex items-center gap-1.5 border-b border-border px-4 py-3 text-sm font-bold">
        <MessageSquareText className="h-4 w-4 text-primary" /> {t("liveReviews")}
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-normal text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-up" /> LIVE
        </span>
      </h2>
      <ul className="max-h-[520px] overflow-y-auto">
        {rows.map((r) => (
          <li key={r.id} className="border-b border-border last:border-0">
            <Link href={contentHref(r.categorySlug, r.slug)} className="flex gap-3 px-4 py-2.5 hover:bg-accent/60">
              <Poster src={r.posterUrl} alt={r.title} size="xs" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{r.nickname}</span>
                  {r.score && <Stars value={Number(r.score)} size={10} />}
                  <span className="ml-auto" suppressHydrationWarning>{relativeTime(r.createdAt, locale)}</span>
                </div>
                <div className="truncate text-xs font-semibold">{r.title}</div>
                <p className={r.isSpoiler ? "line-clamp-2 text-xs text-muted-foreground blur-[3px]" : "line-clamp-2 text-xs text-muted-foreground"}>{r.isSpoiler ? tc("spoiler") + " " + r.body : r.body}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
