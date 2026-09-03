/**
 * 영화 (키 불필요) — IMDb 공개 데이터셋(평점·투표수·장르) + Wikipedia REST(포스터·줄거리·한글 제목)
 *  https://datasets.imdbws.com/title.ratings.tsv.gz (≈7MB), title.basics.tsv.gz (≈190MB gz) — 개인/비상업 용도 라이선스
 *  https://en.wikipedia.org/api/rest_v1/page/summary/{title} → thumbnail.source, extract, description
 *  https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=ko&titles=… → 한글 제목
 *  선별: titleType=movie, numVotes ≥ 25,000 → 투표수 순 상위 3,500
 */
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { existsSync, mkdirSync, createWriteStream, createReadStream } from "node:fs";
import path from "node:path";
import { fetchJson, loadCheckpoint, log, saveCheckpoint, truncate, type Collector, type UpsertRow, upsertContents, updateRun } from "./common";

type Basic = { tconst: string; title: string; original: string; year: number | null; runtime: number | null; genres: string[]; adult: boolean };
type CP = { basics: Record<string, Basic & { rating: number; votes: number }>; basicsDone: boolean; wiki: Record<string, { thumb: string | null; extract: string | null; ko: string | null; page: string | null; desc: string | null } | null> };
const CACHE = path.join(process.cwd(), ".cache", "imdb");
const MIN_VOTES = 25_000;
const TARGET = 3500;
const GENRE_KO: Record<string, string> = { Action: "액션", Adventure: "모험", Animation: "애니메이션", Biography: "전기", Comedy: "코미디", Crime: "범죄", Documentary: "다큐멘터리", Drama: "드라마", Family: "가족", Fantasy: "판타지", History: "역사", Horror: "공포", Music: "음악", Musical: "뮤지컬", Mystery: "미스터리", Romance: "로맨스", "Sci-Fi": "SF", Sport: "스포츠", Thriller: "스릴러", War: "전쟁", Western: "서부", "Film-Noir": "필름 누아르" };
const WIKI_H = { "User-Agent": "ranking-gg/1.0 (local dev; contact: none)", Accept: "application/json" };

async function download(url: string, dest: string) {
  if (existsSync(dest)) return;
  mkdirSync(path.dirname(dest), { recursive: true });
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`download ${url} → ${res.status}`);
  await new Promise<void>((resolve, reject) => {
    const ws = createWriteStream(dest);
    Readable.fromWeb(res.body as never).pipe(ws).on("finish", resolve).on("error", reject);
  });
}
async function* tsvLines(file: string) {
  const rl = createInterface({ input: createReadStream(file).pipe(createGunzip()), crlfDelay: Infinity });
  let header: string[] | null = null;
  for await (const line of rl) {
    const cols = line.split("\t");
    if (!header) { header = cols; continue; }
    yield Object.fromEntries(header.map((h, i) => [h, cols[i]])) as Record<string, string>;
  }
}

export const imdbWikiCollector: Collector = {
  source: "imdb-wiki",
  async run({ db, args, categoryIds, runId }) {
    const S = "imdb-wiki";
    const catId = categoryIds.get("movie")!;
    const cp = loadCheckpoint<CP>(S, { basics: {}, basicsDone: false, wiki: {} }, args.reset);

    if (!cp.basicsDone) {
      log(S, "downloading IMDb datasets…");
      await download("https://datasets.imdbws.com/title.ratings.tsv.gz", path.join(CACHE, "title.ratings.tsv.gz"));
      await download("https://datasets.imdbws.com/title.basics.tsv.gz", path.join(CACHE, "title.basics.tsv.gz"));
      const ratings = new Map<string, { rating: number; votes: number }>();
      for await (const r of tsvLines(path.join(CACHE, "title.ratings.tsv.gz"))) {
        const votes = Number(r.numVotes);
        if (votes >= MIN_VOTES) ratings.set(r.tconst, { rating: Number(r.averageRating), votes });
      }
      log(S, `ratings ≥${MIN_VOTES}: ${ratings.size}`);
      let n = 0;
      for await (const b of tsvLines(path.join(CACHE, "title.basics.tsv.gz"))) {
        n++;
        if (n % 2_000_000 === 0) log(S, `basics scanned ${n}`);
        if (b.titleType !== "movie" || !ratings.has(b.tconst)) continue;
        const r = ratings.get(b.tconst)!;
        cp.basics[b.tconst] = { tconst: b.tconst, title: b.primaryTitle, original: b.originalTitle, year: b.startYear === "\\N" ? null : Number(b.startYear), runtime: b.runtimeMinutes === "\\N" ? null : Number(b.runtimeMinutes), genres: b.genres === "\\N" ? [] : b.genres.split(","), adult: b.isAdult === "1", ...r };
      }
      cp.basicsDone = true;
      saveCheckpoint(S, cp);
      log(S, `movies selected: ${Object.keys(cp.basics).length}`);
    }

    let movies = Object.values(cp.basics).filter((m) => !m.adult).sort((a, b) => b.votes - a.votes).slice(0, args.limit ?? TARGET);
    const need = movies.filter((m) => !(m.tconst in cp.wiki));
    log(S, `wikipedia lookups: ${need.length} (Action API, 6 movies/request)`);
    let done = 0, failed = 0;
    const candidatesOf = (m: Basic) => [...new Set([`${m.title} (${m.year} film)`, `${m.title} (film)`, m.title, ...(m.original !== m.title ? [`${m.original} (film)`, m.original] : [])])].slice(0, 3);
    type Page = { title: string; missing?: boolean; extract?: string; original?: { source: string }; thumbnail?: { source: string }; langlinks?: { lang: string; "*": string }[]; pageprops?: { disambiguation?: string } };
    for (let i = 0; i < need.length; i += 6) {
      const batch = need.slice(i, i + 6);
      const titles = batch.flatMap(candidatesOf);
      try {
        const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=extracts|pageimages|langlinks|pageprops&exintro=1&explaintext=1&exlimit=20&piprop=original|thumbnail&pithumbsize=400&pilimit=50&pilicense=any&lllang=ko&lllimit=50&ppprop=disambiguation&titles=${encodeURIComponent(titles.join("|"))}`;
        const j = await fetchJson<{ query?: { normalized?: { from: string; to: string }[]; redirects?: { from: string; to: string }[]; pages: Record<string, Page> } }>(url, { headers: WIKI_H, retries: 3, timeoutMs: 30_000 });
        const q = j.query ?? { pages: {} };
        const resolve = (t: string) => { let x = t; for (const n of q.normalized ?? []) if (n.from === x) x = n.to; for (let k = 0; k < 3; k++) for (const r of q.redirects ?? []) if (r.from === x) x = r.to; return x; };
        const byTitle = new Map(Object.values(q.pages).map((p) => [p.title, p]));
        for (const m of batch) {
          let hit: { thumb: string | null; extract: string | null; ko: string | null; page: string | null; desc: string | null } | null = null;
          for (const c of candidatesOf(m)) {
            const pg = byTitle.get(resolve(c));
            if (!pg || pg.missing || pg.pageprops?.disambiguation !== undefined) continue;
            const ex = pg.extract ?? "";
            if (!/\bfilm\b|\bmovie\b/i.test(ex.slice(0, 400))) continue;
            const thumb = pg.original?.source ?? pg.thumbnail?.source ?? null;
            hit = { thumb, extract: ex || null, ko: pg.langlinks?.find((l) => l.lang === "ko")?.["*"]?.replace(/\s*\(.*?영화\)$/, "") ?? null, page: pg.title, desc: null };
            break;
          }
          cp.wiki[m.tconst] = hit;
        }
      } catch (e) {
        failed += batch.length;
        for (const m of batch) cp.wiki[m.tconst] = null;
        log(S, `wiki batch fail @${i}: ${(e as Error).message}`);
      }
      done += batch.length;
      if (done % 120 === 0 || done === need.length) { saveCheckpoint(S, cp); log(S, `wiki ${done}/${need.length}`); }
      await new Promise((r) => setTimeout(r, 250));
    }
    saveCheckpoint(S, cp);

    const rows: UpsertRow[] = movies.map((m) => {
      const w = cp.wiki[m.tconst];
      const genreNames = m.genres.map((g) => GENRE_KO[g] ?? g);
      return {
        categoryId: catId,
        title: w?.ko ?? m.title,
        titleOriginal: w?.ko ? m.title : m.original !== m.title ? m.original : null,
        description: truncate(w?.extract, 1500),
        posterUrl: w?.thumb ?? null,
        releaseYear: m.year,
        releaseDate: m.year ? `${m.year}-01-01` : null,
        externalSource: "imdb",
        externalId: m.tconst,
        externalUrl: `https://www.imdb.com/title/${m.tconst}/`,
        externalScore: m.rating,
        externalScoreCount: m.votes,
        isAdult: false,
        metadata: { kind: "movie", genres: genreNames, platforms: [], runtime: m.runtime, title_en: m.title, title_original: m.original, imdb_id: m.tconst, wiki_page: w?.page ?? null, wiki_desc: w?.desc ?? null, has_poster: !!w?.thumb },
        genreNames,
      };
    });
    let upserted = 0;
    for (let i = 0; i < rows.length; i += 200) {
      upserted += await upsertContents(db, rows.slice(i, i + 200), args.dryRun);
      await updateRun(db, runId, { itemsUpserted: upserted, itemsFailed: failed });
    }
    log(S, `posters: ${rows.filter((r) => r.posterUrl).length}/${rows.length}, ko titles: ${rows.filter((r) => cp.wiki[r.externalId!]?.ko).length}`);
    return { upserted, failed };
  },
};
