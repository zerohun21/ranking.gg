"use server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { comments, posts, reactions, reviews } from "@/lib/db/schema";
import { withUser, type ActionResult } from "@/lib/action-utils";

const schema = z.object({ targetType: z.enum(["review", "comment", "post"]), targetId: z.number().int().positive(), kind: z.enum(["like", "dislike"]) });
export type ReactionResult = { likeCount: number; dislikeCount: number; mine: "like" | "dislike" | null };

/** 토글: 같은 kind 재클릭 → 해제, 다른 kind → 교체 */
export async function toggleReaction(input: z.input<typeof schema>): Promise<ActionResult<ReactionResult>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", code: "INVALID" };
  return withUser(async (u) => {
    const { targetType, targetId, kind } = parsed.data;
    const [cur] = await db.select({ kind: reactions.kind }).from(reactions).where(and(eq(reactions.userId, u.id), eq(reactions.targetType, targetType), eq(reactions.targetId, targetId))).limit(1);
    let mine: "like" | "dislike" | null = kind;
    if (cur?.kind === kind) {
      await db.delete(reactions).where(and(eq(reactions.userId, u.id), eq(reactions.targetType, targetType), eq(reactions.targetId, targetId)));
      mine = null;
    } else if (cur) {
      await db.update(reactions).set({ kind }).where(and(eq(reactions.userId, u.id), eq(reactions.targetType, targetType), eq(reactions.targetId, targetId)));
    } else {
      await db.insert(reactions).values({ userId: u.id, targetType, targetId, kind });
    }
    const table = targetType === "review" ? reviews : targetType === "comment" ? comments : posts;
    const [row] = await db.select({ likeCount: table.likeCount, dislikeCount: table.dislikeCount }).from(table).where(eq(table.id, targetId));
    return { ok: true, data: { likeCount: row?.likeCount ?? 0, dislikeCount: row?.dislikeCount ?? 0, mine } };
  });
}
