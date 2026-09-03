import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const alt = "RANKING.GG — 모든 콘텐츠 티어표";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TIERS: [string, string][] = [["S", "#ff4e50"], ["A", "#ff8a3d"], ["B", "#5383e8"], ["C", "#00bba3"], ["D", "#9aa4af"]];

export default async function OG() {
  const logo = await readFile(path.join(process.cwd(), "public", "logo-512.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", background: "linear-gradient(135deg,#1c1c1f 0%,#282830 100%)", color: "#fff", fontFamily: "sans-serif", position: "relative" }}>
        <div style={{ position: "absolute", top: -200, left: 300, width: 600, height: 400, borderRadius: 400, background: "radial-gradient(#5383e8 0%, transparent 70%)", opacity: 0.35, display: "flex" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <img src={logoSrc} width={168} height={168} alt="" style={{ borderRadius: 36 }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 108, fontWeight: 900, letterSpacing: -4, lineHeight: 1 }}>
              <span>RANKING</span>
              <span style={{ color: "#00d5ff" }}>.GG</span>
            </div>
            <div style={{ display: "flex", fontSize: 34, color: "#c9ced6", marginTop: 14 }}>웹툰 · 영화 · 드라마 · 애니 · 게임 · 음악 · 도서 — 전부 티어표로</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 18, marginTop: 64 }}>
          {TIERS.map(([t, c]) => (
            <div key={t} style={{ width: 96, height: 96, borderRadius: 22, background: c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56, fontWeight: 900, color: "#fff" }}>
              {t}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", marginTop: 44, fontSize: 30, color: "#9aa4af" }}>왜 내가 좋아하는 건 2등이지? — 별점 주고, 대결 투표하고, 순위를 바꿔보세요</div>
      </div>
    ),
    { ...size },
  );
}
