-- Innerly: recording that somebody opened the app.
--
-- Run after 0004. Safe to run more than once.
--
-- The admin panel had numbers with nothing behind them: usage_days was created
-- in 0001 but never written to, so every activity figure read zero. This adds
-- the missing piece, and a timestamp so "last seen" can be more precise than
-- the day.
--
-- What is recorded is THAT the app was opened, and when. Never what was
-- written, or how much, or in which part of the app.

alter table public.profiles
  add column if not exists last_active_at timestamptz;

-- Sorting the accounts list by who was here most recently.
create index if not exists profiles_last_active_idx
  on public.profiles (last_active_at desc nulls last);

/* -------------------------------------------------- the accounts list ----- */

-- Replaced to carry last_active_at. Same rule as before: the is_admin() check
-- on the first line is the whole security of a security-definer function.
--
-- Dropped first, not replaced: Postgres refuses to change what a function
-- returns in place, and this one gains a column.
drop function if exists public.admin_accounts();

create function public.admin_accounts()
returns table (
  id             uuid,
  email          text,
  first_name     text,
  signed_up_at   timestamptz,
  confirmed      boolean,
  provider       text,
  last_seen      date,
  last_active_at timestamptz,
  days_active    integer,
  suspended      boolean
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
    p.last_active_at,
    (select count(*)::integer from public.usage_days d where d.user_id = u.id),
    u.banned_until is not null and u.banned_until > now()
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by p.last_active_at desc nulls last, u.created_at desc;
end $$;

revoke all on function public.admin_accounts() from public, anon;
grant execute on function public.admin_accounts() to authenticated;

/* ------------------------------------------------------- online now ------- */

-- Added to the numbers so the overview can say who is around right now.
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
    'online_now',      (select count(*) from public.profiles
                          where last_active_at > now() - interval '5 minutes'),
    'active_today',    (select count(*) from public.usage_days where day = current_date),
    'active_7d',       (select count(distinct user_id) from public.usage_days
                          where day > current_date - 7),
    'active_30d',      (select count(distinct user_id) from public.usage_days
                          where day > current_date - 30),
    'returning',       (select count(distinct d.user_id) from public.usage_days d
                          join auth.users u on u.id = d.user_id
                          where u.created_at < now() - interval '7 days'
                            and d.day > current_date - 7),
    'eligible',        (select count(*) from auth.users
                          where created_at < now() - interval '7 days'),
    'posts_published', (select count(*) from public.posts where published),
    'posts_drafts',    (select count(*) from public.posts where not published),
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
