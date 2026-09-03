/**
 * 애니 — AniList GraphQL (키 불필요). 2026-09-03 확인: 분당 30~90 요청, Page(perPage 50) 최대 5,000건(100페이지).
 *  Jikan(MyAnimeList) 은 깊은 페이지에서 504 가 잦아 대체. isAdult:false, POPULARITY_DESC.
 */
import { fetchJson, loadCheckpoint, log, saveCheckpoint, truncate, type Collector, type UpsertRow, upsertContents, updateRun } from "./common";

type Media = { id: number; idMal?: number | null; title: { romaji?: string; english?: string | null; native?: string | null }; coverImage: { extraLarge?: string; large?: string }; bannerImage?: string | null; averageScore?: number | null; meanScore?: number | null; popularity?: number; favourites?: number; genres?: string[]; tags?: { name: string; rank: number }[]; description?: string | null; episodes?: number | null; duration?: number | null; format?: string | null; status?: string | null; season?: string | null; seasonYear?: number | null; startDate?: { year?: number | null; month?: number | null; day?: number | null }; studios?: { nodes: { name: string }[] }; siteUrl: string; countryOfOrigin?: string };
type CP = { page: number; items: Record<string, UpsertRow> };
const QUERY = `query($page:Int){Page(page:$page,perPage:50){pageInfo{hasNextPage} media(type:ANIME,sort:POPULARITY_DESC,isAdult:false){id idMal title{romaji english native} coverImage{extraLarge large} bannerImage averageScore meanScore popularity favourites genres tags{name rank} description(asHtml:false) episodes duration format status season seasonYear startDate{year month day} studios(isMain:true){nodes{name}} siteUrl countryOfOrigin}}}`;
const GENRE_KO: Record<string, string> = { Action: "액션", Adventure: "모험", Comedy: "코미디", Drama: "드라마", Fantasy: "판타지", Horror: "공포", Mystery: "미스터리", Romance: "로맨스", "Sci-Fi": "SF", "Slice of Life": "일상", Sports: "스포츠", Supernatural: "초자연", Thriller: "스릴러", Psychological: "심리", Mecha: "메카", Music: "음악", Ecchi: "에치", "Mahou Shoujo": "마법소녀" };
const STATUS: Record<string, string> = { FINISHED: "finished", RELEASING: "ongoing", NOT_YET_RELEASED: "upcoming", CANCELLED: "cancelled", HIATUS: "rest" };

export const anilistCollector: Collector = {
  source: "anilist",
  async run({ db, args, categoryIds, runId }) {
    const S = "anilist";
    const catId = categoryIds.get("anime")!;
    const cp = loadCheckpoint<CP>(S, { page: 0, items: {} }, args.reset);
    const maxPages = args.limit ? Math.max(1, Math.ceil(args.limit / 50)) : 70; // 3,500
    let failed = 0;
    for (let p = cp.page + 1; p <= maxPages; p++) {
      try {
        const j = await fetchJson<{ data: { Page: { pageInfo: { hasNextPage: boolean }; media: Media[] } } }>("https://graphql.anilist.co", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ query: QUERY, variables: { page: p } }), retries: 6, timeoutMs: 30_000 });
        for (const m of j.data.Page.media) {
          const title = m.title.english ?? m.title.romaji ?? m.title.native ?? `#${m.id}`;
          const genreNames = [...new Set([...(m.genres ?? []).map((g) => GENRE_KO[g] ?? g), ...(m.tags ?? []).filter((t) => t.rank >= 80).slice(0, 3).map((t) => t.name)])].slice(0, 7);
          const sd = m.startDate;
          const date = sd?.year ? `${sd.year}-${String(sd.month ?? 1).padStart(2, "0")}-${String(sd.day ?? 1).padStart(2, "0")}` : null;
          const fmt = m.format ?? "TV";
          cp.items[String(m.id)] = {
            categoryId: catId,
            title,
            titleOriginal: m.title.native ?? m.title.romaji ?? null,
            description: truncate(m.description?.replace(/<br\s*\/?>/g, "\n").replace(/<[^>]+>/g, "").replace(/\(Source:[\s\S]*?\)\s*$/, ""), 1500),
            posterUrl: m.coverImage.extraLarge ?? m.coverImage.large ?? null,
            backdropUrl: m.bannerImage ?? null,
            releaseDate: date,
            releaseYear: sd?.year ?? m.seasonYear ?? null,
            externalSource: "anilist",
            externalId: String(m.id),
            externalUrl: m.siteUrl,
            externalScore: m.averageScore != null ? m.averageScore / 10 : m.meanScore != null ? m.meanScore / 10 : null,
            externalScoreCount: m.popularity ?? null,
            isAdult: false,
            metadata: { kind: fmt === "MOVIE" ? "anime_movie" : "anime_tv", genres: genreNames, platforms: [fmt === "TV_SHORT" ? "TV" : fmt === "MOVIE" ? "Movie" : fmt], episodes: m.episodes ?? null, runtime: m.duration ?? null, status: STATUS[m.status ?? ""] ?? null, studios: (m.studios?.nodes ?? []).map((s) => s.name), season: m.season && m.seasonYear ? `${m.seasonYear} ${m.season}` : null, favourites: m.favourites ?? null, mal_id: m.idMal ?? null, title_en: m.title.english ?? null, title_romaji: m.title.romaji ?? null, origin_country: m.countryOfOrigin ? [m.countryOfOrigin] : ["JP"] },
            genreNames,
          };
        }
        cp.page = p;
        saveCheckpoint(S, cp);
        if (p % 10 === 0) log(S, `page ${p}/${maxPages} → ${Object.keys(cp.items).length}`);
        if (!j.data.Page.pageInfo.hasNextPage) break;
      } catch (e) {
        failed++;
        log(S, `page ${p} fail: ${(e as Error).message}`);
      }
      await new Promise((r) => setTimeout(r, 2100)); // ≤ 30 req/min
    }
    let rows = Object.values(cp.items);
    if (args.limit) rows = rows.slice(0, args.limit);
    let upserted = 0;
    for (let i = 0; i < rows.length; i += 200) {
      upserted += await upsertContents(db, rows.slice(i, i + 200), args.dryRun);
      await updateRun(db, runId, { itemsUpserted: upserted, itemsFailed: failed });
    }
    return { upserted, failed };
  },
};
