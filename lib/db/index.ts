import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = PostgresJsDatabase<typeof schema>;

declare global {
  var __rankingDb: Db | undefined;
}

function createDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // Supabase 트랜잭션 풀러(6543)는 prepared statement 미지원 → prepare:false
  const client = postgres(url, { prepare: false, max: 10, idle_timeout: 20, connect_timeout: 10 });
  return drizzle(client, { schema });
}

function getDb(): Db {
  if (!globalThis.__rankingDb) globalThis.__rankingDb = createDb();
  return globalThis.__rankingDb;
}

/** 지연 초기화 — 빌드 타임(env 없음)에 import 만으로 실패하지 않도록 Proxy 로 감싼다 */
export const db: Db = new Proxy({} as Db, {
  get(_t, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const v = real[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(real) : v;
  },
});

export type { Db };
export { schema };
