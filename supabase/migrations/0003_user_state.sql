-- Innerly, phase 2b: where a person's writing actually lives.
--
-- Run this once in the Supabase SQL editor, after 0001 and 0002.
--
-- The app reads and writes each part of itself whole — the reflections list,
-- the goals list, one day's tasks — because that is how the screens use it.
-- This table mirrors that shape exactly: one row per (person, key), holding
-- that key's JSON. A faithful mapping means a sync layer with very little
-- room to lose someone's writing, which matters more here than being able to
-- run SQL over the inside of an entry.
--
-- The relational tables in 0001 are still the right home for anything we
-- later need to query across (posts, and the vision-board images that have to
-- move to Storage). They are left in place for that.

create table if not exists public.user_state (
  user_id    uuid not null references auth.users on delete cascade,
  -- 'innerly:reflections', 'innerly:tasks:2026-08-28', and so on.
  key        text not null check (char_length(key) between 1 and 200),
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_state enable row level security;

-- Your own rows, and only ever your own. Every verb is fenced separately so
-- there is no way to read, change or delete another account's writing —
-- not from the app, not from a hand-written request with the public key.
create policy "own state read"   on public.user_state
  for select using (auth.uid() = user_id);
create policy "own state insert" on public.user_state
  for insert with check (auth.uid() = user_id);
create policy "own state update" on public.user_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own state delete" on public.user_state
  for delete using (auth.uid() = user_id);

create trigger user_state_touch_updated_at
  before update on public.user_state
  for each row execute function public.touch_updated_at();

-- Deliberately NOT granted to admins. The admin dashboard counts accounts and
-- active days; it has no business reading what anyone wrote, so it is not
-- given a way to.
