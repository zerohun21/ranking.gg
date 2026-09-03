import { ImageResponse } from "next/og";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { getTopN } from "@/lib/db/queries/ranking";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [k] = await db.select().from(categories).where(eq(categories.id, Number(id))).limit(1);
  if (!k) return new Response("not found", { status: 404 });
  const top = (await getTopN(k.id, 5)).filter((r) => r.posterUrl?.startsWith("http"));
  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", flexDirection: "column", background: "linear-gradient(135deg,#1c1c1f,#282830)", color: "#fff", fontFamily: "sans-serif", padding: 60 }}>
        <div style={{ fontSize: 30, color: "#9aa4af", display: "flex" }}>RANKING.GG</div>
        <div style={{ fontSize: 68, fontWeight: 900, display: "flex", marginTop: 8 }}>{k.icon} {k.nameKo} 티어표</div>
        <div style={{ fontSize: 28, color: "#9aa4af", display: "flex", marginTop: 8 }}>{k.itemCount.toLocaleString()}개 작품 · TOP 5</div>
        <div style={{ display: "flex", gap: 24, marginTop: 40 }}>
          {top.map((r, i) => (
            <div key={r.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 190 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.posterUrl!} alt="" width={180} height={240} style={{ borderRadius: 12, objectFit: "cover" }} />
              <div style={{ fontSize: 36, fontWeight: 900, color: i === 0 ? "#ff4e50" : "#fff", display: "flex", marginTop: 8 }}>#{i + 1}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
