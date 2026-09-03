/**
 * RAWG — 게임. 월 20,000 요청 한도 → 총 요청 ≤ 5,000 설계 (목록 ~115 + 상세 ≤ 4,500)
 */
import { dateOf, fetchJson, HttpError, loadCheckpoint, log, pLimit, progress, saveCheckpoint, truncate, yearOf, type Collector, type UpsertRow, upsertContents, updateRun } from "./common";

const API = "https://api.rawg.io/api";
const KEY = () => {
  const k = process.env.RAWG_API_KEY;
  if (!k) throw new Error("RAWG_API_KEY not set");
  return k;
};
type ListItem = {
  id: number; slug: string; name: string; released?: string | null; background_image?: string | null; rating?: number; ratings_count?: number; metacritic?: number | null;
  genres?: { name: string }[]; platforms?: { platform: { name: string } }[]; stores?: { store: { name: string } }[]; esrb_rating?: { name: string } | null; tags?: { name: string; language: string }[];
};
type Detail = ListItem & { description_raw?: string; developers?: { name: string }[]; publishers?: { name: string }[]; website?: string; name_original?: string; playtime?: number };
type CP = { phase: Record<string, number>; items: Record<string, ListItem>; done: string[] };

const PHASES = [
  { name: "added", pages: 75, params: "ordering=-added" },
  { name: "metacritic", pages: 25, params: "ordering=-metacritic&metacritic=60,100" },
  { name: "recent", pages: 13, params: "ordering=-added&dates=2023-01-01,2026-12-31" },
];

export function platformFamily(name: string): string {
  if (/PlayStation|PS Vita|PSP/i.test(name)) return "PlayStation";
  if (/Xbox/i.test(name)) return "Xbox";
  if (/Nintendo Switch/i.test(name)) return "Nintendo Switch";
  if (/^(iOS|Android)$/i.test(name)) return "Mobile";
  if (/^PC$|macOS|Linux/i.test(name)) return "PC";
  if (/Nintendo|Wii|GameCube|Game Boy|NES|SNES|3DS|DS/i.test(name)) return "Nintendo";
  return "Other";
}

export const rawgCollector: Collector = {
  source: "rawg",
  async run({ db, args, categoryIds, runId }) {
    const S = "rawg";
    const catId = categoryIds.get("game")!;
    const cp = loadCheckpoint<CP>(S, { phase: {}, items: {}, done: [] }, args.reset);
    const done = new Set(cp.done);
    const listLimit = pLimit(3);

    for (const ph of PHASES) {
      const start = (cp.phase[ph.name] ?? 0) + 1;
      if (start > ph.pages) continue;
      const pages = Array.from({ length: ph.pages - start + 1 }, (_, i) => start + i);
      await Promise.all(
        pages.map((p) =>
          listLimit(async () => {
            try {
              const j = await fetchJson<{ results: ListItem[] }>(`${API}/games?key=${KEY()}&${ph.params}&page_size=40&page=${p}`);
              for (const it of j.results) if (!cp.items[it.id]) cp.items[it.id] = it;
            } catch (e) {
              if (e instanceof HttpError && e.status === 404) return; // 페이지 끝
              throw e;
            }
          }),
        ),
      );
      cp.phase[ph.name] = ph.pages;
      saveCheckpoint(S, cp);
      log(S, `phase ${ph.name}: listed total ${Object.keys(cp.items).length}`);
    }

    let ids = Object.keys(cp.items).filter((k) => !done.has(k));
    if (args.limit) ids = ids.slice(0, args.limit);
    log(S, `to fetch details: ${ids.length} (done ${done.size})`);

    const limit = pLimit(args.concurrency ?? 5);
    let upserted = 0, failed = 0, processed = 0;
    const total = ids.length;
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      const rows = (
        await Promise.all(
          batch.map((id) =>
            limit(async (): Promise<UpsertRow | null> => {
              const base = cp.items[id];
              try {
                let d: Detail = base;
                try {
                  d = await fetchJson<Detail>(`${API}/games/${id}?key=${KEY()}`, { retries: 3 });
                } catch (e) {
                  log(S, `detail fail ${id}: ${(e as Error).message}`);
                }
                const platforms = [...new Set((d.platforms ?? base.platforms ?? []).map((p) => platformFamily(p.platform.name)))];
                const genreNames = (d.genres ?? base.genres ?? []).map((g) => g.name);
                const titleKo = (d.tags ?? []).find((t) => t.language === "kor")?.name ?? null;
                return {
                  categoryId: catId,
                  title: d.name ?? base.name,
                  titleOriginal: d.name_original && d.name_original !== d.name ? d.name_original : null,
                  description: truncate(d.description_raw, 600),
                  posterUrl: d.background_image ?? base.background_image ?? null,
                  backdropUrl: d.background_image ?? base.background_image ?? null,
                  releaseDate: dateOf(d.released),
                  releaseYear: yearOf(d.released),
                  externalSource: "rawg",
                  externalId: String(id),
                  externalUrl: `https://rawg.io/games/${d.slug ?? base.slug}`,
                  externalScore: d.rating ? Math.round(d.rating * 2 * 100) / 100 : null,
                  externalScoreCount: d.ratings_count ?? base.ratings_count ?? null,
                  isAdult: d.esrb_rating?.name === "Adults Only",
                  metadata: {
                    kind: "game",
                    genres: genreNames,
                    platforms,
                    platform_names: (d.platforms ?? []).map((p) => p.platform.name).slice(0, 12),
                    stores: (d.stores ?? []).map((s) => s.store.name),
                    developers: (d.developers ?? []).map((x) => x.name).slice(0, 3),
                    publishers: (d.publishers ?? []).map((x) => x.name).slice(0, 3),
                    metacritic: d.metacritic ?? null,
                    esrb: d.esrb_rating?.name ?? null,
                    playtime: d.playtime ?? null,
                    website: d.website || null,
                    title_ko: titleKo,
                  },
                  genreNames,
                } satisfies UpsertRow;
              } catch (e) {
                failed++;
                log(S, `fail ${id}: ${(e as Error).message}`);
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
