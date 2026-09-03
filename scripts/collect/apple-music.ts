/**
 * Apple Music 앨범 (키 불필요)
 *  RSS: rss.marketingtools.apple.com/api/v2/{kr,us}/music/most-played/100/albums.json
 *  iTunes Search: itunes.apple.com/search?term=&country=kr&media=music&entity=album&limit=200&lang=ko_kr
 *    ※ 2026-09-03 확인: kr 스토어는 영문 term(IU/kpop) 0건 → 한글 키워드 + lang=ko_kr 필수. us 스토어는 영문 키워드.
 *  점수 없음 → RSS 순위 기반(9.0~7.5), 검색 결과는 7.0±지터 (metadata.score_estimated=true)
 */
import { dateOf, fetchJson, loadCheckpoint, log, pLimit, saveCheckpoint, yearOf, type Collector, type UpsertRow, upsertContents } from "./common";

type RssItem = { id: string; name: string; artistName: string; artworkUrl100: string; releaseDate?: string; genres?: { name: string }[]; url: string; artistId?: string };
type SearchItem = { collectionId: number; collectionName: string; artistName: string; artworkUrl100?: string; releaseDate?: string; primaryGenreName?: string; collectionViewUrl?: string; trackCount?: number; copyright?: string; collectionExplicitness?: string; country?: string };
type CP = { rssDone: boolean; searchDone: string[]; items: Record<string, UpsertRow> };

const KR_TERMS = ["아이유", "방탄소년단", "블랙핑크", "뉴진스", "에스파", "세븐틴", "아이브", "르세라핌", "트와이스", "엑소", "빅뱅", "지드래곤", "태연", "백예린", "악뮤", "잔나비", "데이식스", "볼빨간사춘기", "폴킴", "임영웅", "이문세", "김광석", "신해철", "서태지", "자우림", "넬", "크러쉬", "딘", "박효신", "성시경", "윤하", "헤이즈", "지코", "빈지노", "에픽하이", "다이나믹듀오", "힙합", "케이팝", "발라드", "인디", "록", "재즈", "클래식", "OST", "드라마 OST", "트로트", "알앤비", "댄스", "일렉트로닉", "어쿠스틱", "스트레이 키즈", "NCT", "레드벨벳", "샤이니", "소녀시대", "장범준", "10cm", "검정치마", "혁오", "선우정아"];
const US_TERMS = ["pop", "rock", "hip hop", "jazz", "classical", "taylor swift", "beyonce", "drake", "kendrick lamar", "billie eilish", "the weeknd", "coldplay", "radiohead", "the beatles", "queen", "k-pop", "olivia rodrigo", "sza", "adele", "ed sheeran"];

function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}
const art = (u?: string) => (u ? u.replace(/\/\d+x\d+bb\./, "/600x600bb.") : null);

export const appleCollector: Collector = {
  source: "apple",
  async run({ db, args, categoryIds }) {
    const S = "apple";
    const catId = categoryIds.get("music")!;
    const cp = loadCheckpoint<CP>(S, { rssDone: false, searchDone: [], items: {} }, args.reset);

    if (!cp.rssDone) {
      for (const country of ["kr", "us"]) {
        const urls = [`https://rss.marketingtools.apple.com/api/v2/${country}/music/most-played/100/albums.json`, `https://rss.applemarketingtools.com/api/v2/${country}/music/most-played/100/albums.json`];
        let feed: { feed: { results: RssItem[] } } | null = null;
        for (const u of urls) {
          try { feed = await fetchJson(u); break; } catch (e) { log(S, `rss ${u} fail: ${(e as Error).message}`); }
        }
        if (!feed) continue;
        feed.feed.results.forEach((r, i) => {
          const rank = i + 1;
          const genres = (r.genres ?? []).map((g) => g.name).filter((g) => g !== "Music" && g !== "음악");
          cp.items[r.id] = {
            categoryId: catId,
            title: r.name,
            titleOriginal: null,
            description: null,
            posterUrl: art(r.artworkUrl100),
            releaseDate: dateOf(r.releaseDate),
            releaseYear: yearOf(r.releaseDate),
            externalSource: "apple",
            externalId: r.id,
            externalUrl: r.url,
            externalScore: Math.round((9.0 - (1.5 * (rank - 1)) / 99) * 100) / 100,
            externalScoreCount: Math.round(50_000 / Math.sqrt(rank)),
            metadata: { kind: "album", artist: r.artistName, genres, chart: country, chart_rank: rank, score_estimated: true, platforms: [country === "kr" ? "KR Chart" : "US Chart"] },
            genreNames: genres,
          };
        });
        log(S, `rss ${country}: ${feed.feed.results.length}`);
      }
      cp.rssDone = true;
      saveCheckpoint(S, cp);
    }

    const limit = pLimit(3);
    const jobs = [...KR_TERMS.map((t) => ({ t, c: "kr" })), ...US_TERMS.map((t) => ({ t, c: "us" }))].filter((j) => !cp.searchDone.includes(`${j.c}:${j.t}`));
    await Promise.all(
      jobs.map((j) =>
        limit(async () => {
          try {
            const url = `https://itunes.apple.com/search?term=${encodeURIComponent(j.t)}&country=${j.c}&media=music&entity=album&limit=200${j.c === "kr" ? "&lang=ko_kr" : ""}`;
            const res = await fetchJson<{ resultCount: number; results: SearchItem[] }>(url, { retries: 4 });
            let added = 0;
            for (const r of res.results) {
              const id = String(r.collectionId);
              if (cp.items[id]) continue;
              const jit = hash01(id);
              const genres = r.primaryGenreName ? [r.primaryGenreName] : [];
              cp.items[id] = {
                categoryId: catId,
                title: r.collectionName,
                titleOriginal: null,
                description: r.copyright ?? null,
                posterUrl: art(r.artworkUrl100),
                releaseDate: dateOf(r.releaseDate),
                releaseYear: yearOf(r.releaseDate),
                externalSource: "apple",
                externalId: id,
                externalUrl: r.collectionViewUrl ?? `https://music.apple.com/${j.c}/album/${id}`,
                externalScore: Math.round((7.0 + (jit - 0.4) * 1.5) * 100) / 100,
                externalScoreCount: Math.round(500 + jit * 3000),
                isAdult: r.collectionExplicitness === "explicit",
                metadata: { kind: "album", artist: r.artistName, genres, trackCount: r.trackCount ?? null, search_term: j.t, store: j.c, score_estimated: true, platforms: [j.c === "kr" ? "KR Store" : "US Store"] },
                genreNames: genres,
              };
              added++;
            }
            cp.searchDone.push(`${j.c}:${j.t}`);
            saveCheckpoint(S, cp);
            log(S, `search ${j.c}:${j.t} → ${res.resultCount} (+${added}, total ${Object.keys(cp.items).length})`);
            await new Promise((r) => setTimeout(r, 3000)); // iTunes Search ~20 req/min
          } catch (e) {
            log(S, `search fail ${j.c}:${j.t}: ${(e as Error).message}`);
          }
        }),
      ),
    );

    let rows = Object.values(cp.items);
    if (args.limit) rows = rows.slice(0, args.limit);
    let upserted = 0;
    for (let i = 0; i < rows.length; i += 200) upserted += await upsertContents(db, rows.slice(i, i + 200), args.dryRun);
    return { upserted, failed: 0 };
  },
};
