import { NextResponse } from "next/server";
import { getLiveReviews } from "@/lib/db/queries/home";

export const dynamic = "force-dynamic";
export async function GET() {
  const rows = await getLiveReviews(20);
  return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
}
