/** 랭킹 전체 재계산: refresh_all_content_stats + recompute_category (모든 카테고리). --snapshot 이면 주간 스냅샷도 */
import "@/scripts/env";
import { sql } from "drizzle-orm";
import { createDirectDb } from "@/lib/db/direct";

async function main() {
  const snapshot = process.argv.includes("--snapshot");
  const { db, close } = createDirectDb(1);
  const t = Date.now();
  const cats = (await db.execute<{ id: number; slug: string }>(sql`select id, slug from categories order by id`));
  for (const c of cats) {
    const t1 = Date.now();
    await db.execute(sql`select refresh_all_content_stats(${c.id})`);
    await db.execute(sql`select recompute_category(${c.id})`);
    console.log(`✓ ${c.slug} (${Date.now() - t1}ms)`);
  }
  if (snapshot) {
    const r = await db.execute<{ n: number }>(sql`select take_snapshot() as n`);
    console.log(`✓ snapshot rows: ${r[0]?.n}`);
  }
  const stats = await db.execute<{ slug: string; items: number; ranked: number; ratings: number; s: number }>(sql`
    select c.slug, count(s.*) items, count(s.rank) ranked, coalesce(sum(s.rating_count),0) ratings, count(*) filter (where s.tier='S') s
    from categories c left join content_stats s on s.category_id=c.id group by c.id, c.slug order by c.id`);
  console.table(stats);
  console.log(`done in ${((Date.now() - t) / 1000).toFixed(1)}s`);
  await close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
