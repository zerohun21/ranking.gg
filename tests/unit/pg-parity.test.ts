/**
 * Postgres `recompute_category` (pglite) 와 TS `rankCategory` 결과 일치 테스트
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync } from "node:fs";
import path from "node:path";
import { rankCategory, type RankInput } from "@/lib/ranking/rank";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let pg: PGlite;

beforeAll(async () => {
  pg = new PGlite({ extensions: { pg_trgm } });
  await pg.exec("create extension if not exists pg_trgm;");
  const init = readFileSync(path.join(process.cwd(), "drizzle/0000_init.sql"), "utf8");
  for (const stmt of init.split("--> statement-breakpoint")) {
    if (stmt.trim()) await pg.exec(stmt);
  }
  await pg.exec(readFileSync(path.join(process.cwd(), "drizzle/custom/0001_core_functions.sql"), "utf8"));
});
afterAll(async () => {
  await pg?.close();
});

describe("recompute_category parity", () => {
  it("TS rankCategory == PG recompute_category (300 items, random ratings)", async () => {
    const rnd = mulberry32(42);
    await pg.exec(`insert into categories(slug, name_ko, name_en) values ('movie','영화','Movie');`);
    const cat = (await pg.query<{ id: number }>("select id from categories")).rows[0].id;

    // 60 users
    const users: string[] = [];
    for (let i = 0; i < 60; i++) {
      const id = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
      users.push(id);
      await pg.query("insert into profiles(id, nickname, is_seed) values ($1,$2,true)", [id, `u${i}`]);
    }

    // 300 contents, various rating counts (0..60)
    const items: RankInput[] = [];
    await pg.exec("set app.bulk = 'on'");
    for (let i = 0; i < 300; i++) {
      const title = `T${String(Math.floor(rnd() * 1000)).padStart(4, "0")}-${i}`;
      const approved = rnd() > 0.03;
      const res = await pg.query<{ id: number }>(
        "insert into contents(category_id, slug, title, is_approved, external_source, external_id) values ($1,$2,$3,$4,'tmdb',$5) returning id",
        [cat, `s-${i}`, title, approved, String(i)],
      );
      const id = res.rows[0].id;
      const n = rnd() < 0.1 ? 0 : Math.floor(rnd() * 60);
      const mean = 1 + rnd() * 4;
      let sum = 0;
      const chosen = [...users].sort(() => rnd() - 0.5).slice(0, n);
      for (const u of chosen) {
        let s = Math.round((mean + (rnd() - 0.5) * 2) * 2) / 2;
        s = Math.min(5, Math.max(0.5, s));
        sum += s;
        await pg.query("insert into ratings(content_id, user_id, score) values ($1,$2,$3)", [id, u, s.toFixed(1)]);
      }
      items.push({ id, title, avg: n ? sum / n : 0, count: n, approved });
    }
    // 지난주 스냅샷(임의)
    for (const it of items.slice(0, 50)) {
      await pg.query(
        "insert into rank_snapshots(content_id, category_id, rank, bayesian_score, snapshot_week) values ($1,$2,$3,0,(date_trunc('week', now()) - interval '7 days')::date)",
        [it.id, cat, Math.floor(rnd() * 300) + 1],
      );
    }
    const prev = new Map<number, number>();
    for (const r of (await pg.query<{ content_id: number; rank: number }>("select content_id, rank from rank_snapshots")).rows) prev.set(r.content_id, r.rank);
    for (const it of items) it.prevRank = prev.get(it.id) ?? null;

    await pg.query("select refresh_all_content_stats($1)", [cat]);
    await pg.query("select recompute_category($1)", [cat]);

    // PG 가 계산한 rating_avg 를 그대로 TS 입력으로 사용 (numeric(4,3) 반올림 동일화)
    const stats = (
      await pg.query<{ content_id: number; rating_avg: string; rating_count: number; bayesian_score: string; rank: number | null; tier: string | null; prev_rank: number | null; rank_delta: number | null }>(
        "select content_id, rating_avg, rating_count, bayesian_score, rank, tier, prev_rank, rank_delta from content_stats order by content_id",
      )
    ).rows;
    const byId = new Map(stats.map((s) => [s.content_id, s]));
    const tsInput = items.map((it) => ({ ...it, avg: Number(byId.get(it.id)!.rating_avg), count: byId.get(it.id)!.rating_count }));
    const ts = rankCategory(tsInput);

    let mismatches = 0;
    for (const t of ts) {
      const p = byId.get(t.id)!;
      const ok =
        Math.abs(Number(p.bayesian_score) - t.bayesianScore) < 0.011 &&
        p.rank === t.rank &&
        (p.tier ?? null) === t.tier &&
        (p.prev_rank ?? null) === t.prevRank &&
        (p.rank_delta ?? null) === t.rankDelta;
      if (!ok) {
        mismatches++;
        if (mismatches <= 5) console.log("mismatch", t, p);
      }
    }
    expect(mismatches).toBe(0);

    const tiers = stats.filter((s) => s.tier).map((s) => s.tier);
    expect(tiers).toContain("S");
    expect(tiers).toContain("D");
    // 승인 안 된 항목은 rank null
    for (const it of items.filter((i) => i.approved === false)) expect(byId.get(it.id)!.rank).toBeNull();
  });

  it("rating trigger updates stats & rank live", async () => {
    await pg.exec("set app.bulk = 'off'");
    const top = (await pg.query<{ content_id: number; rank: number }>("select content_id, rank from content_stats where rank is not null order by rank limit 1")).rows[0];
    const u = "00000000-0000-4000-8000-000000000099";
    await pg.query("insert into profiles(id, nickname) values ($1,'live')", [u]);
    const before = (await pg.query<{ rating_count: number }>("select rating_count from content_stats where content_id=$1", [top.content_id])).rows[0];
    await pg.query("insert into ratings(content_id, user_id, score) values ($1,$2,0.5)", [top.content_id, u]);
    const after = (await pg.query<{ rating_count: number; dist_1: number }>("select rating_count, dist_1 from content_stats where content_id=$1", [top.content_id])).rows[0];
    expect(after.rating_count).toBe(before.rating_count + 1);
    expect(after.dist_1).toBeGreaterThanOrEqual(1);
    const prof = (await pg.query<{ rating_count: number }>("select rating_count from profiles where id=$1", [u])).rows[0];
    expect(prof.rating_count).toBe(1);
  });

  it("battle vote trigger applies ELO K=24", async () => {
    const ids = (await pg.query<{ id: number }>("select id from contents order by id limit 2")).rows.map((r) => r.id);
    const cat = (await pg.query<{ id: number }>("select id from categories")).rows[0].id;
    const b = (await pg.query<{ id: number }>("insert into battles(category_id, content_a_id, content_b_id) values ($1,$2,$3) returning id", [cat, ids[0], ids[1]])).rows[0];
    await pg.query("insert into battle_votes(battle_id, user_id, choice) values ($1,$2,'a')", [b.id, "00000000-0000-4000-8000-000000000001"]);
    const a = (await pg.query<{ elo: number; elo_wins: number }>("select elo, elo_wins from content_stats where content_id=$1", [ids[0]])).rows[0];
    const bb = (await pg.query<{ elo: number; elo_losses: number }>("select elo, elo_losses from content_stats where content_id=$1", [ids[1]])).rows[0];
    expect(a.elo).toBeCloseTo(1512);
    expect(bb.elo).toBeCloseTo(1488);
    expect(a.elo_wins).toBe(1);
    expect(bb.elo_losses).toBe(1);
    const votes = (await pg.query<{ votes_a: number }>("select votes_a from battles where id=$1", [b.id])).rows[0];
    expect(votes.votes_a).toBe(1);
  });

  it("search_contents finds by trigram", async () => {
    const rows = (await pg.query<{ content_id: number; sim: number }>("select * from search_contents('T0', 5)")).rows;
    expect(rows.length).toBeGreaterThan(0);
  });
});
