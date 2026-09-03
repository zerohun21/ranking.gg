import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, profiles } from "@/lib/db/schema";
import { CategoryApproveToggle } from "@/components/admin/admin-controls";

export default async function AdminCategories() {
  const rows = await db.select({ c: categories, creator: profiles.nickname }).from(categories).leftJoin(profiles, eq(profiles.id, categories.createdBy)).where(eq(categories.isOfficial, false)).orderBy(desc(categories.createdAt));
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
      {rows.map(({ c, creator }) => (
        <li key={c.id} className="flex items-center gap-3 p-3 text-sm">
          <span className="text-xl">{c.icon}</span>
          <div className="min-w-0 flex-1">
            <Link href={`/ranking/${c.slug}`} className="font-semibold hover:underline">{c.nameKo}</Link>
            <div className="text-xs text-muted-foreground">/{c.slug} · {creator ?? "?"} · {c.itemCount} items · {c.isApproved ? "approved" : "hidden"}</div>
          </div>
          <CategoryApproveToggle categoryId={c.id} approved={c.isApproved} />
        </li>
      ))}
    </ul>
  );
}
