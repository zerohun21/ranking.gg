import { parseArgs, runCollector } from "./common";
import { naverCollector } from "./naver-webtoon";
import { kakaoCollector } from "./kakao-webtoon";
import { tmdbCollectors } from "./tmdb";
import { rawgCollector } from "./rawg";
import { appleCollector } from "./apple-music";
import { booksCollector } from "./books";
import { jikanCollector } from "./jikan";
import { tvmazeCollector } from "./tvmaze";
import { steamCollector } from "./steam";
import { booksAltCollector } from "./books-alt";
import { imdbWikiCollector } from "./imdb-wiki";
import { anilistCollector } from "./anilist";

export const COLLECTORS = {
  naver: [naverCollector],
  kakao: [kakaoCollector],
  tmdb: tmdbCollectors,
  "tmdb-movie": [tmdbCollectors[0]],
  "tmdb-tv": [tmdbCollectors[1]],
  "tmdb-anime": [tmdbCollectors[2]],
  rawg: [rawgCollector],
  apple: [appleCollector],
  books: [booksCollector],
  jikan: [jikanCollector],
  tvmaze: [tvmazeCollector],
  steam: [steamCollector],
  "books-alt": [booksAltCollector],
  "imdb-wiki": [imdbWikiCollector],
  anilist: [anilistCollector],
};
export type SourceKey = keyof typeof COLLECTORS;

async function main() {
  const args = parseArgs();
  const key = (args.source ?? "") as SourceKey;
  if (!COLLECTORS[key]) {
    console.error(`--source=<${Object.keys(COLLECTORS).join("|")}> [--limit=N] [--dry-run] [--reset] [--concurrency=N]`);
    process.exit(1);
  }
  for (const c of COLLECTORS[key]) await runCollector(c, args);
}

if (process.argv[1]?.endsWith("index.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
