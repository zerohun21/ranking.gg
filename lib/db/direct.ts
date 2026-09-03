import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/** 스크립트 전용: 직접 연결(5432). 없으면 DATABASE_URL 폴백. */
export function createDirectDb(max = 6) {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DIRECT_URL / DATABASE_URL is not set");
  const client = postgres(url, { prepare: false, max, idle_timeout: 30, connect_timeout: 15 });
  const db = drizzle(client, { schema });
  return { db, client, close: () => client.end({ timeout: 5 }) };
}
export type DirectDb = ReturnType<typeof createDirectDb>["db"];
