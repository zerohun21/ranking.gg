import { type NextRequest } from "next/server";

/** 이미지 프록시: Referer 가 필요한 이미지(네이버 웹툰 등)를 대신 가져온다. 허용 호스트만. */
const ALLOWED_HOSTS = ["image-comic.pstatic.net", "shared-comic.pstatic.net", "kr-a.kakaopagecdn.com", "image.aladin.co.kr"];

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u");
  const ref = req.nextUrl.searchParams.get("ref") ?? "";
  if (!u) return new Response("missing u", { status: 400 });
  let url: URL;
  try {
    url = new URL(u);
  } catch {
    return new Response("bad url", { status: 400 });
  }
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.includes(url.hostname)) return new Response("host not allowed", { status: 403 });
  const upstream = await fetch(url, { headers: { Referer: ref || `https://${url.hostname}/`, "User-Agent": "Mozilla/5.0" }, next: { revalidate: 86400 } }).catch(() => null);
  if (!upstream || !upstream.ok) return new Response("upstream error", { status: 502 });
  const ct = upstream.headers.get("content-type") ?? "image/jpeg";
  if (!ct.startsWith("image/")) return new Response("not image", { status: 415 });
  return new Response(upstream.body, { headers: { "Content-Type": ct, "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable" } });
}
