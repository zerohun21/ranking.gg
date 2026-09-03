import type { MetadataRoute } from "next";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const cats = await db.execute<{ slug: string; updated_at: Date }>(sql`select slug, updated_at from categories where is_approved`);
  const top = await db.execute<{ slug: string; cat: string; updated_at: Date }>(sql`
    select c.slug, k.slug cat, c.updated_at from contents c join content_stats s on s.content_id = c.id join categories k on k.id = c.category_id
    where c.is_approved and not c.is_adult and s.rank is not null order by s.rating_count desc limit 5000`);
  return [
    { url: base, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/battle`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${base}/community`, changeFrequency: "hourly", priority: 0.6 },
    ...[...cats].map((c) => ({ url: `${base}/ranking/${c.slug}`, lastModified: c.updated_at, changeFrequency: "daily" as const, priority: 0.9 })),
    ...[...cats].map((c) => ({ url: `${base}/community/${c.slug}`, changeFrequency: "daily" as const, priority: 0.5 })),
    ...[...top].map((c) => ({ url: `${base}/c/${c.cat}/${encodeURIComponent(c.slug)}`, lastModified: c.updated_at, changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}
