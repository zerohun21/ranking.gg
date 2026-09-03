import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, contents, posts, profiles } from "@/lib/db/schema";

export type PostTag = "free" | "debate" | "question" | "recommend";
export type PostListRow = { id: number; title: string; tag: PostTag; likeCount: number; dislikeCount: number; commentCount: number; viewCount: number; isPinned: boolean; createdAt: Date; nickname: string; avatarUrl: string | null; contentTitle: string | null; contentSlug: string | null; contentPoster: string | null; categorySlug: string; categoryIcon: string };

const listSelect = {
  id: posts.id, title: posts.title, tag: posts.tag, likeCount: posts.likeCount, dislikeCount: posts.dislikeCount, commentCount: posts.commentCount, viewCount: posts.viewCount, isPinned: posts.isPinned, createdAt: posts.createdAt,
  nickname: profiles.nickname, avatarUrl: profiles.avatarUrl, contentTitle: contents.title, contentSlug: contents.slug, contentPoster: contents.posterUrl, categorySlug: categories.slug, categoryIcon: categories.icon,
};

export async function getPosts(opts: { categoryId?: number; tag?: PostTag; sort?: "newest" | "popular"; page?: number; perPage?: number }): Promise<{ rows: PostListRow[]; total: number; pinned: PostListRow[] }> {
  const perPage = opts.perPage ?? 20;
  const page = Math.max(1, opts.page ?? 1);
  const where = and(eq(posts.isHidden, false), opts.categoryId ? eq(posts.categoryId, opts.categoryId) : undefined, opts.tag ? eq(posts.tag, opts.tag) : undefined);
  const base = () => db.select(listSelect).from(posts).innerJoin(profiles, eq(profiles.id, posts.userId)).innerJoin(categories, eq(categories.id, posts.categoryId)).leftJoin(contents, eq(contents.id, posts.contentId));
  const [rows, [{ n }], pinned] = await Promise.all([
    base().where(where).orderBy(...(opts.sort === "popular" ? [desc(sql`${posts.likeCount} - ${posts.dislikeCount} + ${posts.commentCount}`), desc(posts.createdAt)] : [desc(posts.createdAt)])).limit(perPage).offset((page - 1) * perPage),
    db.select({ n: sql<number>`count(*)::int` }).from(posts).where(where),
    page === 1 ? base().where(and(eq(posts.isHidden, false), opts.categoryId ? eq(posts.categoryId, opts.categoryId) : undefined)).orderBy(desc(sql`${posts.likeCount} - ${posts.dislikeCount} + ${posts.commentCount} * 2`), desc(posts.createdAt)).limit(3) : Promise.resolve([]),
  ]);
  return { rows: rows as PostListRow[], total: n, pinned: pinned as PostListRow[] };
}

export async function getPost(id: number, viewerId?: string) {
  const rows = await db
    .select({ post: posts, nickname: profiles.nickname, avatarUrl: profiles.avatarUrl, categorySlug: categories.slug, categoryName: categories.nameKo, categoryIcon: categories.icon, contentTitle: contents.title, contentSlug: contents.slug, contentPoster: contents.posterUrl, myReaction: viewerId ? sql<"like" | "dislike" | null>`(select kind from reactions x where x.user_id = ${viewerId} and x.target_type = 'post' and x.target_id = ${posts.id})` : sql<null>`null` })
    .from(posts)
    .innerJoin(profiles, eq(profiles.id, posts.userId))
    .innerJoin(categories, eq(categories.id, posts.categoryId))
    .leftJoin(contents, eq(contents.id, posts.contentId))
    .where(eq(posts.id, id))
    .limit(1);
  return rows[0] ?? null;
}
