/**
 * 합성 활동 데이터 시드 — 전부 profiles.is_seed=true 유저로 생성
 *   pnpm seed:synthetic [--reset] [--users=600]
 *  1) 시드 유저 600  2) 별점(SQL 일괄)  3) 리뷰  4) 댓글/대댓글  5) 대결  6) 게시글  7) 유저 카테고리 3개
 *  8) 통계 재계산  9) 8주 스냅샷(지난주 ±0~8 흔들기)  10) 프로필 카운터·뱃지
 */
import "@/scripts/env";
import { sql } from "drizzle-orm";
import { createDirectDb } from "@/lib/db/direct";
import { battles, categories, comments, contents, posts, profiles, reviews } from "@/lib/db/schema";
import { COMMENT_TEMPLATES, nickname, pickKind, POST_BODIES, POST_TITLES, REPLY_TEMPLATES, reviewText, USER_CATEGORY_SEEDS } from "./seed/templates";
import { slugify } from "./collect/common";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260903);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const randInt = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
const pareto = (min: number, alpha = 1.5) => Math.floor(min / Math.pow(1 - rnd(), 1 / alpha));
const seedUuid = (i: number) => `5eed0000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000 - Math.floor(rnd() * 86_400_000));
const recentDate = () => (rnd() < 0.3 ? daysAgo(randInt(0, 6)) : daysAgo(randInt(7, 120)));
const argNum = (k: string, d: number) => Number(process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d);

async function main() {
  const reset = process.argv.includes("--reset");
  const USERS = argNum("users", 600);
  const { db, close } = createDirectDb(1);
  const t0 = Date.now();
  const log = (m: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);

  await db.execute(sql`set app.bulk = 'on'`);
  await db.execute(sql`set statement_timeout = 0`);

  if (reset) {
    log("reset: deleting seed users (cascade) & seed categories");
    await db.execute(sql`delete from rank_snapshots`);
    await db.execute(sql`delete from battles`);
    await db.execute(sql`delete from categories where is_official = false and created_by in (select id from profiles where is_seed)`);
    await db.execute(sql`delete from comments where user_id in (select id from profiles where is_seed)`);
    await db.execute(sql`delete from profiles where is_seed`);
  }

  /* 1) 시드 유저 */
  log(`users: ${USERS}`);
  const userIds: string[] = [];
  const used = new Set<string>();
  const userRows = [];
  for (let i = 0; i < USERS; i++) {
    let nick = nickname(i, rnd);
    while (used.has(nick)) nick = nickname(i, rnd) + randInt(1, 999);
    used.add(nick);
    const id = seedUuid(i);
    userIds.push(id);
    userRows.push({ id, nickname: nick, avatarUrl: `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(nick)}`, isSeed: true, bio: rnd() < 0.3 ? pick(["티어표는 과학이다", "별점은 솔직하게", "S티어 수호자", "1등 안티", "정주행 전문", "댓글로 싸우는 게 취미"]) : null, createdAt: daysAgo(randInt(1, 400)) });
  }
  for (let i = 0; i < userRows.length; i += 200) {
    await db.insert(profiles).values(userRows.slice(i, i + 200)).onConflictDoUpdate({ target: profiles.id, set: { nickname: sql`excluded.nickname`, avatarUrl: sql`excluded.avatar_url`, isSeed: true } });
  }
  const seedUsersSql = sql`(select array_agg(id order by id) from profiles where is_seed)`;

  /* 2) 별점 — SQL 일괄. n = clamp(round(log1p(count)*20*(0.5+rand)),3,400), score ~ N(ext/2, 0.7) → 0.5 단위 */
  log("ratings (SQL bulk)…");
  await db.execute(sql`
    with u as (select ${seedUsersSql} as ids),
    src as (
      select c.id content_id,
        least(400, greatest(3, round(ln(1 + coalesce(c.external_score_count, 50)) * 20 * (0.5 + random()))))::int n,
        coalesce(c.external_score / 2.0, 3.5) mean
      from contents c join categories k on k.id = c.category_id where k.is_official
        and not exists (select 1 from ratings r where r.content_id = c.id)
    ),
    gen as (
      select s.content_id, (u.ids)[1 + floor(random() * cardinality(u.ids))::int] user_id,
        least(5.0, greatest(0.5, round((s.mean + 0.7 * sqrt(-2 * ln(greatest(random(), 1e-9))) * cos(2 * pi() * random())) * 2) / 2.0)) score,
        case when random() < 0.3 then now() - (random() * 7) * interval '1 day' else now() - (7 + random() * 113) * interval '1 day' end created_at
      from src s, u, generate_series(1, s.n) g
    )
    insert into ratings(content_id, user_id, score, created_at, updated_at)
    select content_id, user_id, score, created_at, created_at from gen
    on conflict (content_id, user_id) do nothing`);
  const rc = await db.execute<{ n: number }>(sql`select count(*)::int n from ratings`);
  log(`ratings total: ${rc[0].n}`);

  /* 3) 리뷰 — 카테고리별 상위 30%(external_score 기준) 에 3~15개 */
  log("reviews…");
  const cats = await db.select({ id: categories.id, slug: categories.slug }).from(categories).where(sql`is_official`);
  for (const cat of cats) {
    const top = await db.execute<{ id: number; title: string }>(sql`
      select id, title from contents where category_id = ${cat.id} and external_score is not null
        and not exists (select 1 from reviews rv where rv.content_id = contents.id)
      order by external_score desc, external_score_count desc nulls last
      limit (select ceil(count(*) * 0.3) from contents where category_id = ${cat.id})`);
    const rows: (typeof reviews.$inferInsert)[] = [];
    for (const c of top) {
      const n = randInt(3, 15);
      // 이 콘텐츠에 별점 준 유저 중에서 고른다 (rating_id 연결)
      const raters = await db.execute<{ id: number; user_id: string; score: string }>(sql`select id, user_id, score from ratings where content_id = ${c.id} order by random() limit ${n}`);
      for (const r of raters) {
        const s = Number(r.score);
        const kind = pickKind(s, rnd);
        rows.push({ contentId: c.id, userId: r.user_id, ratingId: r.id, score: r.score, body: reviewText(cat.slug, c.title, kind, rnd), isSpoiler: rnd() < 0.2, likeCount: pareto(1) - 1, dislikeCount: rnd() < 0.4 ? pareto(1) - 1 : 0, createdAt: recentDate() });
      }
    }
    for (let i = 0; i < rows.length; i += 500) await db.insert(reviews).values(rows.slice(i, i + 500)).onConflictDoNothing();
    log(`  ${cat.slug}: ${rows.length} reviews`);
  }

  /* 4) 댓글/대댓글 — 리뷰당 0~6 */
  log("comments…");
  const allReviews = await db.execute<{ id: number; created_at: Date }>(sql`select id, created_at from reviews`);
  let commentCount = 0;
  let buf: (typeof comments.$inferInsert)[] = [];
  const flush = async () => {
    if (!buf.length) return;
    const inserted = await db.insert(comments).values(buf).returning({ id: comments.id, targetId: comments.targetId, parentId: comments.parentId });
    buf = [];
    return inserted;
  };
  for (const r of allReviews) {
    const n = rnd() < 0.35 ? 0 : randInt(1, 6);
    for (let i = 0; i < n; i++) buf.push({ targetType: "review", targetId: r.id, userId: pick(userIds), body: pick(COMMENT_TEMPLATES), likeCount: rnd() < 0.5 ? pareto(1) - 1 : 0, createdAt: new Date(Math.min(Date.now(), new Date(r.created_at).getTime() + randInt(0, 5) * 86_400_000)) });
    commentCount += n;
    if (buf.length >= 1000) {
      const ins = await flush();
      // 대댓글: 방금 넣은 댓글의 30% 에 1~3개
      const replies: (typeof comments.$inferInsert)[] = [];
      for (const c of ins ?? []) if (rnd() < 0.3) for (let j = 0, m = randInt(1, 3); j < m; j++) replies.push({ targetType: "review", targetId: c.targetId, parentId: c.id, userId: pick(userIds), body: pick(REPLY_TEMPLATES), likeCount: rnd() < 0.3 ? pareto(1) - 1 : 0 });
      if (replies.length) { await db.insert(comments).values(replies); commentCount += replies.length; }
    }
  }
  await flush();
  log(`comments total: ${commentCount}`);

  /* 5) 대결 — 카테고리별 상위 100 안에서 100개, 투표 50~3000, ELO 근사 */
  log("battles…");
  await db.execute(sql`update content_stats set elo = 1500, elo_wins = 0, elo_losses = 0`);
  for (const cat of cats) {
    const existing = await db.execute<{ n: number }>(sql`select count(*)::int n from battles where category_id = ${cat.id}`);
    if ((existing[0]?.n ?? 0) >= 100) continue;
    const top = await db.execute<{ id: number }>(sql`select id from contents where category_id = ${cat.id} order by external_score desc nulls last, external_score_count desc nulls last limit 100`);
    if (top.length < 2) continue;
    const rows: (typeof battles.$inferInsert)[] = [];
    const seen = new Set<string>();
    while (rows.length < Math.min(100, (top.length * (top.length - 1)) / 2)) {
      const a = pick(top).id, b = pick(top).id;
      if (a === b || seen.has(`${a}-${b}`) || seen.has(`${b}-${a}`)) continue;
      seen.add(`${a}-${b}`);
      const total = randInt(50, 3000);
      const pa = 0.2 + rnd() * 0.6;
      const va = Math.round(total * pa);
      rows.push({ categoryId: cat.id, contentAId: a, contentBId: b, votesA: va, votesB: total - va, isFeatured: rows.length < 5, createdAt: daysAgo(randInt(0, 60)) });
    }
    await db.insert(battles).values(rows);
  }
  // ELO 근사: 1500 + 600 * (승-패)/(총+30), wins/losses = 득표 합
  await db.execute(sql`
    with agg as (
      select content_id, sum(w) w, sum(l) l from (
        select content_a_id content_id, votes_a w, votes_b l from battles
        union all select content_b_id, votes_b, votes_a from battles) x group by content_id)
    update content_stats s set elo = 1500 + 600.0 * (a.w - a.l) / (a.w + a.l + 30), elo_wins = a.w, elo_losses = a.l
    from agg a where a.content_id = s.content_id`);

  /* 6) 게시글 — 카테고리별 40개 + 댓글 */
  log("posts…");
  for (const cat of cats) {
    const existingPosts = await db.execute<{ n: number }>(sql`select count(*)::int n from posts where category_id = ${cat.id}`);
    if ((existingPosts[0]?.n ?? 0) >= 40) continue;
    const top = await db.execute<{ id: number; title: string }>(sql`select id, title from contents where category_id = ${cat.id} order by external_score desc nulls last limit 60`);
    if (top.length < 2) continue;
    const rows: (typeof posts.$inferInsert)[] = [];
    for (let i = 0; i < 40; i++) {
      const tag = pick(["free", "debate", "debate", "question", "recommend"] as const);
      const a = pick(top), b = pick(top);
      const title = pick(POST_TITLES[tag]).replace("{a}", a.title.length > 20 ? a.title.slice(0, 18) + "…" : a.title).replace("{b}", b.title.length > 20 ? b.title.slice(0, 18) + "…" : b.title);
      rows.push({ categoryId: cat.id, userId: pick(userIds), contentId: rnd() < 0.7 ? a.id : null, title, body: pick(POST_BODIES), tag, likeCount: pareto(1) - 1, dislikeCount: rnd() < 0.3 ? pareto(1) - 1 : 0, viewCount: pareto(20), isPinned: i < 3, createdAt: daysAgo(randInt(0, 45)) });
    }
    const ins = await db.insert(posts).values(rows).returning({ id: posts.id });
    const cm: (typeof comments.$inferInsert)[] = [];
    for (const p of ins) for (let i = 0, n = randInt(0, 12); i < n; i++) cm.push({ targetType: "post", targetId: p.id, userId: pick(userIds), body: pick([...COMMENT_TEMPLATES, ...REPLY_TEMPLATES]), likeCount: rnd() < 0.4 ? pareto(1) - 1 : 0 });
    if (cm.length) await db.insert(comments).values(cm);
    await db.execute(sql`update posts p set comment_count = (select count(*) from comments c where c.target_type = 'post' and c.target_id = p.id) where p.category_id = ${cat.id}`);
  }

  /* 7) 유저 카테고리 3개 */
  log("user categories…");
  const creator = userIds[0];
  for (const uc of USER_CATEGORY_SEEDS) {
    const [cat] = await db
      .insert(categories)
      .values({ slug: uc.slug, nameKo: uc.nameKo, nameEn: uc.nameEn, icon: uc.icon, color: uc.color, description: uc.description, isOfficial: false, isApproved: true, createdBy: creator, sortOrder: 900 })
      .onConflictDoUpdate({ target: categories.slug, set: { nameKo: uc.nameKo, description: uc.description, createdBy: creator } })
      .returning({ id: categories.id });
    await db
      .insert(contents)
      .values(uc.items.map((it, i) => ({ categoryId: cat.id, slug: slugify(it.title, i + 1), title: it.title, description: it.description ?? null, posterUrl: it.image ?? null, externalSource: "user" as const, externalId: `${uc.slug}-${i + 1}`, externalUrl: it.link ?? null, createdBy: creator, metadata: { kind: "user" } })))
      .onConflictDoNothing();
    await db.execute(sql`
      with u as (select ${seedUsersSql} ids), src as (select id content_id, 20 + floor(random() * 120)::int n, 2.5 + random() * 2 mean from contents where category_id = ${cat.id}),
      gen as (select s.content_id, (u.ids)[1 + floor(random() * cardinality(u.ids))::int] user_id,
        least(5.0, greatest(0.5, round((s.mean + 0.8 * sqrt(-2 * ln(greatest(random(), 1e-9))) * cos(2 * pi() * random())) * 2) / 2.0)) score,
        now() - (random() * 60) * interval '1 day' created_at from src s, u, generate_series(1, s.n))
      insert into ratings(content_id, user_id, score, created_at, updated_at) select content_id, user_id, score, created_at, created_at from gen on conflict do nothing`);
  }
  await db.execute(sql`update profiles set badges = badges || '["category_creator"]'::jsonb where id = ${creator} and not badges ? 'category_creator'`);

  /* 8) 통계 재계산 */
  log("recompute…");
  const allCats = await db.execute<{ id: number; slug: string }>(sql`select id, slug from categories order by id`);
  for (const c of allCats) {
    await db.execute(sql`select refresh_all_content_stats(${c.id})`);
    await db.execute(sql`select recompute_category(${c.id})`);
  }

  /* 9) 스냅샷 8주 — 현재 순위에서 랜덤워크. 지난주: ±0~8, 상위 5% 중 일부는 NEW(스냅샷 없음) */
  log("snapshots…");
  await db.execute(sql`delete from rank_snapshots`);
  for (let w = 1; w <= 8; w++) {
    await db.execute(sql`
      insert into rank_snapshots(content_id, category_id, rank, bayesian_score, tier, snapshot_week)
      select s.content_id, s.category_id,
        greatest(1, s.rank + (floor(random() * 17) - 8)::int * ${w}),
        greatest(0, s.bayesian_score - (random() * 0.3 * ${w})),
        s.tier,
        (date_trunc('week', now()) - ${w} * interval '7 days')::date
      from content_stats s
      where s.rank is not null
        and not (random() < 0.06 and s.rank <= greatest(5, (select count(*) * 0.05 from content_stats x where x.category_id = s.category_id)))
      on conflict do nothing`);
  }
  for (const c of allCats) await db.execute(sql`select recompute_category(${c.id})`);

  /* 10) 프로필 카운터 · 뱃지 */
  log("profile counters & badges…");
  await db.execute(sql`update profiles p set rating_count = (select count(*) from ratings r where r.user_id = p.id), review_count = (select count(*) from reviews r where r.user_id = p.id) where is_seed`);
  await db.execute(sql`
    update profiles p set badges = (
      select coalesce(jsonb_agg(b), '[]'::jsonb) from (
        select 'first_rating' b where p.rating_count >= 1
        union all select 'ratings_10' where p.rating_count >= 10
        union all select 'ratings_100' where p.rating_count >= 100
        union all select 'ratings_1000' where p.rating_count >= 1000
        union all select 'reviews_10' where p.review_count >= 10
        union all select 'best_review' where exists (select 1 from reviews r where r.user_id = p.id and r.like_count >= 50)
        union all select 'category_creator' where exists (select 1 from categories c where c.created_by = p.id)
      ) x) where is_seed`);

  const summary = await db.execute<Record<string, unknown>>(sql`
    select (select count(*) from profiles where is_seed) seed_users, (select count(*) from ratings) ratings, (select count(*) from reviews) reviews,
      (select count(*) from comments) comments, (select count(*) from battles) battles, (select count(*) from posts) posts, (select count(*) from rank_snapshots) snapshots`);
  console.table(summary);
  log("seed done");
  await close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
