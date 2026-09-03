import { getTranslations } from "next-intl/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { RecomputeButtons } from "@/components/admin/admin-controls";

export default async function AdminDashboard() {
  const t = await getTranslations("admin");
  const [s] = await db.execute<Record<string, number>>(sql`
    select (select count(*)::int from contents) contents, (select count(*)::int from profiles) users, (select count(*)::int from profiles where not is_seed) real_users,
           (select count(*)::int from ratings) ratings, (select count(*)::int from reviews) reviews, (select count(*)::int from comments) comments,
           (select count(*)::int from reports where status = 'open') open_reports, (select count(*)::int from battles) battles, (select count(*)::int from posts) posts`);
  const cats = await db.execute<{ slug: string; items: number; ranked: number; ratings: number; s: number; a: number }>(sql`
    select c.slug, count(s.*)::int items, count(s.rank)::int ranked, coalesce(sum(s.rating_count),0)::int ratings, count(*) filter (where s.tier='S')::int s, count(*) filter (where s.tier='A')::int a
    from categories c left join content_stats s on s.category_id = c.id group by c.id order by c.sort_order, c.id`);
  const cards = [
    [t("contents"), s.contents], [t("users"), `${s.real_users} / ${s.users}`], ["Ratings", s.ratings], ["Reviews", s.reviews], ["Comments", s.comments], ["Battles", s.battles], ["Posts", s.posts], [t("openReports"), s.open_reports],
  ];
  return (
    <div className="space-y-4">
      <RecomputeButtons />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cards.map(([k, v]) => (
          <div key={String(k)} className="rounded-lg border border-border bg-card p-3">
            <div className="text-[11px] text-muted-foreground">{k}</div>
            <div className="text-xl font-extrabold tabular">{typeof v === "number" ? v.toLocaleString() : v}</div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className="p-2 text-left">category</th><th className="p-2 text-right">items</th><th className="p-2 text-right">ranked</th><th className="p-2 text-right">ratings</th><th className="p-2 text-right">S</th><th className="p-2 text-right">A</th></tr></thead>
          <tbody>
            {cats.map((c) => (
              <tr key={c.slug} className="border-t border-border tabular"><td className="p-2 font-semibold">{c.slug}</td><td className="p-2 text-right">{c.items}</td><td className="p-2 text-right">{c.ranked}</td><td className="p-2 text-right">{c.ratings.toLocaleString()}</td><td className="p-2 text-right">{c.s}</td><td className="p-2 text-right">{c.a}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
