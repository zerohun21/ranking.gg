import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const contentId = Number(body?.contentId);
  if (!Number.isInteger(contentId) || contentId <= 0) return NextResponse.json({ ok: false }, { status: 400 });
  let sid = req.cookies.get("rgg_sid")?.value;
  const res = NextResponse.json({ ok: true });
  if (!sid) {
    sid = crypto.randomUUID();
    res.cookies.set("rgg_sid", sid, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true });
  }
  try {
    await db.execute(sql`select increment_view(${contentId}, ${sid})`);
  } catch {}
  return res;
}
