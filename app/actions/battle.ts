"use server";
import { and, eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { battles, battleVotes, contents } from "@/lib/db/schema";
import { rateLimit, withUser, type ActionResult } from "@/lib/action-utils";

export type VoteResult = { votesA: number; votesB: number; choice: "a" | "b" };

export async function voteBattle(input: { battleId: number; choice: "a" | "b" }): Promise<ActionResult<VoteResult>> {
  const parsed = z.object({ battleId: z.number().int().positive(), choice: z.enum(["a", "b"]) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", code: "INVALID" };
  return withUser(async (u) => {
    if (!(await rateLimit("battle_votes", u.id, 120, 60))) return { ok: false, error: "rateLimited", code: "RATE_LIMITED" };
    const { battleId, choice } = parsed.data;
    const existing = await db.select({ id: battleVotes.id, choice: battleVotes.choice }).from(battleVotes).where(and(eq(battleVotes.battleId, battleId), eq(battleVotes.userId, u.id))).limit(1);
    if (existing[0]) {
      const [b] = await db.select({ votesA: battles.votesA, votesB: battles.votesB }).from(battles).where(eq(battles.id, battleId));
      return { ok: true, data: { votesA: b.votesA, votesB: b.votesB, choice: existing[0].choice } };
    }
    await db.insert(battleVotes).values({ battleId, userId: u.id, choice }).onConflictDoNothing();
    const [b] = await db.select({ votesA: battles.votesA, votesB: battles.votesB, categoryId: battles.categoryId }).from(battles).where(eq(battles.id, battleId));
    if (b) revalidateTag(`ranking-${b.categoryId}`);
    return { ok: true, data: { votesA: b?.votesA ?? 0, votesB: b?.votesB ?? 0, choice } };
  });
}

export async function createBattle(input: { contentAId: number; contentBId: number }): Promise<ActionResult<{ id: number }>> {
  const parsed = z.object({ contentAId: z.number().int().positive(), contentBId: z.number().int().positive() }).refine((v) => v.contentAId !== v.contentBId).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", code: "INVALID" };
  return withUser(async (u) => {
    const rows = await db.select({ id: contents.id, categoryId: contents.categoryId }).from(contents).where(eq(contents.isApproved, true));
    const a = rows.find((r) => r.id === parsed.data.contentAId);
    const b = rows.find((r) => r.id === parsed.data.contentBId);
    if (!a || !b) return { ok: false, error: "notFound", code: "NOT_FOUND" };
    if (a.categoryId !== b.categoryId) return { ok: false, error: "invalid", code: "INVALID" };
    const dup = await db
      .select({ id: battles.id })
      .from(battles)
      .where(and(eq(battles.contentAId, Math.min(a.id, b.id)), eq(battles.contentBId, Math.max(a.id, b.id))))
      .limit(1);
    if (dup[0]) return { ok: true, data: { id: dup[0].id } };
    const [created] = await db.insert(battles).values({ categoryId: a.categoryId, contentAId: Math.min(a.id, b.id), contentBId: Math.max(a.id, b.id), createdBy: u.id }).returning({ id: battles.id });
    return { ok: true, data: { id: created.id } };
  });
}
