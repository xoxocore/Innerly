-- Innerly — one paste to finish the database.
--
-- Copy this whole file into the Supabase SQL editor and press Run. It is safe
-- to run more than once: if you have already done part of it, the rest still
-- applies and nothing is lost.
--
-- It does two things: adds the table your writing is stored in, then checks
-- the locks and prints the result. Read the table it returns at the end —
-- every row must say PASS.
--
-- Requires 0001_init.sql and 0002_storage.sql to have been run already.

/* ------------------------------------------------- where writing lives ---- */

create table if not exists public.user_state (
  user_id    uuid not null references auth.users on delete cascade,
  key        text not null check (char_length(key) between 1 and 200),
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_state enable row level security;

-- Dropped first so a second run replaces rather than errors.
drop policy if exists "own state read"   on public.user_state;
drop policy if exists "own state insert" on public.user_state;
drop policy if exists "own state update" on public.user_state;
drop policy if exists "own state delete" on public.user_state;

-- Your own rows, and only ever your own. Every verb is fenced separately so
-- there is no way to read, change or delete another account's writing — not
-- from the app, not from a hand-written request with the public key.
create policy "own state read"   on public.user_state
  for select using (auth.uid() = user_id);
create policy "own state insert" on public.user_state
  for insert with check (auth.uid() = user_id);
create policy "own state update" on public.user_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own state delete" on public.user_state
  for delete using (auth.uid() = user_id);

drop trigger if exists user_state_touch_updated_at on public.user_state;
create trigger user_state_touch_updated_at
  before update on public.user_state
  for each row execute function public.touch_updated_at();

/* --------------------------------------------------------- the check ------ */

with expected(t) as (
  values ('profiles'), ('admins'), ('reflections'), ('goals'), ('tasks'),
         ('manifestations'), ('vision_years'), ('vision_items'),
         ('usage_days'), ('hidden_activities'), ('posts'), ('user_state')
),
present as (
  select t, exists (
    select 1 from pg_tables p where p.schemaname = 'public' and p.tablename = t
  ) as ok from expected
),
unlocked as (
  select tablename from pg_tables
  where schemaname = 'public' and not rowsecurity
),
writing(t) as (
  values ('reflections'), ('goals'), ('tasks'), ('manifestations'),
         ('vision_years'), ('vision_items'), ('usage_days'),
         ('hidden_activities'), ('user_state')
),
verbs as (
  select w.t, count(distinct p.cmd) as n
  from writing w
  left join pg_policies p
    on p.schemaname = 'public' and p.tablename = w.t
   and (p.qual like '%auth.uid()%' or p.with_check like '%auth.uid()%')
  group by w.t
)
select 'every table exists' as check,
       case when (select count(*) from present where not ok) = 0
            then 'PASS' else 'FAIL: missing ' ||
                 (select string_agg(t, ', ') from present where not ok) end as result
union all
select 'row-level security is on everywhere',
       case when (select count(*) from unlocked) = 0
            then 'PASS' else 'FAIL: open ' ||
                 (select string_agg(tablename, ', ') from unlocked) end
union all
select 'read/insert/update/delete all fenced to the owner',
       case when (select count(*) from verbs where n < 4) = 0
            then 'PASS' else 'FAIL: incomplete on ' ||
                 (select string_agg(t, ', ') from verbs where n < 4) end
union all
select 'the admin allowlist cannot be written from the app',
       case when not exists (
              select 1 from pg_policies
              where schemaname = 'public' and tablename = 'admins'
                and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL'))
            then 'PASS' else 'FAIL: something can write to admins' end
union all
select 'new accounts get a profile automatically',
       case when exists (select 1 from pg_trigger where tgname = 'on_auth_user_created')
            then 'PASS' else 'FAIL: signup trigger missing' end
union all
select 'published posts are the only thing the world can read',
       case when (select count(*) from pg_policies
                  where schemaname = 'public' and cmd in ('SELECT', 'ALL')
                    and qual not like '%auth.uid()%'
                    and qual not like '%is_admin()%'
                    and tablename <> 'posts') = 0
            then 'PASS' else 'FAIL: a table other than posts is world-readable' end
union all
select 'vision photos live in a private bucket',
       case when exists (
              select 1 from storage.buckets where id = 'visions' and public = false)
            then 'PASS' else 'FAIL: run 0002_storage.sql' end
union all
select 'a photo is readable only by whoever uploaded it',
       case when (select count(distinct cmd) from pg_policies
                  where schemaname = 'storage' and tablename = 'objects'
                    and qual like '%auth.uid()%' and qual like '%visions%') >= 3
            then 'PASS' else 'FAIL: run 0002_storage.sql' end
union all
select 'accounts on the admin allowlist', (select count(*)::text from public.admins);
