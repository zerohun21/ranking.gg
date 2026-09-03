"use server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { categories, posts } from "@/lib/db/schema";
import { rateLimit, withUser, type ActionResult } from "@/lib/action-utils";
import { maskProfanity } from "@/lib/moderation/profanity";

const schema = z.object({ categorySlug: z.string().min(1), title: z.string().trim().min(2).max(120), body: z.string().trim().min(5).max(10000), tag: z.enum(["free", "debate", "question", "recommend"]), contentId: z.number().int().positive().nullable().optional() });

export async function createPost(input: z.input<typeof schema>): Promise<ActionResult<{ id: number }>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", code: "INVALID" };
  return withUser(async (u) => {
    if (u.profile.isGuest) return { ok: false, error: "guestCannotPost", code: "GUEST" };
    if (!(await rateLimit("posts", u.id, 5, 3600))) return { ok: false, error: "rateLimited", code: "RATE_LIMITED" };
    const [cat] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, parsed.data.categorySlug)).limit(1);
    if (!cat) return { ok: false, error: "notFound", code: "NOT_FOUND" };
    const [row] = await db.insert(posts).values({ categoryId: cat.id, userId: u.id, title: maskProfanity(parsed.data.title), body: maskProfanity(parsed.data.body), tag: parsed.data.tag, contentId: parsed.data.contentId ?? null }).returning({ id: posts.id });
    return { ok: true, data: { id: row.id } };
  });
}

export async function deletePost(postId: number): Promise<ActionResult> {
  return withUser(async (u) => {
    const cond = u.profile.isAdmin ? eq(posts.id, postId) : and(eq(posts.id, postId), eq(posts.userId, u.id));
    const r = await db.delete(posts).where(cond).returning({ id: posts.id });
    if (!r.length) return { ok: false, error: "forbidden", code: "FORBIDDEN" };
    return { ok: true };
  });
}

export async function incrementPostView(postId: number) {
  await db.update(posts).set({ viewCount: sql`${posts.viewCount} + 1` }).where(eq(posts.id, postId));
}
