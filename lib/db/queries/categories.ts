import { unstable_cache } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, type Category } from "@/lib/db/schema";
import { OFFICIAL_CATEGORIES } from "@/lib/constants/categories";

export const getOfficialCategories = unstable_cache(
  async (): Promise<Category[]> => {
    if (!process.env.DATABASE_URL) return [];
    try {
      return await db.select().from(categories).where(eq(categories.isOfficial, true)).orderBy(asc(categories.sortOrder));
    } catch {
      return [];
    }
  },
  ["official-categories"],
  { revalidate: 300, tags: ["categories"] },
);

export const getUserCategories = unstable_cache(
  async (): Promise<Category[]> => {
    if (!process.env.DATABASE_URL) return [];
    try {
      return await db.select().from(categories).where(eq(categories.isOfficial, false)).orderBy(asc(categories.createdAt));
    } catch {
      return [];
    }
  },
  ["user-categories"],
  { revalidate: 60, tags: ["categories"] },
);

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const rows = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
  return rows[0] ?? null;
}

/** DB 가 비어 있을 때 네비를 그리기 위한 폴백 */
export function fallbackOfficialCategories(): Pick<Category, "slug" | "nameKo" | "nameEn" | "icon" | "color">[] {
  return OFFICIAL_CATEGORIES.map((c) => ({ slug: c.slug, nameKo: c.nameKo, nameEn: c.nameEn, icon: c.icon, color: c.color }));
}
