/**
 * 네이버 웹툰 (비공식 JSON, 키 불필요) — 2026-09-03 curl 로 필드 확인
 *  목록: /api/webtoon/titlelist/weekday?week=mon..sun,dailyPlus&order=user  → titleList[]
 *  완결: /api/webtoon/titlelist/finished?page=N&order=UPDATE            → titleList[], pageInfo{totalPages}
 *  상세: /api/article/list/info?titleId=                                 → synopsis, favoriteCount, age, curationTagList, gfpAdCustomParam.genreTypes
 *  썸네일은 Referer 필수 → Storage 업로드(webp 400), 실패 시 /api/img 프록시
 */
import { fetchBuffer, fetchJson, loadCheckpoint, log, pLimit, progress, proxyImageUrl, saveCheckpoint, truncate, uploadThumb, type Collector, type UpsertRow, upsertContents, updateRun } from "./common";

const H = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36", Referer: "https://comic.naver.com/", Accept: "application/json" };
const BASE = "https://comic.naver.com";
const WEEKS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun", "dailyPlus"];
const WEEK_KO: Record<string, string> = { MONDAY: "월", TUESDAY: "화", WEDNESDAY: "수", THURSDAY: "목", FRIDAY: "금", SATURDAY: "토", SUNDAY: "일" };
const GENRE_KO: Record<string, string> = {
  ACTION: "액션", DRAMA: "드라마", PURE: "순정", FANTASY: "판타지", COMIC: "개그", THRILL: "스릴러", DAILY: "일상", HISTORICAL: "무협/사극", SPORTS: "스포츠", SENSIBILITY: "감성", EPISODE: "에피소드", OMNIBUS: "옴니버스", STORY: "스토리", SF: "SF", HORROR: "공포", ROMANCE: "로맨스", MARTIAL_ARTS: "무협", SCHOOL: "학원",
};

type ListItem = { titleId: number; titleName: string; author: string; thumbnailUrl: string; starScore: number; adult: boolean; rest: boolean; finish: boolean; new: boolean; up: boolean; writers?: { name: string }[]; painters?: { name: string }[] };
type Info = {
  titleId: number; titleName: string; synopsis?: string; favoriteCount?: number; age?: { type: string; description: string };
  publishDayOfWeekList?: string[]; finished?: boolean; rest?: boolean; dailyPass?: boolean; thumbnailUrl?: string; posterThumbnailUrl?: string;
  curationTagList?: { tagName: string }[]; gfpAdCustomParam?: { genreTypes?: string[]; tags?: string[] }; firstArticle?: { serviceDateDescription?: string; no?: number };
  webtoonLevelCode?: string;
};
type CP = { listed: Record<string, { item: ListItem; weeks: string[] }>; listDone: boolean; finishedPage: number; done: string[] };

export const naverCollector: Collector = {
  source: "naver",
  async run({ db, args, categoryIds, runId }) {
    const S = "naver";
    const catId = categoryIds.get("webtoon")!;
    const cp = loadCheckpoint<CP>(S, { listed: {}, listDone: false, finishedPage: 0, done: [] }, args.reset);
    const done = new Set(cp.done);

    // 1) 목록 수집
    if (!cp.listDone) {
      for (const w of WEEKS) {
        const j = await fetchJson<{ titleList: ListItem[] }>(`${BASE}/api/webtoon/titlelist/weekday?week=${w}&order=user`, { headers: H });
        for (const it of j.titleList) {
          const k = String(it.titleId);
          const prev = cp.listed[k];
          cp.listed[k] = { item: it, weeks: [...new Set([...(prev?.weeks ?? []), w])] };
        }
        log(S, `weekday ${w}: ${j.titleList.length}`);
      }
      let page = cp.finishedPage + 1;
      let totalPages = Infinity;
      while (page <= totalPages) {
        const j = await fetchJson<{ titleList: ListItem[]; pageInfo: { totalPages: number } }>(`${BASE}/api/webtoon/titlelist/finished?page=${page}&order=UPDATE`, { headers: H });
        totalPages = j.pageInfo.totalPages;
        for (const it of j.titleList) {
          const k = String(it.titleId);
          if (!cp.listed[k]) cp.listed[k] = { item: it, weeks: [] };
        }
        cp.finishedPage = page;
        if (page % 10 === 0 || page === totalPages) {
          log(S, `finished page ${page}/${totalPages} (listed ${Object.keys(cp.listed).length})`);
          saveCheckpoint(S, cp);
        }
        page++;
      }
      cp.listDone = true;
      saveCheckpoint(S, cp);
    }

    let ids = Object.keys(cp.listed).filter((k) => !done.has(k));
    if (args.limit) ids = ids.slice(0, args.limit);
    log(S, `to process: ${ids.length} (already done ${done.size})`);

    // 2) 상세 + 썸네일 + upsert (배치 100)
    const limit = pLimit(args.concurrency ?? 5);
    const imgLimit = pLimit(4);
    let upserted = 0;
    let failed = 0;
    let processed = 0;
    const total = ids.length;

    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      const rows = (
        await Promise.all(
          batch.map((k) =>
            limit(async (): Promise<UpsertRow | null> => {
              const { item, weeks } = cp.listed[k];
              try {
                let info: Info | null = null;
                try {
                  info = await fetchJson<Info>(`${BASE}/api/article/list/info?titleId=${k}`, { headers: H, retries: 3 });
                } catch (e) {
                  log(S, `info fail ${k}: ${(e as Error).message}`);
                }
                const thumbSrc = info?.posterThumbnailUrl ?? item.thumbnailUrl;
                let poster: string | null = null;
                if (thumbSrc && !args.dryRun) {
                  poster = await imgLimit(async () => {
                    const got = await fetchBuffer(thumbSrc, { headers: H });
                    return got ? uploadThumb(`naver/${k}.webp`, got.buf) : null;
                  });
                }
                if (!poster && thumbSrc) poster = proxyImageUrl(thumbSrc, "https://comic.naver.com/");
                const genreTypes = info?.gfpAdCustomParam?.genreTypes ?? [];
                const genreNames = genreTypes.map((g) => GENRE_KO[g] ?? g);
                const tags = (info?.curationTagList ?? []).map((t) => t.tagName).slice(0, 15);
                const status = item.finish || info?.finished ? "finished" : item.rest || info?.rest ? "rest" : "ongoing";
                const weekdays = (info?.publishDayOfWeekList ?? []).map((d) => WEEK_KO[d] ?? d);
                const favorite = info?.favoriteCount ?? 0;
                const yearMatch = /(\d{4})/.exec(info?.firstArticle?.serviceDateDescription ?? "");
                return {
                  categoryId: catId,
                  title: item.titleName,
                  titleOriginal: null,
                  description: truncate(info?.synopsis, 1500),
                  posterUrl: poster,
                  backdropUrl: null,
                  releaseYear: yearMatch ? Number(yearMatch[1]) : null,
                  externalSource: "naver",
                  externalId: k,
                  externalUrl: `https://comic.naver.com/webtoon/list?titleId=${k}`,
                  externalScore: item.starScore ? Math.round(item.starScore * 100) / 100 : null,
                  externalScoreCount: favorite || null,
                  isAdult: !!item.adult,
                  metadata: {
                    kind: "webtoon",
                    platform: "naver",
                    platforms: ["naver"],
                    author: item.author,
                    authors: [...(item.writers ?? []).map((w) => w.name), ...(item.painters ?? []).map((p) => p.name)].filter((v, i, a) => a.indexOf(v) === i),
                    weekdays: weekdays.length ? weekdays : weeks.filter((w) => w !== "dailyPlus").map((w) => ({ mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일" })[w] ?? w),
                    status,
                    age: info?.age?.description ?? null,
                    tags,
                    genres: genreNames,
                    favorite_count: favorite,
                    daily_pass: !!info?.dailyPass,
                    is_new: !!item.new,
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
