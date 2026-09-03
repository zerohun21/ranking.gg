import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Pin, MessageSquare, ThumbsUp, Eye } from "lucide-react";
import type { PostListRow } from "@/lib/db/queries/posts";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const TAG_CLS: Record<string, string> = { free: "bg-muted text-muted-foreground", debate: "bg-lose/15 text-lose", question: "bg-tier-b/15 text-tier-b", recommend: "bg-tier-c/15 text-tier-c" };

export async function PostList({ rows, pinned }: { rows: PostListRow[]; pinned: PostListRow[] }) {
  const t = await getTranslations("community");
  const locale = await getLocale();
  const tagLabel = (tag: string) => t(`tag${tag[0].toUpperCase()}${tag.slice(1)}` as "tagFree");
  const Row = ({ p, pin }: { p: PostListRow; pin?: boolean }) => (
    <li className={cn(pin && "bg-primary/5")}>
      <Link href={`/community/${p.categorySlug}/${p.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/60">
        <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold", TAG_CLS[p.tag])}>{tagLabel(p.tag)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            {pin && <Pin className="h-3 w-3 text-primary" />}
            <span className="truncate">{p.title}</span>
            {p.commentCount > 0 && <span className="text-xs font-bold text-primary tabular">[{p.commentCount}]</span>}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>{p.categoryIcon}</span>
            <span className="font-semibold text-foreground/80">{p.nickname}</span>
            <span suppressHydrationWarning>{relativeTime(p.createdAt, locale)}</span>
            {p.contentTitle && <span className="truncate rounded bg-muted px-1">🎞 {p.contentTitle}</span>}
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-3 text-[11px] text-muted-foreground tabular sm:flex">
          <span className="inline-flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{p.likeCount}</span>
          <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" />{p.commentCount}</span>
          <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{p.viewCount}</span>
        </div>
      </Link>
    </li>
  );
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
      {pinned.map((p) => <Row key={`pin-${p.id}`} p={p} pin />)}
      {rows.filter((r) => !pinned.some((p) => p.id === r.id)).map((p) => <Row key={p.id} p={p} />)}
      {rows.length === 0 && <li className="p-10 text-center text-sm text-muted-foreground">{t("noPosts")}</li>}
    </ul>
  );
}
