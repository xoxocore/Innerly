-- Paste this whole file into the Supabase SQL editor and press Run.
--
-- It only reads. It changes nothing, so it is safe on a live project, and it
-- is worth re-running after any change to the database.
--
-- Every row must say PASS. If any says FAIL, do not let people sign up yet.

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
-- Every table holding writing needs all four verbs fenced to auth.uid().
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
select 'accounts on the admin allowlist', (select count(*)::text from public.admins);
