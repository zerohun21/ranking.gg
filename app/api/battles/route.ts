import { NextResponse, type NextRequest } from "next/server";
import { getBattleCards } from "@/lib/db/queries/home";
import { getCategoryBySlug } from "@/lib/db/queries/categories";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const cat = sp.get("category") ? await getCategoryBySlug(sp.get("category")!) : null;
  const exclude = (sp.get("exclude") ?? "").split(",").map(Number).filter(Boolean);
  const user = await getCurrentUser();
  const rows = await getBattleCards({ categoryId: cat?.id, random: true, n: Math.min(10, Number(sp.get("n") ?? 5)), excludeIds: exclude, viewerId: user?.id });
  return NextResponse.json(rows);
}
