"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { reports } from "@/lib/db/schema";
import { rateLimit, withUser, type ActionResult } from "@/lib/action-utils";

const schema = z.object({ targetType: z.enum(["review", "comment", "post", "content"]), targetId: z.number().int().positive(), reason: z.string().trim().min(1).max(300) });

export async function reportTarget(input: z.input<typeof schema>): Promise<ActionResult<{ duplicate: boolean }>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", code: "INVALID" };
  return withUser(async (u) => {
    if (!(await rateLimit("reports", u.id, 20, 3600))) return { ok: false, error: "rateLimited", code: "RATE_LIMITED" };
    const r = await db.insert(reports).values({ reporterId: u.id, ...parsed.data }).onConflictDoNothing().returning({ id: reports.id });
    return { ok: true, data: { duplicate: r.length === 0 } };
  });
}
