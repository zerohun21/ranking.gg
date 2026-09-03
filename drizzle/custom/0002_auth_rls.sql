-- ranking.gg auth trigger + RLS (Supabase 전용)

-- ───────────── auth.users → profiles ─────────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_nick text;
  v_admins text[] := string_to_array(coalesce(current_setting('app.admin_emails', true), ''), ',');
  v_is_anon boolean := coalesce(new.is_anonymous, false);
  i integer := 0;
begin
  v_nick := coalesce(
    nullif(trim(new.raw_user_meta_data->>'nickname'), ''),
    case when v_is_anon then '게스트_' || substr(replace(new.id::text, '-', ''), 1, 6)
         else split_part(coalesce(new.email, 'user'), '@', 1) end);
  loop
    begin
      insert into public.profiles(id, nickname, avatar_url, is_guest, is_admin, badges)
      values (new.id,
              case when i = 0 then v_nick else v_nick || '_' || substr(md5(random()::text), 1, 4) end,
              'https://api.dicebear.com/9.x/thumbs/svg?seed=' || new.id::text,
              v_is_anon,
              (new.email is not null and lower(new.email) = any(select lower(trim(x)) from unnest(v_admins) x)),
              case when (select count(*) from public.profiles where not is_seed) < 1000 then '["early_adopter"]'::jsonb else '[]'::jsonb end)
      on conflict (id) do nothing;
      exit;
    exception when unique_violation then
      i := i + 1;
      if i > 5 then raise; end if;
    end;
  end loop;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 게스트 → 이메일 전환 시 is_guest 해제
create or replace function public.handle_user_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.is_anonymous, false) = false and coalesce(old.is_anonymous, false) = true then
    update public.profiles set is_guest = false where id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated after update of is_anonymous, email on auth.users
  for each row execute function public.handle_user_update();

-- ───────────── RLS ─────────────
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.contents enable row level security;
alter table public.genres enable row level security;
alter table public.content_genres enable row level security;
alter table public.content_stats enable row level security;
alter table public.rank_snapshots enable row level security;
alter table public.ratings enable row level security;
alter table public.reviews enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.battles enable row level security;
alter table public.battle_votes enable row level security;
alter table public.posts enable row level security;
alter table public.reports enable row level security;
alter table public.collection_runs enable row level security;
alter table public.content_views enable row level security;

-- 읽기 public
do $$
declare t text;
begin
  foreach t in array array['profiles','categories','contents','genres','content_genres','content_stats','rank_snapshots','ratings','reviews','comments','reactions','battles','battle_votes','posts']
  loop
    execute format('drop policy if exists "%1$s_select_public" on public.%1$s', t);
    execute format('create policy "%1$s_select_public" on public.%1$s for select using (true)', t);
  end loop;
end $$;

-- 본인 행만 쓰기
do $$
declare t text;
begin
  foreach t in array array['ratings','reviews','comments','reactions','battle_votes','posts']
  loop
    execute format('drop policy if exists "%1$s_insert_own" on public.%1$s', t);
    execute format('create policy "%1$s_insert_own" on public.%1$s for insert to authenticated with check (auth.uid() = user_id)', t);
    execute format('drop policy if exists "%1$s_update_own" on public.%1$s', t);
    execute format('create policy "%1$s_update_own" on public.%1$s for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('drop policy if exists "%1$s_delete_own" on public.%1$s', t);
    execute format('create policy "%1$s_delete_own" on public.%1$s for delete to authenticated using (auth.uid() = user_id)', t);
  end loop;
end $$;

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own" on public.reports for insert to authenticated with check (auth.uid() = reporter_id);
drop policy if exists "reports_select_own" on public.reports;
create policy "reports_select_own" on public.reports for select to authenticated using (auth.uid() = reporter_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "battles_insert_auth" on public.battles;
create policy "battles_insert_auth" on public.battles for insert to authenticated with check (auth.uid() = created_by);

-- 유저 카테고리: 개설자만 쓰기 (contents/categories 는 service role + admin 이 주 경로)
drop policy if exists "categories_insert_user" on public.categories;
create policy "categories_insert_user" on public.categories for insert to authenticated with check (auth.uid() = created_by and is_official = false);
drop policy if exists "categories_update_owner" on public.categories;
create policy "categories_update_owner" on public.categories for update to authenticated using (auth.uid() = created_by) with check (auth.uid() = created_by);
drop policy if exists "contents_insert_owner" on public.contents;
create policy "contents_insert_owner" on public.contents for insert to authenticated
  with check (auth.uid() = created_by and exists (select 1 from public.categories c where c.id = category_id and c.created_by = auth.uid()));
drop policy if exists "contents_delete_owner" on public.contents;
create policy "contents_delete_owner" on public.contents for delete to authenticated
  using (exists (select 1 from public.categories c where c.id = category_id and c.created_by = auth.uid()));

-- collection_runs / content_views: service role 만 (정책 없음 = 접근 불가)

-- ───────────── Storage 버킷 (썸네일) ─────────────
insert into storage.buckets (id, name, public) values ('thumbs', 'thumbs', true) on conflict (id) do nothing;
drop policy if exists "thumbs_public_read" on storage.objects;
create policy "thumbs_public_read" on storage.objects for select using (bucket_id = 'thumbs');
drop policy if exists "thumbs_auth_upload" on storage.objects;
create policy "thumbs_auth_upload" on storage.objects for insert to authenticated with check (bucket_id = 'thumbs');
