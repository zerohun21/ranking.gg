"use server";
import { and, eq } from "drizzle-orm";
import { revalidateTag, revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { contents, contentStats, ratings } from "@/lib/db/schema";
import { rateLimit, withUser, type ActionResult } from "@/lib/action-utils";

const schema = z.object({ contentId: z.number().int().positive(), score: z.number().min(0.5).max(5).refine((v) => Math.round(v * 2) === v * 2, "0.5 단위") });

export type RateResult = { score: number | null; rank: number | null; prevRank: number | null; tier: string | null; bayesianScore: string; ratingCount: number; ratingAvg: string };

export async function rateContent(input: { contentId: number; score: number }): Promise<ActionResult<RateResult>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", code: "INVALID" };
  return withUser(async (u) => {
    if (!(await rateLimit("ratings", u.id, 60, 60))) return { ok: false, error: "rateLimited", code: "RATE_LIMITED" };
    const { contentId, score } = parsed.data;
    const [c] = await db.select({ id: contents.id, categoryId: contents.categoryId, slug: contents.slug }).from(contents).where(eq(contents.id, contentId)).limit(1);
    if (!c) return { ok: false, error: "notFound", code: "NOT_FOUND" };
    const [before] = await db.select({ rank: contentStats.rank }).from(contentStats).where(eq(contentStats.contentId, contentId));
    await db
      .insert(ratings)
      .values({ contentId, userId: u.id, score: score.toFixed(1) })
      .onConflictDoUpdate({ target: [ratings.contentId, ratings.userId], set: { score: score.toFixed(1), updatedAt: new Date() } });
    const [after] = await db.select({ rank: contentStats.rank, tier: contentStats.tier, bayesianScore: contentStats.bayesianScore, ratingCount: contentStats.ratingCount, ratingAvg: contentStats.ratingAvg }).from(contentStats).where(eq(contentStats.contentId, contentId));
    revalidateTag(`ranking-${c.categoryId}`);
    revalidateTag("ranking");
    return { ok: true, data: { score, rank: after?.rank ?? null, prevRank: before?.rank ?? null, tier: after?.tier ?? null, bayesianScore: after?.bayesianScore ?? "0", ratingCount: after?.ratingCount ?? 0, ratingAvg: after?.ratingAvg ?? "0" } };
  });
}

export async function deleteRating(contentId: number): Promise<ActionResult<RateResult>> {
  return withUser(async (u) => {
    const [c] = await db.select({ categoryId: contents.categoryId }).from(contents).where(eq(contents.id, contentId)).limit(1);
    if (!c) return { ok: false, error: "notFound", code: "NOT_FOUND" };
    const [before] = await db.select({ rank: contentStats.rank }).from(contentStats).where(eq(contentStats.contentId, contentId));
    await db.delete(ratings).where(and(eq(ratings.contentId, contentId), eq(ratings.userId, u.id)));
    const [after] = await db.select({ rank: contentStats.rank, tier: contentStats.tier, bayesianScore: contentStats.bayesianScore, ratingCount: contentStats.ratingCount, ratingAvg: contentStats.ratingAvg }).from(contentStats).where(eq(contentStats.contentId, contentId));
    revalidateTag(`ranking-${c.categoryId}`);
    revalidatePath("/", "layout");
    return { ok: true, data: { score: null, rank: after?.rank ?? null, prevRank: before?.rank ?? null, tier: after?.tier ?? null, bayesianScore: after?.bayesianScore ?? "0", ratingCount: after?.ratingCount ?? 0, ratingAvg: after?.ratingAvg ?? "0" } };
  });
}
