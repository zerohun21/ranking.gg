"use server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { comments } from "@/lib/db/schema";
import { rateLimit, withUser, type ActionResult } from "@/lib/action-utils";
import { maskProfanity } from "@/lib/moderation/profanity";

const schema = z.object({ targetType: z.enum(["content", "review", "post", "battle"]), targetId: z.number().int().positive(), parentId: z.number().int().positive().nullable().optional(), body: z.string().trim().min(1).max(1000) });

export type NewCommentResult = { id: number; body: string; createdAt: string; nickname: string; avatarUrl: string | null; userId: string; parentId: number | null };

export async function createComment(input: z.input<typeof schema>): Promise<ActionResult<NewCommentResult>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", code: "INVALID" };
  return withUser(async (u) => {
    if (!(await rateLimit("comments", u.id, 10, 60))) return { ok: false, error: "rateLimited", code: "RATE_LIMITED" };
    const { targetType, targetId, parentId, body } = parsed.data;
    if (parentId) {
      const [p] = await db.select({ id: comments.id, targetType: comments.targetType, targetId: comments.targetId }).from(comments).where(eq(comments.id, parentId)).limit(1);
      if (!p || p.targetType !== targetType || p.targetId !== targetId) return { ok: false, error: "invalid", code: "INVALID" };
    }
    const masked = maskProfanity(body);
    const [row] = await db.insert(comments).values({ targetType, targetId, parentId: parentId ?? null, userId: u.id, body: masked }).returning({ id: comments.id, createdAt: comments.createdAt });
    return { ok: true, data: { id: row.id, body: masked, createdAt: row.createdAt.toISOString(), nickname: u.profile.nickname, avatarUrl: u.profile.avatarUrl, userId: u.id, parentId: parentId ?? null } };
  });
}

export async function deleteComment(commentId: number): Promise<ActionResult> {
  return withUser(async (u) => {
    const cond = u.profile.isAdmin ? eq(comments.id, commentId) : and(eq(comments.id, commentId), eq(comments.userId, u.id));
    const r = await db.delete(comments).where(cond).returning({ id: comments.id });
    if (!r.length) return { ok: false, error: "forbidden", code: "FORBIDDEN" };
    return { ok: true };
  });
}
