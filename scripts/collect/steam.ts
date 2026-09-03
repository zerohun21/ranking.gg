/**
 * 게임 — SteamSpy(목록·평가 수) + Steam 스토어 appdetails(한글 이름/설명/장르) (키 불필요). 2026-09-03 curl 확인.
 *  https://steamspy.com/api.php?request=all&page=N → 1,000개/페이지 (1 req/min 제한) — 4페이지
 *  https://store.steampowered.com/api/appdetails?appids=ID&l=koreana&cc=kr → data.{name,short_description,header_image,genres,release_date,metacritic,developers,publishers,platforms}
 *  헤더 이미지는 https://cdn.cloudflare.steamstatic.com/steam/apps/{appid}/header.jpg 로 핫링크 가능(Referer 불필요)
 *  appdetails 제한 ≈ 200 req/5min → 0.35초 간격 순차(상위 2,500개만), 나머지는 SteamSpy 영문명 + 헤더 이미지만
 */
import { dateOf, fetchJson, HttpError, loadCheckpoint, log, saveCheckpoint, truncate, yearOf, type Collector, type UpsertRow, upsertContents, updateRun } from "./common";

type SpyGame = { appid: number; name: string; developer: string; publisher: string; positive: number; negative: number; owners: string; price: string; ccu: number };
type Details = { name: string; short_description?: string; header_image?: string; genres?: { description: string }[]; release_date?: { date?: string }; metacritic?: { score: number }; developers?: string[]; publishers?: string[]; platforms?: { windows?: boolean; mac?: boolean; linux?: boolean }; required_age?: number | string; recommendations?: { total: number }; type?: string };
type CP = { spyPages: number[]; games: Record<string, SpyGame>; details: Record<string, Details | null>; done: string[] };
const DETAIL_TARGET = 2500;

function parseKoDate(s?: string): string | null {
  if (!s) return null;
  const m = /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
const ownersMid = (o: string) => { const m = o.replace(/,/g, "").match(/(\d+)\s*\.\.\s*(\d+)/); return m ? (Number(m[1]) + Number(m[2])) / 2 : 0; };

export const steamCollector: Collector = {
  source: "steam",
  async run({ db, args, categoryIds, runId }) {
    const S = "steam";
    const catId = categoryIds.get("game")!;
    const cp = loadCheckpoint<CP>(S, { spyPages: [], games: {}, details: {}, done: [] }, args.reset);
    const pages = args.limit ? [0] : [0, 1, 2, 3];
    for (const p of pages) {
      if (cp.spyPages.includes(p)) continue;
      const j = await fetchJson<Record<string, SpyGame>>(`https://steamspy.com/api.php?request=all&page=${p}`, { headers: { "User-Agent": "Mozilla/5.0" }, retries: 4, timeoutMs: 90_000 });
      for (const g of Object.values(j)) if (g.positive + g.negative >= 50) cp.games[String(g.appid)] = g;
      cp.spyPages.push(p);
      saveCheckpoint(S, cp);
      log(S, `steamspy page ${p}: total ${Object.keys(cp.games).length}`);
      if (pages.length > 1 && p < pages[pages.length - 1]) await new Promise((r) => setTimeout(r, 61_000));
    }
    // 평가 수 기준 정렬
    let games = Object.values(cp.games).sort((a, b) => b.positive + b.negative - (a.positive + a.negative));
    if (args.limit) games = games.slice(0, args.limit);
    // 상세 (상위 DETAIL_TARGET)
    const needDetail = games.slice(0, args.limit ?? DETAIL_TARGET).filter((g) => !(String(g.appid) in cp.details));
    log(S, `appdetails to fetch: ${needDetail.length}`);
    let failed = 0;
    for (let i = 0; i < needDetail.length; i++) {
      const g = needDetail[i];
      try {
        const j = await fetchJson<Record<string, { success: boolean; data?: Details }>>(`https://store.steampowered.com/api/appdetails?appids=${g.appid}&l=koreana&cc=kr`, { retries: 4, timeoutMs: 20_000 });
        cp.details[String(g.appid)] = j[String(g.appid)]?.success ? j[String(g.appid)].data ?? null : null;
      } catch (e) {
        if (e instanceof HttpError && e.status === 429) { log(S, "429 → 60s 대기"); await new Promise((r) => setTimeout(r, 60_000)); i--; continue; }
        cp.details[String(g.appid)] = null;
        failed++;
      }
      if (i % 25 === 0) saveCheckpoint(S, cp);
      if (i % 200 === 0) log(S, `appdetails ${i}/${needDetail.length}`);
      await new Promise((r) => setTimeout(r, 350));
    }
    saveCheckpoint(S, cp);

    const rows: UpsertRow[] = games.map((g) => {
      const d = cp.details[String(g.appid)] ?? null;
      const total = g.positive + g.negative;
      const score = total ? Math.round((g.positive / total) * 100) / 10 : null;
      const platforms = d?.platforms ? ([d.platforms.windows && "PC", d.platforms.mac && "Mac", d.platforms.linux && "Linux"].filter(Boolean) as string[]) : ["PC"];
      const genreNames = (d?.genres ?? []).map((x) => x.description).filter((x) => !/무료 플레이|앞서 해보기|Free to Play|Early Access/.test(x)).slice(0, 5);
      const title = d?.name ?? g.name;
      return {
        categoryId: catId,
        title,
        titleOriginal: d?.name && d.name !== g.name ? g.name : null,
        description: truncate(d?.short_description, 600),
        posterUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.appid}/header.jpg`,
        backdropUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.appid}/header.jpg`,
        releaseDate: parseKoDate(d?.release_date?.date) ?? dateOf(null),
        releaseYear: yearOf(parseKoDate(d?.release_date?.date)),
        externalSource: "steam",
        externalId: String(g.appid),
        externalUrl: `https://store.steampowered.com/app/${g.appid}`,
        externalScore: score,
        externalScoreCount: total,
        isAdult: Number(d?.required_age ?? 0) >= 18,
        metadata: { kind: "game", genres: genreNames, platforms, developers: (d?.developers ?? [g.developer]).filter(Boolean).slice(0, 3), publishers: (d?.publishers ?? [g.publisher]).filter(Boolean).slice(0, 3), metacritic: d?.metacritic?.score ?? null, positive: g.positive, negative: g.negative, owners: g.owners, owners_mid: ownersMid(g.owners), ccu: g.ccu, price_krw: null, title_en: g.name, stores: ["Steam"], free: g.price === "0" },
        genreNames,
      };
    });
    let upserted = 0;
    for (let i = 0; i < rows.length; i += 200) {
      upserted += await upsertContents(db, rows.slice(i, i + 200), args.dryRun);
      await updateRun(db, runId, { itemsUpserted: upserted, itemsFailed: failed });
    }
    return { upserted, failed };
  },
};
