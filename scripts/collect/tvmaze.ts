/**
 * 드라마 — TVmaze (키 불필요). 2026-09-03 curl 확인.
 *  GET https://api.tvmaze.com/shows?page=N → 240개/페이지 (id 순, 페이지 300 까지 존재). 제한 20 req/10s.
 *  weight(0~100, 인기) 와 rating.average 로 상위 선별. 스크립트/애니메이션 제외 없이 type 별 kind 부여.
 */
import { dateOf, fetchJson, loadCheckpoint, log, pLimit, saveCheckpoint, truncate, yearOf, type Collector, type UpsertRow, upsertContents, updateRun } from "./common";

type Show = { id: number; url: string; name: string; type: string; language: string | null; genres: string[]; status: string; runtime: number | null; premiered: string | null; ended: string | null; rating: { average: number | null }; weight: number; network?: { name: string; country?: { code: string } } | null; webChannel?: { name: string; country?: { code: string } | null } | null; image?: { medium: string; original: string } | null; summary: string | null; externals?: { imdb?: string | null } };
type CP = { page: number; items: Record<string, Show> };
const GENRE_KO: Record<string, string> = { Drama: "드라마", Comedy: "코미디", Action: "액션", Adventure: "모험", Crime: "범죄", "Science-Fiction": "SF", Thriller: "스릴러", Horror: "공포", Romance: "로맨스", Fantasy: "판타지", Mystery: "미스터리", Family: "가족", Supernatural: "초자연", History: "역사", Medical: "메디컬", Legal: "법정", War: "전쟁", Western: "서부", Anime: "애니메이션", Music: "음악", Sports: "스포츠", Espionage: "첩보", Children: "어린이", Food: "음식", Travel: "여행", Nature: "자연", Adult: "성인" };
const PAGES = 42; // ~10,000 shows

export const tvmazeCollector: Collector = {
  source: "tvmaze",
  async run({ db, args, categoryIds, runId }) {
    const S = "tvmaze";
    const catId = categoryIds.get("drama")!;
    const cp = loadCheckpoint<CP>(S, { page: -1, items: {} }, args.reset);
    const limit = pLimit(2);
    const maxPage = args.limit ? Math.min(PAGES - 1, Math.ceil(args.limit / 240)) : PAGES - 1;
    const pages = Array.from({ length: Math.max(0, maxPage - cp.page) }, (_, i) => cp.page + 1 + i);
    let failed = 0;
    await Promise.all(
      pages.map((p) =>
        limit(async () => {
          try {
            const shows = await fetchJson<Show[]>(`https://api.tvmaze.com/shows?page=${p}`, { retries: 5 });
            for (const s of shows) if (s.image && (s.weight >= 60 || (s.rating.average ?? 0) >= 7)) cp.items[String(s.id)] = s;
            cp.page = Math.max(cp.page, p);
            saveCheckpoint(S, cp);
            if (p % 10 === 0) log(S, `page ${p}: kept ${Object.keys(cp.items).length}`);
          } catch (e) {
            failed++;
            log(S, `page ${p} fail: ${(e as Error).message}`);
          }
          await new Promise((r) => setTimeout(r, 600));
        }),
      ),
    );
    // 상위 선별: weight desc → rating desc, 최대 3,500
    const sorted = Object.values(cp.items).sort((a, b) => b.weight - a.weight || (b.rating.average ?? 0) - (a.rating.average ?? 0)).slice(0, args.limit ?? 3500);
    const rows: UpsertRow[] = sorted.map((s) => {
      const genreNames = s.genres.map((g) => GENRE_KO[g] ?? g).slice(0, 5);
      const kind = s.type === "Animation" ? "animation" : s.type === "Reality" || s.type === "Talk Show" || s.type === "Game Show" || s.type === "Variety" ? "variety" : s.type === "Documentary" ? "documentary" : "tv";
      const country = s.network?.country?.code ?? s.webChannel?.country?.code ?? null;
      const provider = s.webChannel?.name ?? s.network?.name ?? null;
      const providers = provider ? [provider === "Disney+" ? "Disney Plus" : provider] : [];
      // 표본 수 추정: weight(0~100) 를 지수 스케일로
      const count = Math.round(50 * Math.pow(1.06, s.weight));
      return {
        categoryId: catId,
        title: s.name,
        titleOriginal: null,
        description: truncate(s.summary?.replace(/<[^>]+>/g, ""), 1500),
        posterUrl: s.image?.original ?? s.image?.medium ?? null,
        releaseDate: dateOf(s.premiered),
        releaseYear: yearOf(s.premiered),
        externalSource: "tvmaze",
        externalId: String(s.id),
        externalUrl: s.url,
        externalScore: s.rating.average ?? null,
        externalScoreCount: count,
        isAdult: s.genres.includes("Adult"),
        metadata: { kind, genres: genreNames, providers, platforms: providers, runtime: s.runtime ?? null, status: s.status === "Ended" ? "finished" : s.status === "Running" ? "ongoing" : s.status?.toLowerCase() ?? null, origin_country: country ? [country] : [], original_language: s.language ?? null, networks: provider ? [provider] : [], imdb_id: s.externals?.imdb ?? null, tvmaze_weight: s.weight, ended: s.ended ?? null },
        genreNames,
      };
    });
    let upserted = 0;
    for (let i = 0; i < rows.length; i += 200) {
      upserted += await upsertContents(db, rows.slice(i, i + 200), args.dryRun);
      await updateRun(db, runId, { itemsUpserted: upserted });
    }
    return { upserted, failed };
  },
};
