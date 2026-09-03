import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { ContentEditForm } from "@/components/admin/admin-controls";
import { Poster } from "@/components/content/poster";

export default async function AdminContents({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const rows = q
    ? await db.execute<{ id: number; title: string; description: string | null; poster_url: string | null; is_adult: boolean; is_approved: boolean; category: string; rank: number | null }>(sql`
        select c.id, c.title, c.description, c.poster_url, c.is_adult, c.is_approved, k.slug category, s.rank from contents c join categories k on k.id = c.category_id join content_stats s on s.content_id = c.id
        where c.title ilike ${"%" + q + "%"} or c.id::text = ${q} order by s.rating_count desc limit 20`)
    : [];
  return (
    <div className="space-y-3">
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="title or id" className="h-9 flex-1 rounded-md border border-border bg-card px-3 text-sm" />
        <button className="h-9 rounded-md bg-primary px-4 text-sm font-bold text-white">Search</button>
      </form>
      <ul className="space-y-3">
        {rows.map((c) => (
          <li key={c.id} className="flex gap-3 rounded-lg border border-border bg-card p-3">
            <Poster src={c.poster_url} alt={c.title} size="md" />
            <div className="min-w-0 flex-1">
              <div className="mb-1 text-xs text-muted-foreground">#{c.id} · {c.category} · rank {c.rank ?? "–"} · {c.is_approved ? "visible" : "hidden"}</div>
              <ContentEditForm c={{ id: c.id, title: c.title, description: c.description, posterUrl: c.poster_url, isAdult: c.is_adult, isApproved: c.is_approved }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
