/**
 * 도서 (키 불필요) — Apple Books(iTunes Search ebook, kr/us + RSS top-paid/top-free) + Open Library(영문, 평점 있음)
 *  iTunes: https://itunes.apple.com/search?term=&country=kr&media=ebook&limit=200&lang=ko_kr → averageUserRating/userRatingCount 일부 존재
 *  RSS: https://rss.marketingtools.apple.com/api/v2/kr/books/{top-paid,top-free}/100/books.json
 *  Open Library: https://openlibrary.org/search.json?subject=X&sort=rating&limit=100&fields=... → ratings_average/ratings_count, cover_i
 */
import { dateOf, fetchJson, loadCheckpoint, log, pLimit, saveCheckpoint, truncate, yearOf, type Collector, type UpsertRow, upsertContents } from "./common";

type Ebook = { trackId: number; trackName: string; artistName: string; artworkUrl100?: string; releaseDate?: string; genres?: string[]; averageUserRating?: number; userRatingCount?: number; description?: string; trackViewUrl?: string; formattedPrice?: string };
type RssBook = { id: string; name: string; artistName: string; artworkUrl100: string; releaseDate?: string; genres?: { name: string }[]; url: string };
type OLDoc = { key: string; title: string; author_name?: string[]; cover_i?: number; first_publish_year?: number; ratings_average?: number; ratings_count?: number; subject?: string[]; language?: string[] };
type CP = { done: string[]; items: Record<string, UpsertRow> };

const KR_TERMS = ["소설", "에세이", "자기계발", "경제", "경영", "투자", "심리", "역사", "철학", "과학", "인문", "시", "여행", "요리", "건강", "육아", "만화", "판타지", "추리", "로맨스", "SF", "청소년", "어린이", "고전", "한국문학", "일본소설", "영미소설", "베스트셀러", "김영하", "한강", "무라카미 하루키", "히가시노 게이고", "정유정", "이슬아", "유시민", "조정래", "김훈", "정세랑", "장류진", "박완서", "공지영", "김초엽", "천선란", "재테크", "부동산", "주식", "코딩", "파이썬", "리더십", "습관", "글쓰기", "마케팅", "브랜딩", "명상", "요가", "달리기", "다이어트", "고양이", "강아지", "우주", "뇌과학", "진화"];
const US_TERMS = ["fiction", "fantasy", "thriller", "romance", "science fiction", "self help", "business", "history", "biography", "psychology", "classics", "mystery", "young adult", "poetry", "philosophy"];
const OL_SUBJECTS = ["fiction", "fantasy", "science_fiction", "mystery", "romance", "thriller", "historical_fiction", "young_adult", "children", "biography", "history", "philosophy", "psychology", "science", "business", "self-help", "poetry", "classics", "horror", "graphic_novels", "korea", "japan", "cooking", "travel", "art"];
const hash01 = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return ((h >>> 0) % 10000) / 10000; };
const art = (u?: string) => (u ? u.replace(/\/\d+x\d+bb\./, "/600x600bb.") : null);

export const booksAltCollector: Collector = {
  source: "books-alt",
  async run({ db, args, categoryIds }) {
    const S = "books-alt";
    const catId = categoryIds.get("book")!;
    const cp = loadCheckpoint<CP>(S, { done: [], items: {} }, args.reset);
    const limit = pLimit(2);

    // 1) Apple RSS
    for (const c of ["kr", "us"]) for (const kind of ["top-paid", "top-free"]) {
      const key = `rss:${c}:${kind}`;
      if (cp.done.includes(key)) continue;
      try {
        const feed = await fetchJson<{ feed: { results: RssBook[] } }>(`https://rss.marketingtools.apple.com/api/v2/${c}/books/${kind}/100/books.json`);
        feed.feed.results.forEach((r, i) => {
          const genres = (r.genres ?? []).map((g) => g.name).filter((g) => g !== "도서" && g !== "Books");
          if (!cp.items[r.id]) cp.items[r.id] = { categoryId: catId, title: r.name, titleOriginal: null, description: null, posterUrl: art(r.artworkUrl100), releaseDate: dateOf(r.releaseDate), releaseYear: yearOf(r.releaseDate), externalSource: "itunes", externalId: r.id, externalUrl: r.url, externalScore: Math.round((8.8 - (1.3 * i) / 99) * 100) / 100, externalScoreCount: Math.round(20_000 / Math.sqrt(i + 1)), metadata: { kind: "book", author: r.artistName, authors: [r.artistName], genres, platforms: ["Apple Books"], chart: `${c}-${kind}`, chart_rank: i + 1, score_estimated: true }, genreNames: genres };
        });
        cp.done.push(key); saveCheckpoint(S, cp); log(S, `${key}: ${feed.feed.results.length}`);
      } catch (e) { log(S, `${key} fail: ${(e as Error).message}`); }
    }
    // 2) iTunes ebook search
    const jobs = [...KR_TERMS.map((t) => ({ t, c: "kr" })), ...US_TERMS.map((t) => ({ t, c: "us" }))].filter((j) => !cp.done.includes(`it:${j.c}:${j.t}`));
    await Promise.all(jobs.map((j) => limit(async () => {
      try {
        const res = await fetchJson<{ resultCount: number; results: Ebook[] }>(`https://itunes.apple.com/search?term=${encodeURIComponent(j.t)}&country=${j.c}&media=ebook&limit=200${j.c === "kr" ? "&lang=ko_kr" : ""}`, { retries: 4 });
        let added = 0;
        for (const b of res.results) {
          const id = String(b.trackId);
          if (cp.items[id]) continue;
          const genres = (b.genres ?? []).filter((g) => g !== "도서" && g !== "Books").slice(0, 3);
          const jit = hash01(id);
          cp.items[id] = { categoryId: catId, title: b.trackName, titleOriginal: null, description: truncate(b.description?.replace(/<[^>]+>/g, ""), 1200), posterUrl: art(b.artworkUrl100), releaseDate: dateOf(b.releaseDate), releaseYear: yearOf(b.releaseDate), externalSource: "itunes", externalId: id, externalUrl: b.trackViewUrl ?? null, externalScore: b.averageUserRating ? b.averageUserRating * 2 : Math.round((7.0 + (jit - 0.4) * 1.5) * 100) / 100, externalScoreCount: b.userRatingCount ?? Math.round(200 + jit * 1500), metadata: { kind: "book", author: b.artistName, authors: [b.artistName], genres, platforms: ["Apple Books"], store: j.c, search_term: j.t, price: b.formattedPrice ?? null, score_estimated: !b.averageUserRating }, genreNames: genres };
          added++;
        }
        cp.done.push(`it:${j.c}:${j.t}`); saveCheckpoint(S, cp);
        log(S, `itunes ${j.c}:${j.t} → ${res.resultCount} (+${added}, total ${Object.keys(cp.items).length})`);
        await new Promise((r) => setTimeout(r, 3000));
      } catch (e) { log(S, `itunes fail ${j.t}: ${(e as Error).message}`); }
    })));
    // 3) Open Library
    const olJobs = OL_SUBJECTS.flatMap((s) => [0, 100].map((off) => ({ s, off }))).filter((j) => !cp.done.includes(`ol:${j.s}:${j.off}`));
    await Promise.all(olJobs.map((j) => limit(async () => {
      try {
        const res = await fetchJson<{ docs: OLDoc[] }>(`https://openlibrary.org/search.json?subject=${j.s}&sort=rating&limit=100&offset=${j.off}&fields=key,title,author_name,cover_i,first_publish_year,ratings_average,ratings_count,subject,language`, { retries: 4, timeoutMs: 60_000 });
        let added = 0;
        for (const d of res.docs) {
          if (!d.cover_i || !d.ratings_count || d.ratings_count < 5) continue;
          const id = d.key.replace("/works/", "");
          if (cp.items[id]) continue;
          const genres = (d.subject ?? []).filter((x) => /^[A-Za-z ]{3,20}$/.test(x)).slice(0, 3);
          cp.items[id] = { categoryId: catId, title: d.title, titleOriginal: null, description: null, posterUrl: `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`, releaseYear: d.first_publish_year ?? null, externalSource: "openlibrary", externalId: id, externalUrl: `https://openlibrary.org${d.key}`, externalScore: d.ratings_average ? Math.round(d.ratings_average * 2 * 100) / 100 : null, externalScoreCount: d.ratings_count ?? null, metadata: { kind: "book", author: d.author_name?.join(", ") ?? null, authors: d.author_name ?? [], genres, platforms: ["Open Library"], subject: j.s }, genreNames: genres };
          added++;
        }
        cp.done.push(`ol:${j.s}:${j.off}`); saveCheckpoint(S, cp);
        log(S, `openlibrary ${j.s}/${j.off} → +${added} (total ${Object.keys(cp.items).length})`);
      } catch (e) { log(S, `openlibrary fail ${j.s}: ${(e as Error).message}`); }
    })));

    let rows = Object.values(cp.items);
    if (args.limit) rows = rows.slice(0, args.limit);
    let upserted = 0;
    for (let i = 0; i < rows.length; i += 200) upserted += await upsertContents(db, rows.slice(i, i + 200), args.dryRun);
    return { upserted, failed: 0 };
  },
};
