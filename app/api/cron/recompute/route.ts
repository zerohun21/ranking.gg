import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Vercel Cron: 매일 1회 전체 재계산, 월요일이면 주간 스냅샷 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const t = Date.now();
  const cats = await db.execute<{ id: number; slug: string }>(sql`select id, slug from categories order by id`);
  for (const c of cats) {
    await db.execute(sql`select refresh_all_content_stats(${c.id})`);
    await db.execute(sql`select recompute_category(${c.id})`);
  }
  let snapshot: number | null = null;
  const force = req.nextUrl.searchParams.get("snapshot") === "1";
  const kstDay = new Date(Date.now() + 9 * 3600_000).getUTCDay();
  if (force || kstDay === 1) {
    const r = await db.execute<{ n: number }>(sql`select take_snapshot() as n`);
    snapshot = r[0]?.n ?? 0;
  }
  revalidateTag("ranking");
  for (const c of cats) revalidateTag(`ranking-${c.id}`);
  return NextResponse.json({ ok: true, categories: cats.length, snapshot, ms: Date.now() - t });
}
