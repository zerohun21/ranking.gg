/**
 * 수집 공통: fetch(백오프) · 동시성 · 체크포인트 · upsert · 로그
 */
import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import pLimit from "p-limit";
import { eq, sql } from "drizzle-orm";
import { createDirectDb, type DirectDb } from "@/lib/db/direct";
import { categories, contents, collectionRuns, contentGenres, genres, type NewContent } from "@/lib/db/schema";
import { OFFICIAL_CATEGORIES } from "@/lib/constants/categories";

export type Args = { source?: string; limit?: number; dryRun: boolean; reset: boolean; concurrency?: number };

export function parseArgs(argv = process.argv.slice(2)): Args {
  const a: Args = { dryRun: false, reset: false };
  for (const s of argv) {
    const [k, v] = s.replace(/^--/, "").split("=");
    if (k === "source") a.source = v;
    else if (k === "limit") a.limit = Number(v);
    else if (k === "dry-run") a.dryRun = true;
    else if (k === "reset") a.reset = true;
    else if (k === "concurrency") a.concurrency = Number(v);
  }
  return a;
}

/* ───────────── logging ───────────── */
const t0 = Date.now();
export function log(source: string, msg: string) {
  const s = ((Date.now() - t0) / 1000).toFixed(0).padStart(5);
  console.log(`[${s}s][${source}] ${msg}`);
}
export function progress(source: string, done: number, total: number, extra = "") {
  if (done % 50 === 0 || done === total) {
    const pct = total ? Math.round((done / total) * 100) : 0;
    log(source, `${done}/${total} (${pct}%) ${extra}`);
  }
}

/* ───────────── fetch with backoff ───────────── */
export class HttpError extends Error {
  constructor(public status: number, public url: string, public body?: string) {
    super(`HTTP ${status} ${url}`);
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchJson<T = unknown>(url: string, init: RequestInit & { retries?: number; timeoutMs?: number } = {}): Promise<T> {
  const { retries = 5, timeoutMs = 30_000, ...rest } = init;
  let attempt = 0;
  for (;;) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...rest, signal: ctrl.signal });
      clearTimeout(timer);
      if (res.status === 429 || res.status >= 500) {
        if (attempt >= retries) throw new HttpError(res.status, url, await res.text().catch(() => ""));
        const ra = Number(res.headers.get("retry-after"));
        const wait = ra > 0 ? ra * 1000 : Math.min(60_000, 1000 * 2 ** attempt) + Math.random() * 500;
        attempt++;
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new HttpError(res.status, url, await res.text().catch(() => ""));
      return (await res.json()) as T;
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof HttpError) throw e;
      if (attempt >= retries) throw e;
      attempt++;
      await sleep(Math.min(30_000, 1000 * 2 ** attempt));
    }
  }
}

export async function fetchBuffer(url: string, init: RequestInit & { retries?: number } = {}): Promise<{ buf: Buffer; contentType: string } | null> {
  const { retries = 3, ...rest } = init;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, rest);
      if (res.status === 404 || res.status === 403) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { buf: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get("content-type") ?? "" };
    } catch {
      if (attempt === retries) return null;
      await sleep(500 * 2 ** attempt);
    }
  }
  return null;
}

export { pLimit };

/* ───────────── checkpoint ───────────── */
const CACHE_DIR = path.join(process.cwd(), ".cache", "collect");
export function loadCheckpoint<T extends object>(source: string, initial: T, reset = false): T {
  mkdirSync(CACHE_DIR, { recursive: true });
  const f = path.join(CACHE_DIR, `${source}.json`);
  if (reset || !existsSync(f)) return initial;
  try {
    return { ...initial, ...(JSON.parse(readFileSync(f, "utf8")) as T) };
  } catch {
    return initial;
  }
}
export function saveCheckpoint<T extends object>(source: string, cp: T) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(path.join(CACHE_DIR, `${source}.json`), JSON.stringify(cp));
}

/* ───────────── slug ───────────── */
export function slugify(title: string, externalId: string | number): string {
  const base = title
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60)
    .replace(/^-|-$/g, "");
  return `${base || "item"}-${externalId}`;
}

export function yearOf(date?: string | null): number | null {
  if (!date) return null;
  const y = Number(String(date).slice(0, 4));
  return Number.isFinite(y) && y > 1800 ? y : null;
}
export function dateOf(date?: string | null): string | null {
  if (!date) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(date));
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const y = /^(\d{4})$/.exec(String(date));
  return y ? `${y[1]}-01-01` : null;
}
export function truncate(s: string | null | undefined, n: number): string | null {
  if (!s) return null;
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

/* ───────────── DB helpers ───────────── */
export async function ensureCategories(db: DirectDb): Promise<Map<string, number>> {
  for (const c of OFFICIAL_CATEGORIES) {
    await db
      .insert(categories)
      .values({ slug: c.slug, nameKo: c.nameKo, nameEn: c.nameEn, icon: c.icon, color: c.color, isOfficial: true, sortOrder: c.sortOrder, description: c.description })
      .onConflictDoUpdate({
        target: categories.slug,
        set: { nameKo: c.nameKo, nameEn: c.nameEn, icon: c.icon, color: c.color, isOfficial: true, sortOrder: c.sortOrder, description: c.description },
      });
  }
  const rows = await db.select({ id: categories.id, slug: categories.slug }).from(categories);
  return new Map(rows.map((r) => [r.slug, r.id]));
}

export type UpsertRow = Omit<NewContent, "slug"> & { slug?: string; genreNames?: string[] };

/** external_source+external_id 기준 upsert. 반환: 처리 건수 */
export async function upsertContents(db: DirectDb, rows: UpsertRow[], dryRun = false): Promise<number> {
  if (rows.length === 0) return 0;
  const values: NewContent[] = rows.map((r) => ({
    ...r,
    slug: r.slug ?? slugify(r.title, r.externalId ?? "x"),
    genreNames: undefined,
  }));
  for (const v of values) delete (v as Record<string, unknown>).genreNames;
  if (dryRun) {
    console.log(JSON.stringify(values.slice(0, 2), null, 1).slice(0, 1500));
    return values.length;
  }
  const inserted = await db
    .insert(contents)
    .values(values)
    .onConflictDoUpdate({
      target: [contents.externalSource, contents.externalId],
      set: {
        title: sql`excluded.title`,
        titleOriginal: sql`excluded.title_original`,
        description: sql`excluded.description`,
        posterUrl: sql`coalesce(excluded.poster_url, ${contents.posterUrl})`,
        backdropUrl: sql`coalesce(excluded.backdrop_url, ${contents.backdropUrl})`,
        releaseDate: sql`excluded.release_date`,
        releaseYear: sql`excluded.release_year`,
        externalUrl: sql`excluded.external_url`,
        externalScore: sql`excluded.external_score`,
        externalScoreCount: sql`excluded.external_score_count`,
        metadata: sql`${contents.metadata} || excluded.metadata`,
        isAdult: sql`excluded.is_adult`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: contents.id, externalId: contents.externalId, categoryId: contents.categoryId });

  // genres
  const byExt = new Map(inserted.map((r) => [r.externalId, r]));
  const genreRows: { contentId: number; categoryId: number; name: string }[] = [];
  for (const r of rows) {
    const ins = byExt.get(r.externalId ?? null);
    if (!ins || !r.genreNames?.length) continue;
    for (const g of new Set(r.genreNames)) if (g) genreRows.push({ contentId: ins.id, categoryId: ins.categoryId, name: g });
  }
  if (genreRows.length) await syncGenres(db, genreRows);
  return inserted.length;
}

async function syncGenres(db: DirectDb, rows: { contentId: number; categoryId: number; name: string }[]) {
  const uniq = new Map<string, { categoryId: number; name: string }>();
  for (const r of rows) uniq.set(`${r.categoryId}:${r.name}`, { categoryId: r.categoryId, name: r.name });
  const gvals = [...uniq.values()].map((g) => ({ categoryId: g.categoryId, slug: slugify(g.name, "").replace(/-$/, "") || g.name, nameKo: g.name, nameEn: g.name }));
  if (gvals.length) await db.insert(genres).values(gvals).onConflictDoNothing();
  const all = await db.select({ id: genres.id, categoryId: genres.categoryId, slug: genres.slug }).from(genres);
  const gid = new Map(all.map((g) => [`${g.categoryId}:${g.slug}`, g.id]));
  const links = rows
    .map((r) => ({ contentId: r.contentId, genreId: gid.get(`${r.categoryId}:${slugify(r.name, "").replace(/-$/, "") || r.name}`) }))
    .filter((l): l is { contentId: number; genreId: number } => typeof l.genreId === "number");
  for (let i = 0; i < links.length; i += 500) {
    await db.insert(contentGenres).values(links.slice(i, i + 500)).onConflictDoNothing();
  }
}

/* ───────────── collection_runs ───────────── */
export async function startRun(db: DirectDb, source: string, cursor: Record<string, unknown> = {}) {
  const [r] = await db.insert(collectionRuns).values({ source, status: "running", cursor }).returning({ id: collectionRuns.id });
  return r.id;
}
export async function updateRun(db: DirectDb, id: number, patch: { cursor?: Record<string, unknown>; itemsUpserted?: number; itemsFailed?: number }) {
  await db.update(collectionRuns).set(patch).where(eq(collectionRuns.id, id));
}
export async function finishRun(db: DirectDb, id: number, ok: boolean, error?: string) {
  await db
    .update(collectionRuns)
    .set({ status: ok ? "done" : "failed", finishedAt: new Date(), error: error ?? null })
    .where(eq(collectionRuns.id, id));
}

/* ───────────── Storage (네이버 썸네일) ───────────── */
export async function uploadThumb(key: string, buf: Buffer): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !svc) return null;
  try {
    const sharp = (await import("sharp")).default;
    const webp = await sharp(buf).resize({ width: 400, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(url, svc, { auth: { persistSession: false } });
    const { error } = await sb.storage.from("thumbs").upload(key, webp, { contentType: "image/webp", upsert: true, cacheControl: "31536000" });
    if (error) throw error;
    return `${url}/storage/v1/object/public/thumbs/${key}`;
  } catch (e) {
    log("storage", `upload failed ${key}: ${(e as Error).message}`);
    return null;
  }
}

export function proxyImageUrl(u: string, referer: string): string {
  return `/api/img?u=${encodeURIComponent(u)}&ref=${encodeURIComponent(referer)}`;
}

/* ───────────── collector contract ───────────── */
export type CollectorContext = { db: DirectDb; args: Args; categoryIds: Map<string, number>; runId: number };
export type Collector = { source: string; run: (ctx: CollectorContext) => Promise<{ upserted: number; failed: number }> };

export async function runCollector(c: Collector, args: Args) {
  const { db, close } = createDirectDb(8);
  const categoryIds = await ensureCategories(db);
  const runId = await startRun(db, c.source, { args: args as unknown as Record<string, unknown> });
  const started = Date.now();
  try {
    const r = await c.run({ db, args, categoryIds, runId });
    await updateRun(db, runId, { itemsUpserted: r.upserted, itemsFailed: r.failed });
    await finishRun(db, runId, true);
    log(c.source, `DONE upserted=${r.upserted} failed=${r.failed} in ${((Date.now() - started) / 60000).toFixed(1)}min`);
    return r;
  } catch (e) {
    await finishRun(db, runId, false, String((e as Error).stack ?? e));
    log(c.source, `FAILED: ${(e as Error).message}`);
    throw e;
  } finally {
    await close();
  }
}
