export function formatScore(score: number | string | null | undefined): string {
  const n = Number(score ?? 0);
  return n ? n.toFixed(2) : "–";
}
export function formatCount(n: number | string | null | undefined, locale = "ko"): string {
  const v = Number(n ?? 0);
  if (locale === "ko") {
    if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`;
    if (v >= 10_000) return `${(v / 10_000).toFixed(v >= 100_000 ? 0 : 1)}만`;
    return v.toLocaleString("ko-KR");
  }
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1)}K`;
  return v.toLocaleString("en-US");
}
export function stars5(score10: number | string | null | undefined): number {
  return Math.round((Number(score10 ?? 0) / 2) * 2) / 2;
}
export function relativeTime(d: Date | string, locale = "ko"): string {
  const t = typeof d === "string" ? new Date(d).getTime() : d.getTime();
  const diff = Math.max(0, Date.now() - t);
  const m = Math.floor(diff / 60000);
  const rtf = new Intl.RelativeTimeFormat(locale === "ko" ? "ko" : "en", { numeric: "auto" });
  if (m < 1) return locale === "ko" ? "방금" : "just now";
  if (m < 60) return rtf.format(-m, "minute");
  const h = Math.floor(m / 60);
  if (h < 24) return rtf.format(-h, "hour");
  const days = Math.floor(h / 24);
  if (days < 30) return rtf.format(-days, "day");
  const months = Math.floor(days / 30);
  if (months < 12) return rtf.format(-months, "month");
  return rtf.format(-Math.floor(months / 12), "year");
}
export function contentHref(categorySlug: string, slug: string) {
  return `/c/${categorySlug}/${encodeURIComponent(slug)}`;
}
export function displayTitle(c: { title: string; titleOriginal?: string | null }, locale: string) {
  if (locale === "en" && c.titleOriginal && /^[\x00-\x7F]+$/.test(c.titleOriginal)) return c.titleOriginal;
  return c.title;
}
