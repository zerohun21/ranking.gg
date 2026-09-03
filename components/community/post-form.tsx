"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Poster } from "@/components/content/poster";
import { useSearchHits } from "@/components/search/command-palette";
import { createPost } from "@/app/actions/post";
import type { SearchHit } from "@/lib/db/queries/search";
import { cn } from "@/lib/utils";

const TAGS = ["free", "debate", "question", "recommend"] as const;

export function PostForm({ categorySlug, categoryId }: { categorySlug: string; categoryId: number }) {
  const t = useTranslations("community");
  const tc = useTranslations("common");
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tag, setTag] = useState<(typeof TAGS)[number]>("free");
  const [q, setQ] = useState("");
  const [attached, setAttached] = useState<SearchHit | null>(null);
  const { hits } = useSearchHits(q);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex gap-1">
        {TAGS.map((x) => (
          <button key={x} type="button" onClick={() => setTag(x)} className={cn("rounded-md border px-2.5 py-1 text-xs font-semibold", tag === x ? "border-primary bg-primary text-white" : "border-border")}>
            {t(`tag${x[0].toUpperCase()}${x.slice(1)}` as "tagFree")}
          </button>
        ))}
      </div>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("titlePlaceholder")} maxLength={120} />
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("bodyPlaceholder")} rows={10} maxLength={10000} className="text-sm" />
      <div className="space-y-1">
        <div className="text-xs font-semibold text-muted-foreground">{t("attachContent")}</div>
        {attached ? (
          <div className="flex items-center gap-2 rounded-md border border-border p-2">
            <Poster src={attached.posterUrl} alt={attached.title} size="xs" />
            <span className="flex-1 truncate text-sm font-semibold">{attached.title}</span>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAttached(null)}>✕</Button>
          </div>
        ) : (
          <div className="relative">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("attachContentHint")} className="h-9 text-sm" />
            {q && hits.filter((h) => h.categoryId === categoryId).length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg">
                {hits.filter((h) => h.categoryId === categoryId).slice(0, 8).map((h) => (
                  <li key={h.id}>
                    <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-accent" onClick={() => { setAttached(h); setQ(""); }}>
                      <Poster src={h.posterUrl} alt={h.title} size="xs" className="h-8 w-6" /> <span className="truncate">{h.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.back()}>{tc("cancel")}</Button>
        <Button
          disabled={pending || title.trim().length < 2 || body.trim().length < 5}
          onClick={() =>
            start(async () => {
              const res = await createPost({ categorySlug, title, body, tag, contentId: attached?.id ?? null });
              if (!res.ok) {
                toast.error(res.code === "GUEST" ? tc("guestCannotPost") : res.code === "RATE_LIMITED" ? tc("rateLimited") : res.code === "UNAUTHENTICATED" ? tc("loginRequired") : tc("error"));
                return;
              }
              toast.success(t("posted"));
              router.push(`/community/${categorySlug}/${res.data!.id}`);
            })
          }
        >
          {tc("submit")}
        </Button>
      </div>
    </div>
  );
}
