import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string; code?: "UNAUTHENTICATED" | "FORBIDDEN" | "RATE_LIMITED" | "GUEST" | "INVALID" | "NOT_FOUND" };

export async function withUser<T>(fn: (u: CurrentUser & { profile: NonNullable<CurrentUser["profile"]> }) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  const u = await getCurrentUser();
  if (!u || !u.profile) return { ok: false, error: "loginRequired", code: "UNAUTHENTICATED" };
  try {
    return await fn(u as CurrentUser & { profile: NonNullable<CurrentUser["profile"]> });
  } catch (e) {
    console.error("[action]", e);
    return { ok: false, error: "error" };
  }
}

/** Postgres 카운트 기반 rate limit. table 의 user_id/created_at 로 window 내 건수 확인 */
export async function rateLimit(table: "ratings" | "comments" | "posts" | "reviews" | "battle_votes" | "reports", userId: string, max: number, windowSeconds: number): Promise<boolean> {
  const [r] = await db.execute<{ n: number }>(sql`select count(*)::int n from ${sql.identifier(table)} where ${sql.identifier(table === "reports" ? "reporter_id" : "user_id")} = ${userId} and ${sql.identifier(table === "ratings" ? "updated_at" : "created_at")} > now() - (${windowSeconds} * interval '1 second')`);
  return (r?.n ?? 0) < max;
}

export function revalidateContentTags(categoryId: number) {
  return [`ranking-${categoryId}`, "ranking"];
}
