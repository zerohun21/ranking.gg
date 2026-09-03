/**
 * 전체 수집: naver → kakao → tmdb(3) → rawg → apple → books. 실패한 소스는 건너뛰고 계속.
 * 결과 요약을 .cache/collect/summary.json 에 기록 (docs/DATA.md 작성용)
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs, runCollector } from "./collect/common";
import { COLLECTORS, type SourceKey } from "./collect/index";

// 키 없는 소스 우선. TMDB/RAWG/books 는 키가 있을 때만 의미 있음
const ORDER: SourceKey[] = ["naver", "kakao", "apple", "anilist", "tvmaze", "steam", "books-alt", "imdb-wiki", "tmdb", "rawg", "books"];

async function main() {
  const args = parseArgs();
  const only = args.source ? (args.source.split(",") as SourceKey[]) : ORDER;
  const file = path.join(process.cwd(), ".cache", "collect", "summary.json");
  mkdirSync(path.dirname(file), { recursive: true });
  const summary: Record<string, { upserted: number; failed: number; minutes: number; error?: string; at: string }> = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  for (const key of only) {
    for (const c of COLLECTORS[key]) {
      const t = Date.now();
      try {
        const r = await runCollector(c, { ...args, source: key });
        summary[c.source] = { ...r, minutes: +((Date.now() - t) / 60000).toFixed(1), at: new Date().toISOString() };
      } catch (e) {
        summary[c.source] = { upserted: 0, failed: 0, minutes: +((Date.now() - t) / 60000).toFixed(1), error: (e as Error).message, at: new Date().toISOString() };
      }
      writeFileSync(file, JSON.stringify(summary, null, 2));
    }
  }
  console.log(JSON.stringify(summary, null, 2));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
