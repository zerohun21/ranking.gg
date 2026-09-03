/**
 * 카카오웹툰 (키 불필요) — 2026-09-03 curl 로 확인
 *  연재: gateway-kw.kakao.com/section/v2/timetables/days?placement=timetable_{mon..sun}   (스펙의 placement=timetable 은 404)
 *  완결: placement=timetable_completed (2,058개, 단일 응답)
 *  상세: /decorator/v2/decorator/contents/{id} → synopsis, genre, status, authors, thumbnailImage
 *  이미지: featuredCharacterImageA / backgroundImage 에 ".webp" 를 붙이면 Referer 없이 200 (원본 URL 그대로는 404)
 *  sorting.popularity / views 는 1 = 가장 인기 인 순위값 → 점수 추정에 사용
 */
import { fetchJson, loadCheckpoint, log, pLimit, progress, saveCheckpoint, truncate, type Collector, type UpsertRow, upsertContents, updateRun } from "./common";

const H = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0 Safari/537.36", "Accept-Language": "ko", Referer: "https://webtoon.kakao.com/", Accept: "application/json" };
const BASE = "https://gateway-kw.kakao.com";
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_KO: Record<string, string> = { mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일" };

type Card = {
  content: { id: number; title: string; seoId?: string; adult?: boolean; authors?: { name: string; type: string }[]; featuredCharacterImageA?: string; backgroundImage?: string; badges?: { title: string }[] };
  sorting?: { views?: number; popularity?: number; createdAt?: number };
  genreFilters?: string[];
  additional?: { label?: string };
};
type Timetable = { data: { title?: string; cardGroups: { cards: Card[] }[] }[] };
type Detail = { data?: { synopsis?: string; genre?: string; status?: string; adult?: boolean; authors?: { name: string; type: string }[]; thumbnailImage?: string; backgroundImage?: string; featuredCharacterImageA?: string; seoId?: string; statistics?: Record<string, number> } };
type Listed = { card: Card; days: string[]; completed: boolean; popRank: number; listSize: number };
type CP = { listed: Record<string, Listed>; listDone: boolean; done: string[] };

const img = (u?: string | null) => (u ? `${u}.webp` : null);

export const kakaoCollector: Collector = {
  source: "kakao",
  async run({ db, args, categoryIds, runId }) {
    const S = "kakao";
    const catId = categoryIds.get("webtoon")!;
    const cp = loadCheckpoint<CP>(S, { listed: {}, listDone: false, done: [] }, args.reset);
    const done = new Set(cp.done);

    if (!cp.listDone) {
      const add = (cards: Card[], day: string | null, completed: boolean) => {
        const n = cards.length;
        for (const c of cards) {
          const k = String(c.content.id);
          const prev = cp.listed[k];
          const popRank = c.sorting?.popularity ?? c.sorting?.views ?? n;
          cp.listed[k] = {
            card: prev?.card ?? c,
            days: [...new Set([...(prev?.days ?? []), ...(day ? [day] : [])])],
            completed: prev?.completed || completed,
            popRank: prev ? Math.min(prev.popRank, popRank) : popRank,
            listSize: Math.max(prev?.listSize ?? 0, n),
          };
        }
      };
      for (const d of DAYS) {
        const j = await fetchJson<Timetable>(`${BASE}/section/v2/timetables/days?placement=timetable_${d}`, { headers: H });
        const cards = j.data.flatMap((s) => s.cardGroups.flatMap((g) => g.cards));
        add(cards, d, false);
        log(S, `day ${d}: ${cards.length}`);
      }
      const done_ = await fetchJson<Timetable>(`${BASE}/section/v2/timetables/days?placement=timetable_completed`, { headers: H, timeoutMs: 60_000 });
      const ccards = done_.data.flatMap((s) => s.cardGroups.flatMap((g) => g.cards));
      add(ccards, null, true);
      log(S, `completed: ${ccards.length} → listed ${Object.keys(cp.listed).length}`);
      cp.listDone = true;
      saveCheckpoint(S, cp);
    }

    let ids = Object.keys(cp.listed).filter((k) => !done.has(k));
    if (args.limit) ids = ids.slice(0, args.limit);
    log(S, `to process: ${ids.length} (done ${done.size})`);

    const limit = pLimit(args.concurrency ?? 5);
    let upserted = 0, failed = 0, processed = 0;
    const total = ids.length;

    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      const rows = (
        await Promise.all(
          batch.map((k) =>
            limit(async (): Promise<UpsertRow | null> => {
              const L = cp.listed[k];
              const c = L.card.content;
              try {
                let d: Detail["data"] | undefined;
                try {
                  d = (await fetchJson<Detail>(`${BASE}/decorator/v2/decorator/contents/${k}`, { headers: H, retries: 3 })).data;
                } catch (e) {
                  log(S, `detail fail ${k}: ${(e as Error).message}`);
                }
                const authors = (d?.authors ?? c.authors ?? []).filter((a) => a.type !== "PUBLISHER").map((a) => a.name).filter((v, i, a) => a.indexOf(v) === i);
                const publisher = (d?.authors ?? c.authors ?? []).find((a) => a.type === "PUBLISHER")?.name;
                const genre = d?.genre ?? null;
                const genreNames = genre ? genre.split(/[\/,·]/).map((g) => g.trim()).filter(Boolean) : (L.card.genreFilters ?? []).filter((g) => g !== "all");
                const status = L.completed || d?.status === "END" || d?.status === "COMPLETED" ? "finished" : d?.status === "REST" || d?.status === "PAUSE" ? "rest" : "ongoing";
                // 인기 순위 → 점수 추정 (1위 9.5 … 꼴찌 7.0), 표본 수 추정 (순위 역수)
                const pct = L.listSize > 1 ? (L.popRank - 1) / (L.listSize - 1) : 0;
                const score = Math.round((9.5 - 2.5 * Math.min(1, Math.max(0, pct))) * 100) / 100;
                const count = Math.round(300_000 * Math.pow(1 / Math.max(1, L.popRank), 0.6));
                return {
                  categoryId: catId,
                  title: c.title,
                  titleOriginal: null,
                  description: truncate(d?.synopsis, 1500),
                  posterUrl: img(d?.featuredCharacterImageA ?? c.featuredCharacterImageA) ?? img(d?.thumbnailImage) ?? null,
                  backdropUrl: img(d?.backgroundImage ?? c.backgroundImage),
                  externalSource: "kakao",
                  externalId: k,
                  externalUrl: `https://webtoon.kakao.com/content/${encodeURIComponent(d?.seoId ?? c.seoId ?? "")}/${k}`,
                  externalScore: score,
                  externalScoreCount: count,
                  isAdult: !!(d?.adult ?? c.adult),
                  metadata: {
                    kind: "webtoon",
                    platform: "kakao",
                    platforms: ["kakao"],
                    author: authors.join(" / "),
                    authors,
                    publisher: publisher ?? null,
                    weekdays: L.days.map((x) => DAY_KO[x] ?? x),
                    status,
                    genres: genreNames,
                    genre_raw: genre,
                    popularity_rank: L.popRank,
                    badges: (c.badges ?? []).map((b) => b.title),
                    score_estimated: true,
                  },
                  genreNames,
                } satisfies UpsertRow;
              } catch (e) {
                failed++;
                log(S, `fail ${k}: ${(e as Error).message}`);
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
      for (const r of rows) done.add(r.externalId!);
      cp.done = [...done];
      saveCheckpoint(S, cp);
      await updateRun(db, runId, { itemsUpserted: upserted, itemsFailed: failed, cursor: { processed, total } });
    }
    return { upserted, failed };
  },
};
