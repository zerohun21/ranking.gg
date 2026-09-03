import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Eye } from "lucide-react";
import { getPost } from "@/lib/db/queries/posts";
import { getComments } from "@/lib/db/queries/content";
import { getCurrentUser } from "@/lib/auth";
import { incrementPostView } from "@/app/actions/post";
import { CommentThread } from "@/components/content/comment-thread";
import { PostActions } from "@/components/community/post-actions";
import { Poster } from "@/components/content/poster";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { renderMarkdown } from "@/lib/markdown";
import { contentHref, relativeTime } from "@/lib/format";

type Props = { params: Promise<{ category: string; postId: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getPost(Number((await params).postId));
  return p ? { title: p.post.title, description: p.post.body.slice(0, 120) } : {};
}

export default async function PostPage({ params }: Props) {
  const { postId } = await params;
  const user = await getCurrentUser();
  const p = await getPost(Number(postId), user?.id);
  if (!p || (p.post.isHidden && !user?.profile?.isAdmin)) notFound();
  const t = await getTranslations("community");
  const locale = await getLocale();
  const comments = await getComments("post", p.post.id, user?.id);
  incrementPostView(p.post.id).catch(() => {});
  const viewer = user?.profile ? { id: user.id, isAdmin: user.profile.isAdmin } : null;
  const tagLabel = t(`tag${p.post.tag[0].toUpperCase()}${p.post.tag.slice(1)}` as "tagFree");
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <article className="rounded-lg border border-border bg-card p-5">
        <div className="text-xs text-muted-foreground">
          <Link href={`/community/${p.categorySlug}`} className="font-semibold hover:underline">
            {p.categoryIcon} {p.categoryName}
          </Link>{" "}
          · {tagLabel}
        </div>
        <h1 className="mt-1 text-xl font-extrabold sm:text-2xl">{p.post.title}</h1>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Avatar className="h-6 w-6">
            <AvatarImage src={p.avatarUrl ?? undefined} alt="" />
            <AvatarFallback className="text-[10px]">{p.nickname.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <Link href={`/u/${encodeURIComponent(p.nickname)}`} className="font-semibold text-foreground hover:underline">{p.nickname}</Link>
          <span suppressHydrationWarning>{relativeTime(p.post.createdAt, locale)}</span>
          <span className="ml-auto inline-flex items-center gap-1 tabular"><Eye className="h-3 w-3" /> {p.post.viewCount}</span>
        </div>
        {p.contentTitle && p.contentSlug && (
          <Link href={contentHref(p.categorySlug, p.contentSlug)} className="mt-3 flex items-center gap-2 rounded-md border border-border bg-background p-2 hover:border-primary">
            <Poster src={p.contentPoster} alt={p.contentTitle} size="xs" />
            <span className="text-sm font-semibold">🎞 {p.contentTitle}</span>
          </Link>
        )}
        <div className="mt-4">{renderMarkdown(p.post.body)}</div>
        <PostActions postId={p.post.id} likeCount={p.post.likeCount} dislikeCount={p.post.dislikeCount} myReaction={p.myReaction ?? null} canDelete={!!viewer && (viewer.id === p.post.userId || viewer.isAdmin)} categorySlug={p.categorySlug} />
      </article>
      <CommentThread targetType="post" targetId={p.post.id} viewer={viewer} initial={comments} />
    </div>
  );
}
