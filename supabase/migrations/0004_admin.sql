-- Innerly, phase 3: the admin panel.
--
-- Run this once in the Supabase SQL editor, after 0001–0003.
--
-- One rule shapes everything here: the panel can see WHO signed up and HOW
-- OFTEN they came back. It cannot see a single word anyone wrote. The sign-in
-- screen promises "only you can read it", and an admin panel that could browse
-- reflections would make that a lie. So nothing below touches user_state,
-- reflections, goals, manifestations or vision_items — not even to count rows
-- inside them.

/* ------------------------------------------------------------ audit log --- */

-- Who did what, to whom, and why. Suspending or deleting somebody's account is
-- the most consequential thing this software can do, so it leaves a record
-- that the person who did it cannot quietly edit.
create table if not exists public.admin_actions (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references auth.users on delete set null,
  actor_email text not null default '',
  target_id  uuid,
  target_email text not null default '',
  action     text not null check (action in ('suspend', 'unsuspend', 'delete')),
  reason     text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists admin_actions_recent_idx
  on public.admin_actions (created_at desc);

alter table public.admin_actions enable row level security;

-- Readable by admins, written only by the server (service key), never from a
-- browser. An audit log an admin could rewrite from the panel would be
-- decoration rather than a record.
drop policy if exists "admins read the log" on public.admin_actions;
create policy "admins read the log" on public.admin_actions
  for select using (public.is_admin());

/* --------------------------------------------------- the accounts list ---- */

-- Emails live in auth.users, which the browser cannot read. This exposes only
-- the columns an admin needs, and refuses outright if the caller is not one.
--
-- security definer is what lets it read auth.users at all, so the is_admin()
-- check on the first line is the whole security of this function. It raises
-- rather than returning nothing, so a mistake is loud.
create or replace function public.admin_accounts()
returns table (
  id            uuid,
  email         text,
  first_name    text,
  signed_up_at  timestamptz,
  confirmed     boolean,
  provider      text,
  last_seen     date,
  days_active   integer,
  suspended     boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not an admin';
  end if;

  return query
  select
    u.id,
    u.email::text,
    coalesce(p.first_name, ''),
    u.created_at,
    u.email_confirmed_at is not null,
    coalesce(u.raw_app_meta_data->>'provider', 'email'),
    (select max(d.day) from public.usage_days d where d.user_id = u.id),
    (select count(*)::integer from public.usage_days d where d.user_id = u.id),
    u.banned_until is not null and u.banned_until > now()
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by u.created_at desc;
end $$;

revoke all on function public.admin_accounts() from public, anon;
grant execute on function public.admin_accounts() to authenticated;

/* ------------------------------------------------------- the numbers ------ */

-- Everything the dashboard shows, in one round trip. All of it derived from
-- when people signed up and which days they opened the app — never from what
-- they wrote.
create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not an admin';
  end if;

  select jsonb_build_object(
    'accounts',        (select count(*) from auth.users),
    'confirmed',       (select count(*) from auth.users where email_confirmed_at is not null),
    'suspended',       (select count(*) from auth.users
                          where banned_until is not null and banned_until > now()),
    'new_7d',          (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'new_30d',         (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'active_today',    (select count(*) from public.usage_days where day = current_date),
    'active_7d',       (select count(distinct user_id) from public.usage_days
                          where day > current_date - 7),
    'active_30d',      (select count(distinct user_id) from public.usage_days
                          where day > current_date - 30),
    -- Of the accounts old enough to have come back, how many did in the last
    -- week. The honest measure of whether the app is worth returning to.
    'returning',       (select count(distinct d.user_id) from public.usage_days d
                          join auth.users u on u.id = d.user_id
                          where u.created_at < now() - interval '7 days'
                            and d.day > current_date - 7),
    'eligible',        (select count(*) from auth.users
                          where created_at < now() - interval '7 days'),
    'posts_published', (select count(*) from public.posts where published),
    'posts_drafts',    (select count(*) from public.posts where not published),
    -- Two 30-day series for the chart, as {day, n} rows with no gaps.
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'day', d::date,
               'signups', (select count(*) from auth.users u
                             where u.created_at::date = d::date),
               'active',  (select count(*) from public.usage_days x where x.day = d::date)
             ) order by d), '[]'::jsonb)
      from generate_series(current_date - 29, current_date, interval '1 day') d
    )
  ) into result;

  return result;
end $$;

revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;
