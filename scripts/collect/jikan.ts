/**
 * 애니 — Jikan v4 (MyAnimeList 비공식, 키 불필요). 2026-09-03 curl 확인.
 *  GET https://api.jikan.moe/v4/top/anime?page=N → data[25], pagination.last_visible_page(1215)
 *  제한 3 req/s, 60 req/min → 1.1초 간격 순차. 120페이지 = 3,000편.
 */
import { dateOf, fetchJson, loadCheckpoint, log, saveCheckpoint, truncate, yearOf, type Collector, type UpsertRow, upsertContents, updateRun } from "./common";

type Anime = {
  mal_id: number; url: string; title: string; title_english?: string | null; title_japanese?: string | null; titles?: { type: string; title: string }[];
  images: { jpg: { large_image_url?: string; image_url?: string } }; type?: string | null; episodes?: number | null; status?: string; aired?: { from?: string | null };
  score?: number | null; scored_by?: number | null; rank?: number | null; popularity?: number | null; members?: number; synopsis?: string | null; year?: number | null; season?: string | null;
  genres?: { name: string }[]; themes?: { name: string }[]; demographics?: { name: string }[]; studios?: { name: string }[]; rating?: string | null; source?: string | null; duration?: string | null;
};
type CP = { page: number; items: Record<string, UpsertRow> };
const GENRE_KO: Record<string, string> = { Action: "액션", Adventure: "모험", Comedy: "코미디", Drama: "드라마", Fantasy: "판타지", Horror: "공포", Mystery: "미스터리", Romance: "로맨스", "Sci-Fi": "SF", "Slice of Life": "일상", Sports: "스포츠", Supernatural: "초자연", Suspense: "서스펜스", "Award Winning": "수상작", Ecchi: "에치", "Avant Garde": "아방가르드", Gourmet: "요리", "Boys Love": "BL", "Girls Love": "GL", Shounen: "소년", Shoujo: "소녀", Seinen: "청년", Josei: "여성", Kids: "키즈", Mecha: "메카", Music: "음악", School: "학원", Isekai: "이세계", Psychological: "심리", Historical: "역사", Military: "밀리터리", "Martial Arts": "무술", "Super Power": "초능력", Space: "우주", Vampire: "뱀파이어", Mythology: "신화", Harem: "하렘", Parody: "패러디", Samurai: "사무라이", Detective: "탐정", Gag: "개그", Idols: "아이돌" };

export const jikanCollector: Collector = {
  source: "jikan",
  async run({ db, args, categoryIds, runId }) {
    const S = "jikan";
    const catId = categoryIds.get("anime")!;
    const cp = loadCheckpoint<CP>(S, { page: 0, items: {} }, args.reset);
    const maxPages = args.limit ? Math.max(1, Math.ceil(args.limit / 25)) : 120;
    let failed = 0;
    for (let p = cp.page + 1; p <= maxPages; p++) {
      try {
        const j = await fetchJson<{ data: Anime[]; pagination: { has_next_page: boolean } }>(`https://api.jikan.moe/v4/top/anime?page=${p}`, { retries: 6 });
        for (const a of j.data) {
          if (a.rating?.startsWith("Rx")) continue; // 성인물 제외
          const genres = [...(a.genres ?? []), ...(a.themes ?? []), ...(a.demographics ?? [])].map((g) => g.name);
          const genreNames = [...new Set(genres.map((g) => GENRE_KO[g] ?? g))].slice(0, 6);
          const platforms = [a.type ?? "TV"].filter(Boolean) as string[];
          cp.items[String(a.mal_id)] = {
            categoryId: catId,
            title: a.title_english ?? a.title,
            titleOriginal: a.title_japanese ?? a.title,
            description: truncate(a.synopsis?.replace(/\n?\[Written by MAL Rewrite\]$/, ""), 1500),
            posterUrl: a.images.jpg.large_image_url ?? a.images.jpg.image_url ?? null,
            releaseDate: dateOf(a.aired?.from),
            releaseYear: a.year ?? yearOf(a.aired?.from),
            externalSource: "jikan",
            externalId: String(a.mal_id),
            externalUrl: a.url,
            externalScore: a.score ?? null,
            externalScoreCount: a.scored_by ?? null,
            isAdult: a.rating?.startsWith("R+") ?? false,
            metadata: { kind: a.type === "Movie" ? "anime_movie" : "anime_tv", genres: genreNames, platforms, episodes: a.episodes ?? null, status: a.status === "Finished Airing" ? "finished" : a.status === "Currently Airing" ? "ongoing" : a.status ?? null, studios: (a.studios ?? []).map((s) => s.name), age: a.rating ?? null, mal_rank: a.rank ?? null, mal_popularity: a.popularity ?? null, members: a.members ?? null, season: a.season ?? null, title_en: a.title_english ?? null, title_romaji: a.title, source_material: a.source ?? null, origin_country: ["JP"] },
            genreNames,
          };
        }
        cp.page = p;
        saveCheckpoint(S, cp);
        if (p % 10 === 0) log(S, `page ${p}/${maxPages} → ${Object.keys(cp.items).length}`);
        if (!j.pagination.has_next_page) break;
      } catch (e) {
        failed++;
        log(S, `page ${p} fail: ${(e as Error).message}`);
      }
      await new Promise((r) => setTimeout(r, 1100));
    }
    let rows = Object.values(cp.items);
    if (args.limit) rows = rows.slice(0, args.limit);
    let upserted = 0;
    for (let i = 0; i < rows.length; i += 200) {
      upserted += await upsertContents(db, rows.slice(i, i + 200), args.dryRun);
      await updateRun(db, runId, { itemsUpserted: upserted });
    }
    return { upserted, failed };
  },
};
