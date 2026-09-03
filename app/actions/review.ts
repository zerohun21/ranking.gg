"use server";
import { and, eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { contents, ratings, reviews } from "@/lib/db/schema";
import { rateLimit, withUser, type ActionResult } from "@/lib/action-utils";
import { maskProfanity } from "@/lib/moderation/profanity";

const schema = z.object({ contentId: z.number().int().positive(), body: z.string().trim().min(10).max(2000), isSpoiler: z.boolean().default(false) });

export async function createReview(input: { contentId: number; body: string; isSpoiler: boolean }): Promise<ActionResult<{ id: number }>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", code: "INVALID" };
  return withUser(async (u) => {
    if (!(await rateLimit("reviews", u.id, 10, 3600))) return { ok: false, error: "rateLimited", code: "RATE_LIMITED" };
    const { contentId, body, isSpoiler } = parsed.data;
    const [rating] = await db.select({ id: ratings.id, score: ratings.score }).from(ratings).where(and(eq(ratings.contentId, contentId), eq(ratings.userId, u.id))).limit(1);
    if (!rating) return { ok: false, error: "reviewNeedsRating", code: "INVALID" };
    const [c] = await db.select({ categoryId: contents.categoryId }).from(contents).where(eq(contents.id, contentId)).limit(1);
    if (!c) return { ok: false, error: "notFound", code: "NOT_FOUND" };
    const [row] = await db
      .insert(reviews)
      .values({ contentId, userId: u.id, ratingId: rating.id, score: rating.score, body: maskProfanity(body), isSpoiler })
      .onConflictDoUpdate({ target: [reviews.contentId, reviews.userId], set: { body: maskProfanity(body), isSpoiler, score: rating.score, ratingId: rating.id, isHidden: false, updatedAt: new Date() } })
      .returning({ id: reviews.id });
    revalidateTag(`ranking-${c.categoryId}`);
    return { ok: true, data: { id: row.id } };
  });
}

export async function updateReview(input: { reviewId: number; body: string; isSpoiler: boolean }): Promise<ActionResult> {
  const parsed = z.object({ reviewId: z.number().int().positive(), body: z.string().trim().min(10).max(2000), isSpoiler: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", code: "INVALID" };
  return withUser(async (u) => {
    const r = await db.update(reviews).set({ body: maskProfanity(parsed.data.body), isSpoiler: parsed.data.isSpoiler }).where(and(eq(reviews.id, parsed.data.reviewId), eq(reviews.userId, u.id))).returning({ id: reviews.id });
    if (!r.length) return { ok: false, error: "forbidden", code: "FORBIDDEN" };
    return { ok: true };
  });
}

export async function deleteReview(reviewId: number): Promise<ActionResult> {
  return withUser(async (u) => {
    const cond = u.profile.isAdmin ? eq(reviews.id, reviewId) : and(eq(reviews.id, reviewId), eq(reviews.userId, u.id));
    const r = await db.delete(reviews).where(cond).returning({ id: reviews.id });
    if (!r.length) return { ok: false, error: "forbidden", code: "FORBIDDEN" };
    return { ok: true };
  });
}
