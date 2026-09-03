import { NextResponse, type NextRequest } from "next/server";
import { searchContents } from "@/lib/db/queries/search";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json([]);
  const rows = await searchContents(q, { perCategory: 5, limit: 25 });
  return NextResponse.json(rows, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } });
}
