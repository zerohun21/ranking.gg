/**
 * 도서 — 알라딘 TTB(있으면 우선) → Google Books(키 있으면) → 없으면 스킵
 *  ※ 2026-09-03 확인: Google Books 익명 호출은 429 (일일 쿼터 0) → 키 필수
 */
import { dateOf, fetchJson, loadCheckpoint, log, pLimit, saveCheckpoint, truncate, yearOf, type Collector, type UpsertRow, upsertContents } from "./common";

type AladinItem = { itemId: number; title: string; author?: string; pubDate?: string; description?: string; isbn13?: string; cover?: string; categoryName?: string; publisher?: string; customerReviewRank?: number; link?: string; adult?: boolean; bestRank?: number };
type GItem = { id: string; volumeInfo: { title: string; subtitle?: string; authors?: string[]; publisher?: string; publishedDate?: string; description?: string; categories?: string[]; averageRating?: number; ratingsCount?: number; imageLinks?: { thumbnail?: string; smallThumbnail?: string }; pageCount?: number; industryIdentifiers?: { type: string; identifier: string }[]; infoLink?: string; language?: string; maturityRating?: string } };
type CP = { done: string[]; items: Record<string, UpsertRow> };

const ALADIN_CATS: { id: number; name: string }[] = [
  { id: 0, name: "전체" }, { id: 1, name: "소설/시/희곡" }, { id: 170, name: "경제경영" }, { id: 798, name: "인문학" }, { id: 656, name: "과학" }, { id: 336, name: "자기계발" },
  { id: 55889, name: "에세이" }, { id: 2551, name: "만화" }, { id: 1108, name: "사회과학" }, { id: 74, name: "역사" }, { id: 55890, name: "건강/취미" }, { id: 1196, name: "여행" },
  { id: 351, name: "컴퓨터/모바일" }, { id: 517, name: "예술/대중문화" }, { id: 1237, name: "종교/역학" }, { id: 1137, name: "청소년" }, { id: 1230, name: "좋은부모" }, { id: 2913, name: "고전" }, { id: 50993, name: "과학" },
  { id: 8257, name: "대학교재" }, { id: 50927, name: "요리/살림" }, { id: 50950, name: "외국어" },
];
const ALADIN_QUERIES = ["Bestseller", "ItemNewSpecial", "BlogBest"];
const G_SUBJECTS = ["fiction", "소설", "에세이", "자기계발", "경제", "경영", "과학", "역사", "철학", "심리학", "만화", "판타지", "추리", "SF", "시", "인문", "사회", "정치", "예술", "여행", "요리", "건강", "교육", "종교", "컴퓨터", "프로그래밍", "수학", "청소년", "어린이", "한국문학"];

function normalizeCover(u?: string) {
  if (!u) return null;
  return u.replace(/\/cover(sum|150|200)?\//, "/cover500/").replace(/^http:/, "https:");
}

export const booksCollector: Collector = {
  source: "books",
  async run({ db, args, categoryIds }) {
    const S = "books";
    const catId = categoryIds.get("book")!;
    const cp = loadCheckpoint<CP>(S, { done: [], items: {} }, args.reset);
    const aladin = process.env.ALADIN_TTB_KEY;
    const gkey = process.env.GOOGLE_BOOKS_API_KEY;
    const limit = pLimit(3);

    if (aladin) {
      const jobs: { q: string; cat: number; name: string; start: number }[] = [];
      for (const q of ALADIN_QUERIES) for (const c of ALADIN_CATS) for (let s = 1; s <= (q === "Bestseller" ? 10 : 4); s++) jobs.push({ q, cat: c.id, name: c.name, start: s });
      const todo = jobs.filter((j) => !cp.done.includes(`${j.q}:${j.cat}:${j.start}`));
      log(S, `aladin jobs: ${todo.length}/${jobs.length}`);
      await Promise.all(
        todo.map((j) =>
          limit(async () => {
            try {
              const url = `https://www.aladin.co.kr/ttb/api/ItemList.aspx?ttbkey=${aladin}&QueryType=${j.q}&SearchTarget=Book&CategoryId=${j.cat}&MaxResults=50&start=${j.start}&output=js&Version=20131101&Cover=Big`;
              const res = await fetchJson<{ item?: AladinItem[]; errorCode?: number; errorMessage?: string }>(url, { retries: 3 });
              if (res.errorCode) throw new Error(res.errorMessage ?? `aladin error ${res.errorCode}`);
              let added = 0;
              for (const it of res.item ?? []) {
                const id = String(it.itemId);
                if (cp.items[id]) continue;
                const genres = (it.categoryName ?? "").split(">").map((s) => s.trim()).filter(Boolean).slice(1, 3);
                cp.items[id] = {
                  categoryId: catId,
                  title: it.title.replace(/\s*-\s*.*$/, "").trim() || it.title,
                  titleOriginal: null,
                  description: truncate(it.description, 1500),
                  posterUrl: normalizeCover(it.cover),
                  releaseDate: dateOf(it.pubDate),
                  releaseYear: yearOf(it.pubDate),
                  externalSource: "aladin",
                  externalId: id,
                  externalUrl: it.link ?? `https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=${id}`,
                  externalScore: it.customerReviewRank ? it.customerReviewRank : null,
                  externalScoreCount: it.bestRank ? Math.round(5000 / Math.sqrt(it.bestRank)) : 200,
                  isAdult: !!it.adult,
                  metadata: { kind: "book", author: it.author ?? null, authors: (it.author ?? "").split(",").map((s) => s.replace(/\(.*?\)/g, "").trim()).filter(Boolean).slice(0, 3), publisher: it.publisher ?? null, isbn: it.isbn13 ?? null, genres, category_path: it.categoryName ?? null, list: j.q, list_category: j.name, best_rank: it.bestRank ?? null },
                  genreNames: genres,
                };
                added++;
              }
              cp.done.push(`${j.q}:${j.cat}:${j.start}`);
              saveCheckpoint(S, cp);
              if (added) log(S, `aladin ${j.q}/${j.name}/${j.start}: +${added} (total ${Object.keys(cp.items).length})`);
            } catch (e) {
              log(S, `aladin fail ${j.q}:${j.cat}:${j.start}: ${(e as Error).message}`);
            }
          }),
        ),
      );
    } else if (gkey) {
      const jobs: { s: string; idx: number }[] = [];
      for (const s of G_SUBJECTS) for (let i = 0; i < 5; i++) jobs.push({ s, idx: i * 40 });
      const todo = jobs.filter((j) => !cp.done.includes(`${j.s}:${j.idx}`));
      log(S, `google books jobs: ${todo.length}/${jobs.length}`);
      await Promise.all(
        todo.map((j) =>
          limit(async () => {
            try {
              const url = `https://www.googleapis.com/books/v1/volumes?q=subject:${encodeURIComponent(j.s)}&langRestrict=ko&orderBy=relevance&maxResults=40&startIndex=${j.idx}&printType=books&key=${gkey}`;
              const res = await fetchJson<{ items?: GItem[] }>(url, { retries: 3 });
              let added = 0;
              for (const it of res.items ?? []) {
                const v = it.volumeInfo;
                if (!v?.title || cp.items[it.id]) continue;
                const thumb = (v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail)?.replace(/^http:/, "https:").replace("zoom=1", "zoom=2").replace("&edge=curl", "") ?? null;
                const genres = (v.categories ?? []).slice(0, 3);
                cp.items[it.id] = {
                  categoryId: catId,
                  title: v.title,
                  titleOriginal: v.subtitle ?? null,
                  description: truncate(v.description, 1500),
                  posterUrl: thumb,
                  releaseDate: dateOf(v.publishedDate),
                  releaseYear: yearOf(v.publishedDate),
                  externalSource: "google_books",
                  externalId: it.id,
                  externalUrl: v.infoLink ?? `https://books.google.com/books?id=${it.id}`,
                  externalScore: v.averageRating ? v.averageRating * 2 : null,
                  externalScoreCount: v.ratingsCount ?? null,
                  isAdult: v.maturityRating === "MATURE",
                  metadata: { kind: "book", author: v.authors?.join(", ") ?? null, authors: v.authors ?? [], publisher: v.publisher ?? null, pageCount: v.pageCount ?? null, isbn: v.industryIdentifiers?.find((x) => x.type === "ISBN_13")?.identifier ?? null, genres, subject: j.s },
                  genreNames: genres,
                };
                added++;
              }
              cp.done.push(`${j.s}:${j.idx}`);
              saveCheckpoint(S, cp);
              log(S, `google ${j.s}/${j.idx}: +${added} (total ${Object.keys(cp.items).length})`);
            } catch (e) {
              log(S, `google fail ${j.s}:${j.idx}: ${(e as Error).message}`);
            }
          }),
        ),
      );
    } else {
      log(S, "SKIP — ALADIN_TTB_KEY / GOOGLE_BOOKS_API_KEY 둘 다 없음 (익명 Google Books 는 쿼터 0)");
      return { upserted: 0, failed: 0 };
    }

    let rows = Object.values(cp.items);
    if (args.limit) rows = rows.slice(0, args.limit);
    let upserted = 0;
    for (let i = 0; i < rows.length; i += 200) upserted += await upsertContents(db, rows.slice(i, i + 200), args.dryRun);
    return { upserted, failed: 0 };
  },
};
