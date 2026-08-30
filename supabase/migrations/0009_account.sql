-- Innerly: people looking after their own account.
--
-- Run after 0008. Safe to run more than once.
--
-- Everything here belongs to the person it describes. There is no admin path
-- into any of it: an avatar is readable only by its owner, and pausing or
-- deleting an account is something you do to your own, from your own session.

/* ------------------------------------------------------------- the avatar -- */

-- Private, like `visions` and unlike `posts`. Nobody but you ever sees your
-- picture — Innerly has no feed, no profiles page, and the admin panel
-- deliberately shows no faces — so a public bucket would be handing out
-- something nothing in the product asks for.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

-- Same fence as vision images: the first path segment is the owner, and the
-- policy is a comparison against it.
drop policy if exists "read own avatar"    on storage.objects;
drop policy if exists "upload own avatar"  on storage.objects;
drop policy if exists "replace own avatar" on storage.objects;
drop policy if exists "delete own avatar"  on storage.objects;

create policy "read own avatar" on storage.objects
  for select using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "upload own avatar" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "replace own avatar" on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "delete own avatar" on storage.objects
  for delete using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

/* ------------------------------------------------------- what the row holds */

-- The picture's path is not here on purpose: it travels with the rest of the
-- profile in user_state, and a column nothing writes to is how the panel ended
-- up with numbers that were always zero.

-- Set while an account is paused. Not a ban: the person did this to
-- themselves, and signing back in clears it. Kept as a timestamp rather than a
-- flag so "paused since March" can be said out loud.
alter table public.profiles
  add column if not exists deactivated_at timestamptz;

-- The weekly report was never built, so the preference was a switch wired to
-- nothing. Dropped from the default and from the rows that carry it.
alter table public.profiles
  alter column prefs set default
    '{"notifications":false,"dailyReminder":true}'::jsonb;

update public.profiles
   set prefs = prefs - 'weeklyReport'
 where prefs ? 'weeklyReport';

/* --------------------------------------------------- pausing, from the app */

-- Pausing and resuming are the person's own doing, so this runs as them and
-- needs no elevated rights — the update policy from 0001 already limits it to
-- their own row. It exists as a function only so the app has one name for it.
create or replace function public.set_paused(paused boolean)
returns timestamptz
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare out_at timestamptz;
begin
  update public.profiles
     set deactivated_at = case when paused then now() else null end
   where id = auth.uid()
  returning deactivated_at into out_at;
  return out_at;
end $$;

revoke all on function public.set_paused(boolean) from public, anon;
grant execute on function public.set_paused(boolean) to authenticated;

/* ------------------------------------------- a paused account gets no email */

-- Recipients, minus anybody who has paused. Somebody who stepped away and is
-- still sent a newsletter has not been allowed to step away.
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
    and (p.deactivated_at is null)
    and (
      target = 'everyone'
      or (target = 'new'       and u.created_at > now() - interval '7 days')
      or (target = 'returning' and u.created_at <= now() - interval '7 days')
    );
end $$;

revoke all on function public.email_recipients(text) from public, anon;
grant execute on function public.email_recipients(text) to authenticated;
