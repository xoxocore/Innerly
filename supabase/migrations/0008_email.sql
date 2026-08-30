-- Innerly: email.
--
-- Run after 0007. Safe to run more than once.
--
-- Two kinds of email, kept apart on purpose and never mixed:
--
--   Necessary   confirming an address, resetting a password. Nobody may
--               unsubscribe from these — without them an account cannot be
--               recovered — and nothing here touches them.
--   Everything  news, tips, a newsletter. Opt-out, always, in one click, and
--   else        every one carries a link that does it.
--
-- Mixing the two is how a company ends up unable to send a password reset to
-- somebody who once unsubscribed from a newsletter.

/* ------------------------------------------------- who wants to hear from us */

create table if not exists public.email_prefs (
  user_id      uuid primary key references auth.users on delete cascade,
  -- Opted in by default, because somebody making an account for a journal
  -- expects to hear about the journal. One click undoes it.
  marketing    boolean not null default true,
  -- Long, random, and enough on its own to unsubscribe: the link in an email
  -- has to work for somebody who is not signed in and may be on another
  -- device. It grants that and nothing else.
  token        uuid not null default gen_random_uuid(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists email_prefs_token_idx on public.email_prefs (token);

alter table public.email_prefs enable row level security;

drop policy if exists "own email prefs read"  on public.email_prefs;
drop policy if exists "own email prefs write" on public.email_prefs;
create policy "own email prefs read"  on public.email_prefs
  for select using (auth.uid() = user_id);
create policy "own email prefs write" on public.email_prefs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Everyone who already has an account starts opted in with a token of their own.
insert into public.email_prefs (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- And everyone from here on.
create or replace function public.handle_new_user_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.email_prefs (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created_email on auth.users;
create trigger on_auth_user_created_email
  after insert on auth.users
  for each row execute function public.handle_new_user_email();

/* -------------------------------------------------------------- what we sent */

create table if not exists public.email_campaigns (
  id           uuid primary key default gen_random_uuid(),
  subject      text not null default '',
  preheader    text not null default '',
  body         text not null default '',
  audience     text not null default 'everyone'
               check (audience in ('everyone', 'new', 'returning')),
  status       text not null default 'draft'
               check (status in ('draft', 'sending', 'sent', 'failed')),
  sent_at      timestamptz,
  -- What actually happened, rather than what was hoped for.
  recipients   integer not null default 0,
  delivered    integer not null default 0,
  failed       integer not null default 0,
  error        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists email_campaigns_recent_idx
  on public.email_campaigns (created_at desc);

alter table public.email_campaigns enable row level security;

drop policy if exists "admins read campaigns"  on public.email_campaigns;
drop policy if exists "admins write campaigns" on public.email_campaigns;
create policy "admins read campaigns"  on public.email_campaigns
  for select using (public.is_admin());
create policy "admins write campaigns" on public.email_campaigns
  for all using (public.is_admin()) with check (public.is_admin());

drop trigger if exists email_campaigns_touch_updated_at on public.email_campaigns;
create trigger email_campaigns_touch_updated_at
  before update on public.email_campaigns
  for each row execute function public.touch_updated_at();

/* ------------------------------------------------------------- who to write to */

-- The addresses a campaign should go to: opted in, confirmed, not suspended.
-- Admin-only, and it returns addresses rather than counts because sending is
-- the one job that genuinely needs them.
create or replace function public.email_recipients(target text)
returns table (user_id uuid, email text, first_name text, token uuid)
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
  select u.id, u.email::text, coalesce(p.first_name, ''), e.token
  from auth.users u
  join public.email_prefs e on e.user_id = u.id
  left join public.profiles p on p.id = u.id
  where e.marketing
    and u.email_confirmed_at is not null
    and (u.banned_until is null or u.banned_until < now())
    and (
      target = 'everyone'
      or (target = 'new'       and u.created_at > now() - interval '7 days')
      or (target = 'returning' and u.created_at <= now() - interval '7 days')
    );
end $$;

revoke all on function public.email_recipients(text) from public, anon;
grant execute on function public.email_recipients(text) to authenticated;

-- How many that would be, for the composer to show before anything is sent.
create or replace function public.email_audience_size(target text)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare n integer;
begin
  if not public.is_admin() then
    raise exception 'not an admin';
  end if;
  select count(*) into n from public.email_recipients(target);
  return n;
end $$;

revoke all on function public.email_audience_size(text) from public, anon;
grant execute on function public.email_audience_size(text) to authenticated;

/* ---------------------------------------------------------- unsubscribing --- */

-- Turns marketing off from a token alone. security definer because the person
-- clicking is, by definition, not signed in — and it can do nothing else: no
-- reading, no other column, no other table.
create or replace function public.unsubscribe(t uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare hit integer;
begin
  update public.email_prefs
     set marketing = false, updated_at = now()
   where token = t;
  get diagnostics hit = row_count;
  return hit > 0;
end $$;

grant execute on function public.unsubscribe(uuid) to anon, authenticated;
