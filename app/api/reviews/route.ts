import { NextResponse, type NextRequest } from "next/server";
import { getReviews, type ReviewSort } from "@/lib/db/queries/content";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const contentId = Number(sp.get("contentId"));
  const sort = (sp.get("sort") ?? "best") as ReviewSort;
  const page = Math.max(1, Number(sp.get("page") ?? 1));
  if (!contentId) return NextResponse.json([], { status: 400 });
  const user = await getCurrentUser();
  const rows = await getReviews(contentId, sort, page, user?.id);
  return NextResponse.json(rows);
}
