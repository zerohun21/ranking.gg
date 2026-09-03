"use server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { withUser, type ActionResult } from "@/lib/action-utils";
import { maskProfanity } from "@/lib/moderation/profanity";

const schema = z.object({ nickname: z.string().trim().min(2).max(20).regex(/^[\p{L}\p{N}_ ]+$/u), bio: z.string().trim().max(200).optional(), avatarUrl: z.string().url().max(500).optional().or(z.literal("")) });

export async function updateProfile(input: z.input<typeof schema>): Promise<ActionResult<{ nickname: string }>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", code: "INVALID" };
  return withUser(async (u) => {
    const nickname = maskProfanity(parsed.data.nickname);
    const taken = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.nickname, nickname)).limit(1);
    if (taken[0] && taken[0].id !== u.id) return { ok: false, error: "nicknameTaken", code: "INVALID" };
    await db.update(profiles).set({ nickname, bio: parsed.data.bio ? maskProfanity(parsed.data.bio) : null, avatarUrl: parsed.data.avatarUrl || u.profile.avatarUrl }).where(eq(profiles.id, u.id));
    return { ok: true, data: { nickname } };
  });
}
