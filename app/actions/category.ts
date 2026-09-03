"use server";
import { and, eq, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { categories, contents } from "@/lib/db/schema";
import { withUser, type ActionResult } from "@/lib/action-utils";
import { maskProfanity } from "@/lib/moderation/profanity";
import { createServiceClient } from "@/lib/supabase/server";

const catSchema = z.object({ name: z.string().trim().min(2).max(30), slug: z.string().trim().min(2).max(40).regex(/^[a-z0-9-]+$/), description: z.string().trim().max(200).optional(), icon: z.string().trim().min(1).max(4), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) });

export async function createCategory(input: z.input<typeof catSchema>): Promise<ActionResult<{ slug: string }>> {
  const parsed = catSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", code: "INVALID" };
  return withUser(async (u) => {
    if (u.profile.isGuest) return { ok: false, error: "guestCannotPost", code: "GUEST" };
    const mine = await db.select({ n: sql<number>`count(*)::int` }).from(categories).where(eq(categories.createdBy, u.id));
    if ((mine[0]?.n ?? 0) >= 10 && !u.profile.isAdmin) return { ok: false, error: "rateLimited", code: "RATE_LIMITED" };
    const dup = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, parsed.data.slug)).limit(1);
    if (dup[0]) return { ok: false, error: "slugTaken", code: "INVALID" };
    const { name, slug, description, icon, color } = parsed.data;
    await db.insert(categories).values({ slug, nameKo: maskProfanity(name), nameEn: maskProfanity(name), description: description ? maskProfanity(description) : null, icon, color, isOfficial: false, isApproved: true, createdBy: u.id, sortOrder: 900 });
    await db.execute(sql`update profiles set badges = badges || '["category_creator"]'::jsonb where id = ${u.id} and not badges ? 'category_creator'`);
    revalidateTag("categories");
    return { ok: true, data: { slug } };
  });
}

const itemSchema = z.object({ categorySlug: z.string(), title: z.string().trim().min(1).max(100), description: z.string().trim().max(500).optional(), imageUrl: z.string().url().max(600).optional().or(z.literal("")), link: z.string().url().max(600).optional().or(z.literal("")) });

async function ownedCategory(userId: string, slug: string, isAdmin: boolean) {
  const [cat] = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
  if (!cat || cat.isOfficial) return null;
  if (cat.createdBy !== userId && !isAdmin) return null;
  return cat;
}

export async function addCategoryItem(input: z.input<typeof itemSchema>): Promise<ActionResult<{ id: number }>> {
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", code: "INVALID" };
  return withUser(async (u) => {
    const cat = await ownedCategory(u.id, parsed.data.categorySlug, u.profile.isAdmin);
    if (!cat) return { ok: false, error: "forbidden", code: "FORBIDDEN" };
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(contents).where(eq(contents.categoryId, cat.id));
    if (n >= 500) return { ok: false, error: "rateLimited", code: "RATE_LIMITED" };
    const base = parsed.data.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 60) || "item";
    const externalId = `${cat.slug}-${Date.now()}`;
    const [row] = await db
      .insert(contents)
      .values({ categoryId: cat.id, slug: `${base}-${n + 1}`, title: maskProfanity(parsed.data.title), description: parsed.data.description ? maskProfanity(parsed.data.description) : null, posterUrl: parsed.data.imageUrl || null, externalUrl: parsed.data.link || null, externalSource: "user", externalId, createdBy: u.id, metadata: { kind: "user" } })
      .returning({ id: contents.id });
    await db.execute(sql`select recompute_category(${cat.id})`);
    revalidateTag(`ranking-${cat.id}`);
    revalidateTag("categories");
    return { ok: true, data: { id: row.id } };
  });
}

export async function deleteCategoryItem(input: { categorySlug: string; contentId: number }): Promise<ActionResult> {
  return withUser(async (u) => {
    const cat = await ownedCategory(u.id, input.categorySlug, u.profile.isAdmin);
    if (!cat) return { ok: false, error: "forbidden", code: "FORBIDDEN" };
    await db.delete(contents).where(and(eq(contents.id, input.contentId), eq(contents.categoryId, cat.id)));
    await db.execute(sql`select recompute_category(${cat.id})`);
    revalidateTag(`ranking-${cat.id}`);
    return { ok: true };
  });
}

/** 이미지 업로드 → Storage thumbs/user/… (service role). 반환: public URL */
export async function uploadItemImage(formData: FormData): Promise<ActionResult<{ url: string }>> {
  return withUser(async (u) => {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size > 3 * 1024 * 1024 || !file.type.startsWith("image/")) return { ok: false, error: "invalid", code: "INVALID" };
    const sb = createServiceClient();
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const key = `user/${u.id}/${Date.now()}.${ext}`;
    const { error } = await sb.storage.from("thumbs").upload(key, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (error) return { ok: false, error: "error" };
    return { ok: true, data: { url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/thumbs/${key}` } };
  });
}
