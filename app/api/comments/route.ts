import { NextResponse, type NextRequest } from "next/server";
import { getComments } from "@/lib/db/queries/content";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const targetType = sp.get("targetType") as "content" | "review" | "post" | "battle" | null;
  const targetId = Number(sp.get("targetId"));
  if (!targetType || !targetId) return NextResponse.json([], { status: 400 });
  const user = await getCurrentUser();
  const rows = await getComments(targetType, targetId, user?.id);
  return NextResponse.json(rows);
}
