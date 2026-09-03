import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { getOfficialCategories } from "@/lib/db/queries/categories";
import { getPosts, type PostTag } from "@/lib/db/queries/posts";
import { PostList } from "@/components/community/post-list";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "커뮤니티" };

export default async function CommunityIndex({ searchParams }: { searchParams: Promise<{ tag?: string; sort?: string; page?: string }> }) {
  const sp = await searchParams;
  const t = await getTranslations("community");
  const locale = await getLocale();
  const cats = await getOfficialCategories();
  const page = Math.max(1, Number(sp.page ?? 1));
  const { rows, total, pinned } = await getPosts({ tag: sp.tag as PostTag | undefined, sort: sp.sort === "popular" ? "popular" : "newest", page });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">💬 {t("allBoards")}</h1>
      <div className="scrollbar-none flex gap-1 overflow-x-auto">
        {cats.map((c) => (
          <Link key={c.slug} href={`/community/${c.slug}`} className="shrink-0 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold hover:border-primary">
            {c.icon} {locale === "en" ? c.nameEn : c.nameKo}
          </Link>
        ))}
      </div>
      <Toolbar base="/community" tag={sp.tag} sort={sp.sort} />
      <PostList rows={rows} pinned={pinned} />
      <Pager base="/community" page={page} total={total} extra={{ tag: sp.tag, sort: sp.sort }} />
    </div>
  );
}

export async function Toolbar({ base, tag, sort, writeHref }: { base: string; tag?: string; sort?: string; writeHref?: string }) {
  const t = await getTranslations("community");
  const link = (params: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged = { tag, sort, ...params };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    const s = q.toString();
    return `${base}${s ? `?${s}` : ""}`;
  };
  return (
    <div className="flex flex-wrap items-center gap-1">
      {[["", t("allBoards")], ["free", t("tagFree")], ["debate", t("tagDebate")], ["question", t("tagQuestion")], ["recommend", t("tagRecommend")]].map(([k, label]) => (
        <Link key={k} href={link({ tag: k || undefined })} className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", (tag ?? "") === k ? "bg-primary text-white" : "bg-card border border-border hover:border-primary")}>
          {label}
        </Link>
      ))}
      <span className="mx-1 text-muted-foreground">|</span>
      {[["", t("sortNewest")], ["popular", t("sortPopular")]].map(([k, label]) => (
        <Link key={k} href={link({ sort: k || undefined })} className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", (sort ?? "") === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
          {label}
        </Link>
      ))}
      {writeHref && (
        <Link href={writeHref} className="ml-auto rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary/90">
          ✏️ {t("write")}
        </Link>
      )}
    </div>
  );
}

export function Pager({ base, page, total, perPage = 20, extra = {} }: { base: string; page: number; total: number; perPage?: number; extra?: Record<string, string | undefined> }) {
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) return null;
  const link = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v);
    q.set("page", String(p));
    return `${base}?${q}`;
  };
  return (
    <div className="flex items-center justify-center gap-1 text-xs">
      {page > 1 && <Link href={link(page - 1)} className="rounded border border-border px-2 py-1">‹</Link>}
      {Array.from({ length: Math.min(7, pages) }, (_, i) => Math.max(1, Math.min(page - 3, pages - 6)) + i).map((n) => (
        <Link key={n} href={link(n)} className={cn("rounded border px-2 py-1 tabular", n === page ? "border-primary bg-primary text-white" : "border-border")}>{n}</Link>
      ))}
      {page < pages && <Link href={link(page + 1)} className="rounded border border-border px-2 py-1">›</Link>}
    </div>
  );
}
