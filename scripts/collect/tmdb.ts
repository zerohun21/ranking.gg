/**
 * TMDB — 영화 / 드라마(+예능) / 애니.  language=ko-KR&region=KR&include_adult=false
 *  목록: /3/discover/{movie|tv}  상세: /3/{movie|tv}/{id}?append_to_response=watch/providers,credits,keywords,external_ids
 *  ko 줄거리 없으면 en-US 폴백 1회 추가 요청. 동시성 10.
 */
import { dateOf, fetchJson, HttpError, loadCheckpoint, log, pLimit, progress, saveCheckpoint, truncate, yearOf, type Collector, type UpsertRow, upsertContents, updateRun } from "./common";

const API = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";
const KEY = () => {
  const k = process.env.TMDB_API_KEY;
  if (!k) throw new Error("TMDB_API_KEY not set");
  return k;
};
const q = (params: Record<string, string | number | undefined>) =>
  Object.entries({ api_key: KEY(), language: "ko-KR", region: "KR", include_adult: "false", ...params })
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");

type Kind = "movie" | "tv";
type Phase = { name: string; kind: Kind; pages: number; params: Record<string, string | number> };
type ListRes = { page: number; total_pages: number; results: { id: number }[] };
type Detail = {
  id: number; title?: string; name?: string; original_title?: string; original_name?: string; overview?: string; tagline?: string;
  poster_path?: string | null; backdrop_path?: string | null; release_date?: string; first_air_date?: string; runtime?: number | null;
  episode_run_time?: number[]; number_of_seasons?: number; number_of_episodes?: number; genres?: { id: number; name: string }[];
  vote_average?: number; vote_count?: number; adult?: boolean; origin_country?: string[]; original_language?: string; status?: string;
  production_companies?: { name: string }[]; networks?: { name: string }[]; created_by?: { name: string }[];
  "watch/providers"?: { results?: Record<string, { flatrate?: { provider_name: string }[] }> };
  credits?: { cast?: { name: string }[]; crew?: { job: string; name: string }[] };
  keywords?: { keywords?: { name: string }[]; results?: { name: string }[] };
  external_ids?: { imdb_id?: string };
};
type CP = { phase: Record<string, number>; ids: Record<string, Kind>; done: string[] };

const VARIETY_GENRES = new Set([10764, 10767]);

function makeCollector(source: string, category: string, phases: Phase[]): Collector {
  return {
    source,
    async run({ db, args, categoryIds, runId }) {
      const S = source;
      const catId = categoryIds.get(category)!;
      const cp = loadCheckpoint<CP>(S, { phase: {}, ids: {}, done: [] }, args.reset);
      const done = new Set(cp.done);
      const listLimit = pLimit(8);

      // 1) 목록
      for (const ph of phases) {
        const startPage = (cp.phase[ph.name] ?? 0) + 1;
        if (startPage > ph.pages) continue;
        const pages = Array.from({ length: ph.pages - startPage + 1 }, (_, i) => startPage + i);
        let stop = false;
        await Promise.all(
          pages.map((p) =>
            listLimit(async () => {
              if (stop) return;
              try {
                const j = await fetchJson<ListRes>(`${API}/discover/${ph.kind}?${q({ ...ph.params, page: p })}`);
                for (const r of j.results) cp.ids[`${ph.kind}:${r.id}`] = ph.kind;
                if (p >= j.total_pages) stop = true;
              } catch (e) {
                if (e instanceof HttpError && e.status === 422) { stop = true; return; } // page > 500
                throw e;
              }
            }),
          ),
        );
        cp.phase[ph.name] = ph.pages;
        saveCheckpoint(S, cp);
        log(S, `phase ${ph.name}: listed total ${Object.keys(cp.ids).length}`);
      }

      let keys = Object.keys(cp.ids).filter((k) => !done.has(k));
      if (args.limit) keys = keys.slice(0, args.limit);
      log(S, `to fetch details: ${keys.length} (done ${done.size})`);

      // 2) 상세
      const limit = pLimit(args.concurrency ?? 10);
      let upserted = 0, failed = 0, processed = 0;
      const total = keys.length;
      for (let i = 0; i < keys.length; i += 200) {
        const batch = keys.slice(i, i + 200);
        const rows = (
          await Promise.all(
            batch.map((key) =>
              limit(async (): Promise<UpsertRow | null> => {
                const [kind, id] = key.split(":") as [Kind, string];
                try {
                  const d = await fetchJson<Detail>(`${API}/${kind}/${id}?${q({ append_to_response: "watch/providers,credits,keywords,external_ids" })}`);
                  let overview = d.overview?.trim() ?? "";
                  let title = (kind === "movie" ? d.title : d.name)?.trim() ?? "";
                  const original = (kind === "movie" ? d.original_title : d.original_name) ?? null;
                  if (!overview || !title) {
                    try {
                      const en = await fetchJson<Detail>(`${API}/${kind}/${id}?${q({ language: "en-US" })}`);
                      if (!overview) overview = en.overview?.trim() ?? "";
                      if (!title) title = (kind === "movie" ? en.title : en.name)?.trim() ?? original ?? `#${id}`;
                    } catch { /* ignore */ }
                  }
                  const genreIds = (d.genres ?? []).map((g) => g.id);
                  const genreNames = (d.genres ?? []).map((g) => g.name);
                  const providers = (d["watch/providers"]?.results?.KR?.flatrate ?? []).map((p) => p.provider_name);
                  const directors = (d.credits?.crew ?? []).filter((c) => c.job === "Director").map((c) => c.name).slice(0, 3);
                  const cast = (d.credits?.cast ?? []).slice(0, 5).map((c) => c.name);
                  const date = kind === "movie" ? d.release_date : d.first_air_date;
                  const isVariety = kind === "tv" && genreIds.some((g) => VARIETY_GENRES.has(g));
                  const isAnime = category === "anime";
                  return {
                    categoryId: catId,
                    title: title || original || `#${id}`,
                    titleOriginal: original && original !== title ? original : null,
                    description: truncate(overview, 2000),
                    posterUrl: d.poster_path ? `${IMG}/w500${d.poster_path}` : null,
                    backdropUrl: d.backdrop_path ? `${IMG}/w1280${d.backdrop_path}` : null,
                    releaseDate: dateOf(date),
                    releaseYear: yearOf(date),
                    externalSource: "tmdb",
                    externalId: `${kind}-${id}`,
                    externalUrl: `https://www.themoviedb.org/${kind}/${id}`,
                    externalScore: d.vote_average ? Math.round(d.vote_average * 10) / 10 : null,
                    externalScoreCount: d.vote_count ?? null,
                    isAdult: !!d.adult,
                    metadata: {
                      kind: isVariety ? "variety" : isAnime ? (kind === "movie" ? "anime_movie" : "anime_tv") : kind,
                      tmdb_kind: kind,
                      genres: genreNames,
                      providers,
                      platforms: providers,
                      runtime: kind === "movie" ? d.runtime ?? null : d.episode_run_time?.[0] ?? null,
                      seasons: d.number_of_seasons ?? null,
                      episodes: d.number_of_episodes ?? null,
                      directors: kind === "movie" ? directors : (d.created_by ?? []).map((c) => c.name).slice(0, 3),
                      cast,
                      tagline: d.tagline || null,
                      origin_country: d.origin_country ?? [],
                      original_language: d.original_language ?? null,
                      networks: (d.networks ?? []).map((n) => n.name).slice(0, 3),
                      status: d.status ?? null,
                      imdb_id: d.external_ids?.imdb_id ?? null,
                      keywords: ((d.keywords?.keywords ?? d.keywords?.results) ?? []).map((k) => k.name).slice(0, 10),
                    },
                    genreNames,
                  } satisfies UpsertRow;
                } catch (e) {
                  failed++;
                  if (!(e instanceof HttpError && e.status === 404)) log(S, `fail ${key}: ${(e as Error).message}`);
                  return null;
                } finally {
                  processed++;
                  progress(S, processed, total, `upserted=${upserted} failed=${failed}`);
                }
              }),
            ),
          )
        ).filter((r): r is UpsertRow => !!r);
        upserted += await upsertContents(db, rows, args.dryRun);
        for (const k of batch) done.add(k);
        cp.done = [...done];
        saveCheckpoint(S, cp);
        await updateRun(db, runId, { itemsUpserted: upserted, itemsFailed: failed, cursor: { processed, total } });
      }
      return { upserted, failed };
    },
  };
}

export const tmdbCollectors: Collector[] = [
  makeCollector("tmdb-movie", "movie", [
    { name: "popular", kind: "movie", pages: 150, params: { sort_by: "popularity.desc", "vote_count.gte": 100 } },
    { name: "top", kind: "movie", pages: 25, params: { sort_by: "vote_average.desc", "vote_count.gte": 1000 } },
    { name: "kr", kind: "movie", pages: 25, params: { sort_by: "popularity.desc", "vote_count.gte": 20, with_origin_country: "KR" } },
  ]),
  makeCollector("tmdb-tv", "drama", [
    { name: "popular", kind: "tv", pages: 125, params: { sort_by: "popularity.desc", "vote_count.gte": 50, without_genres: "16,10763" } },
    { name: "kr", kind: "tv", pages: 40, params: { sort_by: "popularity.desc", "vote_count.gte": 30, with_origin_country: "KR", without_genres: "16,10763" } },
    { name: "top", kind: "tv", pages: 15, params: { sort_by: "vote_average.desc", "vote_count.gte": 500, without_genres: "16,10763" } },
  ]),
  makeCollector("tmdb-anime", "anime", [
    { name: "tv", kind: "tv", pages: 75, params: { sort_by: "popularity.desc", "vote_count.gte": 20, with_genres: "16", with_origin_country: "JP" } },
    { name: "movie", kind: "movie", pages: 25, params: { sort_by: "popularity.desc", "vote_count.gte": 30, with_genres: "16", with_origin_country: "JP" } },
  ]),
];
