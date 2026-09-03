"use server";
import { eq, sql } from "drizzle-orm";
import { revalidateTag, revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { categories, comments, contents, posts, reports, reviews } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import type { ActionResult } from "@/lib/action-utils";

async function guard<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    await requireAdmin();
    return await fn();
  } catch (e) {
    const msg = (e as Error).message;
    return { ok: false, error: msg === "FORBIDDEN" ? "forbidden" : msg === "UNAUTHENTICATED" ? "loginRequired" : "error", code: msg === "FORBIDDEN" ? "FORBIDDEN" : "UNAUTHENTICATED" };
  }
}

export async function adminRecompute(): Promise<ActionResult<{ n: number }>> {
  return guard(async () => {
    const cats = await db.execute<{ id: number }>(sql`select id from categories`);
    for (const c of cats) {
      await db.execute(sql`select refresh_all_content_stats(${c.id})`);
      await db.execute(sql`select recompute_category(${c.id})`);
      revalidateTag(`ranking-${c.id}`);
    }
    revalidateTag("ranking");
    return { ok: true, data: { n: cats.length } };
  });
}

export async function adminSnapshot(): Promise<ActionResult<{ n: number }>> {
  return guard(async () => {
    const r = await db.execute<{ n: number }>(sql`select take_snapshot() as n`);
    const cats = await db.execute<{ id: number }>(sql`select id from categories`);
    for (const c of cats) await db.execute(sql`select recompute_category(${c.id})`);
    revalidateTag("ranking");
    return { ok: true, data: { n: r[0]?.n ?? 0 } };
  });
}

const target = z.object({ targetType: z.enum(["review", "comment", "post", "content"]), targetId: z.number().int().positive(), hidden: z.boolean() });
export async function adminSetHidden(input: z.input<typeof target>): Promise<ActionResult> {
  const p = target.safeParse(input);
  if (!p.success) return { ok: false, error: "invalid", code: "INVALID" };
  return guard(async () => {
    const { targetType, targetId, hidden } = p.data;
    if (targetType === "review") await db.update(reviews).set({ isHidden: hidden }).where(eq(reviews.id, targetId));
    else if (targetType === "comment") await db.update(comments).set({ isHidden: hidden }).where(eq(comments.id, targetId));
    else if (targetType === "post") await db.update(posts).set({ isHidden: hidden }).where(eq(posts.id, targetId));
    else {
      await db.update(contents).set({ isApproved: !hidden }).where(eq(contents.id, targetId));
      const [c] = await db.select({ categoryId: contents.categoryId }).from(contents).where(eq(contents.id, targetId));
      if (c) {
        await db.execute(sql`select recompute_category(${c.categoryId})`);
        revalidateTag(`ranking-${c.categoryId}`);
      }
    }
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}

export async function adminDeleteTarget(input: { targetType: "review" | "comment" | "post"; targetId: number }): Promise<ActionResult> {
  return guard(async () => {
    const { targetType, targetId } = input;
    if (targetType === "review") await db.delete(reviews).where(eq(reviews.id, targetId));
    else if (targetType === "comment") await db.delete(comments).where(eq(comments.id, targetId));
    else await db.delete(posts).where(eq(posts.id, targetId));
    await db.update(reports).set({ status: "resolved" }).where(sql`${reports.targetType} = ${targetType} and ${reports.targetId} = ${targetId}`);
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}

export async function adminResolveReport(input: { reportId: number; status: "resolved" | "dismissed" }): Promise<ActionResult> {
  return guard(async () => {
    await db.update(reports).set({ status: input.status }).where(eq(reports.id, input.reportId));
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}

export async function adminSetCategoryApproved(input: { categoryId: number; approved: boolean }): Promise<ActionResult> {
  return guard(async () => {
    await db.update(categories).set({ isApproved: input.approved }).where(eq(categories.id, input.categoryId));
    revalidateTag("categories");
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}

const contentPatch = z.object({ id: z.number().int().positive(), title: z.string().trim().min(1).max(200), description: z.string().trim().max(3000).nullable(), posterUrl: z.string().url().max(600).nullable().or(z.literal("")), isAdult: z.boolean() });
export async function adminUpdateContent(input: z.input<typeof contentPatch>): Promise<ActionResult> {
  const p = contentPatch.safeParse(input);
  if (!p.success) return { ok: false, error: "invalid", code: "INVALID" };
  return guard(async () => {
    await db.update(contents).set({ title: p.data.title, description: p.data.description, posterUrl: p.data.posterUrl || null, isAdult: p.data.isAdult }).where(eq(contents.id, p.data.id));
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}
