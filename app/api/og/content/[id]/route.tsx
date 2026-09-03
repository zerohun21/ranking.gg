import { ImageResponse } from "next/og";
import { getContentById } from "@/lib/db/queries/content";

export const runtime = "nodejs";
const TIER_COLOR: Record<string, string> = { S: "#ff4e50", A: "#ff8a3d", B: "#5383e8", C: "#00bba3", D: "#9aa4af" };

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getContentById(Number(id));
  if (!d) return new Response("not found", { status: 404 });
  const { content: c, stats: s, category: k } = d;
  const poster = c.posterUrl && c.posterUrl.startsWith("http") ? c.posterUrl : null;
  const tier = s.tier ?? "?";
  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", background: "linear-gradient(135deg,#1c1c1f,#282830)", color: "#fff", fontFamily: "sans-serif", padding: 60 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {poster && <img src={poster} alt="" width={340} height={510} style={{ borderRadius: 16, objectFit: "cover", boxShadow: "0 20px 60px rgba(0,0,0,.6)" }} />}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", marginLeft: 56, flex: 1 }}>
          <div style={{ fontSize: 28, color: "#9aa4af", display: "flex" }}>{k.icon} {k.nameKo} · RANKING.GG</div>
          <div style={{ fontSize: 60, fontWeight: 900, lineHeight: 1.1, marginTop: 12, display: "flex" }}>{c.title.length > 22 ? c.title.slice(0, 22) + "…" : c.title}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 36 }}>
            <div style={{ width: 120, height: 120, borderRadius: 20, background: TIER_COLOR[tier] ?? "#3a3a4a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 72, fontWeight: 900 }}>{tier}</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 34, fontWeight: 700, display: "flex" }}>#{s.rank ?? "–"}위</div>
              <div style={{ fontSize: 64, fontWeight: 900, color: "#ffb400", display: "flex" }}>{Number(s.bayesianScore).toFixed(2)}</div>
              <div style={{ fontSize: 24, color: "#9aa4af", display: "flex" }}>{s.ratingCount.toLocaleString()}명 평가</div>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
