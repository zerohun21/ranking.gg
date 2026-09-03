-- ranking.gg core functions & triggers (auth 비의존 — pglite 테스트에서도 적용)
create extension if not exists pg_trgm;

-- ───────────── updated_at ─────────────
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','categories','contents','genres','content_stats','ratings','reviews','comments','battles','posts','reports','collection_runs']
  loop
    execute format('drop trigger if exists trg_%1$s_updated_at on public.%1$s', t);
    execute format('create trigger trg_%1$s_updated_at before update on public.%1$s for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ───────────── contents → content_stats 자동 생성 + item_count ─────────────
create or replace function public.ensure_content_stats() returns trigger language plpgsql as $$
begin
  insert into public.content_stats(content_id, category_id) values (new.id, new.category_id)
  on conflict (content_id) do update set category_id = excluded.category_id;
  return new;
end $$;
drop trigger if exists trg_contents_stats on public.contents;
create trigger trg_contents_stats after insert or update of category_id on public.contents
  for each row execute function public.ensure_content_stats();

create or replace function public.refresh_category_item_count(p_cat integer) returns void language sql as $$
  update public.categories c set item_count = (select count(*) from public.contents x where x.category_id = p_cat and x.is_approved)
  where c.id = p_cat;
$$;

-- ───────────── content_stats 집계 갱신 (별점) ─────────────
create or replace function public.refresh_content_stats(p_content integer) returns void language plpgsql as $$
begin
  insert into public.content_stats(content_id, category_id)
    select id, category_id from public.contents where id = p_content
  on conflict (content_id) do nothing;

  update public.content_stats s set
    rating_count = a.cnt,
    rating_avg   = coalesce(a.avg, 0),
    dist_1 = a.d1, dist_2 = a.d2, dist_3 = a.d3, dist_4 = a.d4, dist_5 = a.d5,
    dist_6 = a.d6, dist_7 = a.d7, dist_8 = a.d8, dist_9 = a.d9, dist_10 = a.d10
  from (
    select count(*) cnt, avg(score) avg,
      count(*) filter (where score = 0.5) d1, count(*) filter (where score = 1.0) d2,
      count(*) filter (where score = 1.5) d3, count(*) filter (where score = 2.0) d4,
      count(*) filter (where score = 2.5) d5, count(*) filter (where score = 3.0) d6,
      count(*) filter (where score = 3.5) d7, count(*) filter (where score = 4.0) d8,
      count(*) filter (where score = 4.5) d9, count(*) filter (where score = 5.0) d10
    from public.ratings where content_id = p_content
  ) a
  where s.content_id = p_content;
end $$;

-- 카테고리 전체 집계(시드 후 일괄용)
create or replace function public.refresh_all_content_stats(p_cat integer) returns void language plpgsql as $$
begin
  insert into public.content_stats(content_id, category_id)
    select id, category_id from public.contents where category_id = p_cat
  on conflict (content_id) do nothing;

  update public.content_stats s set
    rating_count = coalesce(a.cnt, 0),
    rating_avg   = coalesce(a.avg, 0),
    dist_1 = coalesce(a.d1,0), dist_2 = coalesce(a.d2,0), dist_3 = coalesce(a.d3,0), dist_4 = coalesce(a.d4,0), dist_5 = coalesce(a.d5,0),
    dist_6 = coalesce(a.d6,0), dist_7 = coalesce(a.d7,0), dist_8 = coalesce(a.d8,0), dist_9 = coalesce(a.d9,0), dist_10 = coalesce(a.d10,0),
    review_count  = coalesce(rv.cnt, 0),
    comment_count = coalesce(cm.cnt, 0)
  from public.contents c
  left join lateral (
    select count(*) cnt, avg(score) avg,
      count(*) filter (where score = 0.5) d1, count(*) filter (where score = 1.0) d2,
      count(*) filter (where score = 1.5) d3, count(*) filter (where score = 2.0) d4,
      count(*) filter (where score = 2.5) d5, count(*) filter (where score = 3.0) d6,
      count(*) filter (where score = 3.5) d7, count(*) filter (where score = 4.0) d8,
      count(*) filter (where score = 4.5) d9, count(*) filter (where score = 5.0) d10
    from public.ratings r where r.content_id = c.id
  ) a on true
  left join lateral (select count(*) cnt from public.reviews r where r.content_id = c.id and not r.is_hidden) rv on true
  left join lateral (
    select count(*) cnt from public.comments k
    where not k.is_hidden and (
      (k.target_type = 'content' and k.target_id = c.id) or
      (k.target_type = 'review' and k.target_id in (select id from public.reviews r where r.content_id = c.id))
    )
  ) cm on true
  where s.content_id = c.id and c.category_id = p_cat;
end $$;

-- ───────────── 랭킹 재계산 (정본) ─────────────
create or replace function public.recompute_category(p_cat integer) returns void language plpgsql as $$
declare
  v_c numeric := 0;
  v_m numeric := 10;
  v_week date := (date_trunc('week', now()))::date;
begin
  -- C: 카테고리 전체 별점 가중 평균(5점 척도)
  select coalesce(sum(rating_avg * rating_count) / nullif(sum(rating_count), 0), 0)
    into v_c from public.content_stats where category_id = p_cat;

  -- m: 평가 수(>0) 25 백분위, 최소 10
  select greatest(10, coalesce(percentile_cont(0.25) within group (order by rating_count), 0))
    into v_m from public.content_stats where category_id = p_cat and rating_count > 0;

  -- 베이지안 점수 (10점 만점, 2자리)
  update public.content_stats s set
    bayesian_score = case when s.rating_count = 0 then 0
      else round((((s.rating_count::numeric / (s.rating_count + v_m)) * s.rating_avg) + ((v_m / (s.rating_count + v_m)) * v_c)) * 2, 2) end
  where s.category_id = p_cat;

  -- 순위 / 티어 / 변동
  with ranked as (
    select s.content_id,
      row_number() over (order by s.bayesian_score desc, s.rating_count desc, c.title collate "C") as rn,
      case when s.rating_count >= 5 then
        row_number() over (partition by (s.rating_count >= 5) order by s.bayesian_score desc, s.rating_count desc, c.title collate "C")
      end as ern,
      count(*) filter (where s.rating_count >= 5) over () as en
    from public.content_stats s
    join public.contents c on c.id = s.content_id
    where s.category_id = p_cat and c.is_approved
  ),
  prev as (
    select distinct on (content_id) content_id, rank
    from public.rank_snapshots
    where category_id = p_cat and snapshot_week < v_week
    order by content_id, snapshot_week desc
  )
  update public.content_stats s set
    rank = r.rn,
    tier = case
      when r.ern is null then null
      when (r.ern - 1)::numeric / r.en < 0.05 then 'S'::tier
      when (r.ern - 1)::numeric / r.en < 0.15 then 'A'::tier
      when (r.ern - 1)::numeric / r.en < 0.35 then 'B'::tier
      when (r.ern - 1)::numeric / r.en < 0.70 then 'C'::tier
      else 'D'::tier end,
    prev_rank  = p.rank,
    rank_delta = case when p.rank is null then null else p.rank - r.rn end
  from ranked r left join prev p on p.content_id = r.content_id
  where s.content_id = r.content_id;

  -- 미승인 → 순위 없음
  update public.content_stats s set rank = null, tier = null, prev_rank = null, rank_delta = null
  from public.contents c where c.id = s.content_id and s.category_id = p_cat and not c.is_approved;

  -- HOT (7일, 반감기 3일)
  with ev as (
    select r.content_id, 1.0::float8 w, r.created_at at
      from public.ratings r join public.contents c on c.id = r.content_id
      where c.category_id = p_cat and r.created_at > now() - interval '7 days'
    union all
    select rv.content_id, 3.0, rv.created_at
      from public.reviews rv join public.contents c on c.id = rv.content_id
      where c.category_id = p_cat and rv.created_at > now() - interval '7 days'
    union all
    select k.target_id, 1.0, k.created_at
      from public.comments k join public.contents c on c.id = k.target_id
      where k.target_type = 'content' and c.category_id = p_cat and k.created_at > now() - interval '7 days'
    union all
    select rv.content_id, 1.0, k.created_at
      from public.comments k join public.reviews rv on k.target_type = 'review' and rv.id = k.target_id
      join public.contents c on c.id = rv.content_id
      where c.category_id = p_cat and k.created_at > now() - interval '7 days'
    union all
    select b.content_a_id, 0.5, bv.created_at
      from public.battle_votes bv join public.battles b on b.id = bv.battle_id
      where b.category_id = p_cat and bv.created_at > now() - interval '7 days'
    union all
    select b.content_b_id, 0.5, bv.created_at
      from public.battle_votes bv join public.battles b on b.id = bv.battle_id
      where b.category_id = p_cat and bv.created_at > now() - interval '7 days'
  ),
  agg as (
    select content_id, sum(w * power(0.5, extract(epoch from (now() - at)) / 86400.0 / 3.0)) sc
    from ev group by content_id
  )
  update public.content_stats s set hot_score = coalesce(a.sc, 0)
  from public.content_stats s2 left join agg a on a.content_id = s2.content_id
  where s.content_id = s2.content_id and s2.category_id = p_cat;

  perform public.refresh_category_item_count(p_cat);
end $$;

create or replace function public.recompute_all() returns integer language plpgsql as $$
declare r record; n integer := 0;
begin
  for r in select id from public.categories loop
    perform public.recompute_category(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- ───────────── 주간 스냅샷 ─────────────
create or replace function public.take_snapshot(p_week date default (date_trunc('week', now()))::date) returns integer language plpgsql as $$
declare n integer;
begin
  insert into public.rank_snapshots(content_id, category_id, rank, bayesian_score, tier, snapshot_week)
  select content_id, category_id, rank, bayesian_score, tier, p_week from public.content_stats where rank is not null
  on conflict (content_id, snapshot_week) do update
    set rank = excluded.rank, bayesian_score = excluded.bayesian_score, tier = excluded.tier;
  get diagnostics n = row_count;
  return n;
end $$;

-- ───────────── 대량 작업 모드 (시드 시 트리거 우회) ─────────────
create or replace function public.is_bulk() returns boolean language sql stable as $$
  select coalesce(current_setting('app.bulk', true), '') = 'on'
$$;

-- ───────────── ratings 트리거 ─────────────
create or replace function public.on_rating_change() returns trigger language plpgsql as $$
declare v_content integer; v_cat integer; v_user uuid;
begin
  if public.is_bulk() then return null; end if;
  v_content := coalesce(new.content_id, old.content_id);
  v_user := coalesce(new.user_id, old.user_id);
  perform public.refresh_content_stats(v_content);
  select category_id into v_cat from public.contents where id = v_content;
  perform public.recompute_category(v_cat);
  update public.profiles p set rating_count = (select count(*) from public.ratings r where r.user_id = v_user) where p.id = v_user;
  return null;
end $$;
drop trigger if exists trg_ratings_change on public.ratings;
create trigger trg_ratings_change after insert or update or delete on public.ratings
  for each row execute function public.on_rating_change();

-- ───────────── reviews 트리거 ─────────────
create or replace function public.on_review_change() returns trigger language plpgsql as $$
declare v_content integer; v_user uuid;
begin
  if public.is_bulk() then return null; end if;
  v_content := coalesce(new.content_id, old.content_id);
  v_user := coalesce(new.user_id, old.user_id);
  update public.content_stats s set review_count = (select count(*) from public.reviews r where r.content_id = v_content and not r.is_hidden)
    where s.content_id = v_content;
  update public.profiles p set review_count = (select count(*) from public.reviews r where r.user_id = v_user and not r.is_hidden) where p.id = v_user;
  return null;
end $$;
drop trigger if exists trg_reviews_change on public.reviews;
create trigger trg_reviews_change after insert or update of is_hidden or delete on public.reviews
  for each row execute function public.on_review_change();

-- ───────────── comments 트리거 ─────────────
create or replace function public.on_comment_change() returns trigger language plpgsql as $$
declare v_type target_type; v_id integer; v_content integer; v_delta integer;
begin
  if public.is_bulk() then return null; end if;
  v_type := coalesce(new.target_type, old.target_type);
  v_id := coalesce(new.target_id, old.target_id);
  v_delta := case when tg_op = 'INSERT' then 1 when tg_op = 'DELETE' then -1
                  when tg_op = 'UPDATE' and new.is_hidden <> old.is_hidden then (case when new.is_hidden then -1 else 1 end)
                  else 0 end;
  if v_delta = 0 then return null; end if;
  if v_type = 'content' then
    update public.content_stats set comment_count = greatest(0, comment_count + v_delta) where content_id = v_id;
  elsif v_type = 'review' then
    update public.reviews set comment_count = greatest(0, comment_count + v_delta) where id = v_id returning content_id into v_content;
    if v_content is not null then
      update public.content_stats set comment_count = greatest(0, comment_count + v_delta) where content_id = v_content;
    end if;
  elsif v_type = 'post' then
    update public.posts set comment_count = greatest(0, comment_count + v_delta) where id = v_id;
  end if;
  return null;
end $$;
drop trigger if exists trg_comments_change on public.comments;
create trigger trg_comments_change after insert or update of is_hidden or delete on public.comments
  for each row execute function public.on_comment_change();

-- ───────────── reactions 트리거 (델타 방식 — 시드된 like_count 와 공존) ─────────────
create or replace function public.apply_reaction_delta(p_type target_type, p_id integer, p_kind reaction_kind, p_delta integer) returns void language plpgsql as $$
begin
  if p_type = 'review' then
    update public.reviews set like_count = greatest(0, like_count + case when p_kind = 'like' then p_delta else 0 end),
      dislike_count = greatest(0, dislike_count + case when p_kind = 'dislike' then p_delta else 0 end) where id = p_id;
  elsif p_type = 'comment' then
    update public.comments set like_count = greatest(0, like_count + case when p_kind = 'like' then p_delta else 0 end),
      dislike_count = greatest(0, dislike_count + case when p_kind = 'dislike' then p_delta else 0 end) where id = p_id;
  elsif p_type = 'post' then
    update public.posts set like_count = greatest(0, like_count + case when p_kind = 'like' then p_delta else 0 end),
      dislike_count = greatest(0, dislike_count + case when p_kind = 'dislike' then p_delta else 0 end) where id = p_id;
  end if;
end $$;

create or replace function public.on_reaction_change() returns trigger language plpgsql as $$
begin
  if public.is_bulk() then return null; end if;
  if tg_op = 'INSERT' then
    perform public.apply_reaction_delta(new.target_type, new.target_id, new.kind, 1);
  elsif tg_op = 'DELETE' then
    perform public.apply_reaction_delta(old.target_type, old.target_id, old.kind, -1);
  elsif tg_op = 'UPDATE' and new.kind <> old.kind then
    perform public.apply_reaction_delta(old.target_type, old.target_id, old.kind, -1);
    perform public.apply_reaction_delta(new.target_type, new.target_id, new.kind, 1);
  end if;
  return null;
end $$;
drop trigger if exists trg_reactions_change on public.reactions;
create trigger trg_reactions_change after insert or update or delete on public.reactions
  for each row execute function public.on_reaction_change();

-- ───────────── battle_votes 트리거 (투표 수 + ELO K=24) ─────────────
create or replace function public.on_battle_vote() returns trigger language plpgsql as $$
declare b record; ra float8; rb float8; ea float8; sa float8; k constant float8 := 24;
begin
  if public.is_bulk() then return null; end if;
  select * into b from public.battles where id = new.battle_id;
  if b is null then return null; end if;
  if new.choice = 'a' then
    update public.battles set votes_a = votes_a + 1 where id = b.id;
  else
    update public.battles set votes_b = votes_b + 1 where id = b.id;
  end if;
  select elo into ra from public.content_stats where content_id = b.content_a_id;
  select elo into rb from public.content_stats where content_id = b.content_b_id;
  ra := coalesce(ra, 1500); rb := coalesce(rb, 1500);
  ea := 1 / (1 + power(10, (rb - ra) / 400));
  sa := case when new.choice = 'a' then 1 else 0 end;
  update public.content_stats set elo = ra + k * (sa - ea),
    elo_wins = elo_wins + sa::int, elo_losses = elo_losses + (1 - sa)::int where content_id = b.content_a_id;
  update public.content_stats set elo = rb + k * ((1 - sa) - (1 - ea)),
    elo_wins = elo_wins + (1 - sa)::int, elo_losses = elo_losses + sa::int where content_id = b.content_b_id;
  return null;
end $$;
drop trigger if exists trg_battle_votes on public.battle_votes;
create trigger trg_battle_votes after insert on public.battle_votes
  for each row execute function public.on_battle_vote();

-- ───────────── reports 트리거 (신고 5회 자동 숨김) ─────────────
create or replace function public.on_report_insert() returns trigger language plpgsql as $$
declare n integer;
begin
  select count(*) into n from public.reports where target_type = new.target_type and target_id = new.target_id;
  if new.target_type = 'review' then
    update public.reviews set report_count = n, is_hidden = (is_hidden or n >= 5) where id = new.target_id;
  elsif new.target_type = 'comment' then
    update public.comments set report_count = n, is_hidden = (is_hidden or n >= 5) where id = new.target_id;
  elsif new.target_type = 'post' then
    update public.posts set report_count = n, is_hidden = (is_hidden or n >= 5) where id = new.target_id;
  end if;
  return null;
end $$;
drop trigger if exists trg_reports_insert on public.reports;
create trigger trg_reports_insert after insert on public.reports
  for each row execute function public.on_report_insert();

-- ───────────── 조회수 (세션당 1회) ─────────────
create or replace function public.increment_view(p_content integer, p_session text) returns boolean language plpgsql as $$
begin
  insert into public.content_views(content_id, session_key) values (p_content, p_session);
  update public.content_stats set view_count = view_count + 1 where content_id = p_content;
  return true;
exception when unique_violation then
  return false;
end $$;

-- ───────────── 검색 ─────────────
create or replace function public.search_contents(q text, p_limit integer default 20, p_category integer default null)
returns table(content_id integer, sim real) language sql stable as $$
  select c.id, greatest(similarity(c.title, q), coalesce(similarity(c.title_original, q), 0)) as sim
  from public.contents c
  where c.is_approved
    and (p_category is null or c.category_id = p_category)
    and (c.title ilike '%' || q || '%' or c.title_original ilike '%' || q || '%'
         or similarity(c.title, q) > 0.2 or similarity(c.title_original, q) > 0.2)
  order by (c.title ilike q || '%') desc, sim desc, c.id
  limit p_limit
$$;
