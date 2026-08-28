-- Innerly, phase 2: accounts and content.
--
-- Run this once in the Supabase SQL editor (or `supabase db push`).
--
-- Two rules hold everywhere below:
--   1. Every table carrying a person's writing has row-level security keyed to
--      auth.uid(). Privacy is enforced by the database, not by app code that
--      could forget a filter.
--   2. Admin rights come from the `admins` table only. Nothing a person can
--      set during signup can grant them.

create extension if not exists "pgcrypto";

/* ------------------------------------------------------------------ people */

-- One row per account, created automatically on signup (trigger at the end).
-- The app is free, so there is no plan or billing here. Adding a paid tier
-- later is one `alter table ... add column`, not a rewrite.
create table public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  first_name    text not null default '',
  night_mode    boolean not null default false,
  prefs         jsonb not null default '{"notifications":false,"dailyReminder":true,"weeklyReport":false}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- The admin allowlist. Rows are added by hand in the Supabase dashboard, never
-- from the application, which is what keeps `/admin` closed.
create table public.admins (
  user_id    uuid primary key references auth.users on delete cascade,
  added_at   timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

/* ------------------------------------------------------- a person's writing */

create table public.reflections (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  -- The four-step flow: each moment carries its text, its why, and its next
  -- steps. Kept as jsonb because it is always read and written whole.
  moments      jsonb not null default '[]'::jsonb,
  differently  text not null default '',
  review       text,
  created_at   timestamptz not null default now()
);
create index reflections_user_created_idx on public.reflections (user_id, created_at desc);

create table public.goals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  title        text not null default '',
  description  text,
  color        text not null default 'blue',
  position     integer not null default 0,
  horizons     jsonb not null default '{"year":[],"sixMonths":[],"threeMonths":[],"oneMonth":[],"thisWeek":[],"today":[]}'::jsonb,
  created_at   timestamptz not null default now()
);
create index goals_user_position_idx on public.goals (user_id, position);

-- One row per task rather than a blob per day: the planner's calendar counts
-- and filters by day, which a JSON blob per day cannot answer efficiently.
create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  day          date not null,
  title        text not null,
  done         boolean not null default false,
  position     integer not null default 0,
  created_at   timestamptz not null default now()
);
create index tasks_user_day_idx on public.tasks (user_id, day);

create table public.manifestations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  goals         text[] not null default '{}',
  affirmations  text[] not null default '{}',
  gratitude     text[] not null default '{}',
  releases      text[] not null default '{}',
  created_at    timestamptz not null default now()
);
create index manifestations_user_created_idx on public.manifestations (user_id, created_at desc);

create table public.vision_years (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  year       text not null,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

-- `image_path` points into Supabase Storage rather than holding a data URL.
-- That is what lifts the vision board off the ~5MB localStorage ceiling.
create table public.vision_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  year_id     uuid not null references public.vision_years on delete cascade,
  title       text not null default '',
  description text,
  image_path  text,
  gradient    text[2],
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index vision_items_year_idx on public.vision_items (year_id, position);

-- Days the app was opened, which is what the streak counts.
create table public.usage_days (
  user_id uuid not null references auth.users on delete cascade,
  day     date not null,
  primary key (user_id, day)
);

-- History activities are derived from the data, so "deleting" one hides it
-- here rather than destroying the vision or task behind it.
create table public.hidden_activities (
  user_id     uuid not null references auth.users on delete cascade,
  activity_id text not null,
  hidden_at   timestamptz not null default now(),
  primary key (user_id, activity_id)
);

/* ---------------------------------------------------------------- content */

-- Blogs and tutorials. Written by admins, read by the whole world once
-- published — the one table with a public read policy.
create table public.posts (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('blog', 'tutorial')),
  slug         text not null,
  title        text not null default '',
  excerpt      text not null default '',
  content      text not null default '',
  category     text,
  duration     text,
  cover_path   text,
  gradient     text[2],
  published    boolean not null default false,
  published_at timestamptz,
  author_id    uuid references auth.users on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (kind, slug)
);
create index posts_published_idx on public.posts (kind, published, published_at desc);

/* -------------------------------------------------------------------- RLS */

alter table public.profiles          enable row level security;
alter table public.admins            enable row level security;
alter table public.reflections       enable row level security;
alter table public.goals             enable row level security;
alter table public.tasks             enable row level security;
alter table public.manifestations    enable row level security;
alter table public.vision_years      enable row level security;
alter table public.vision_items      enable row level security;
alter table public.usage_days        enable row level security;
alter table public.hidden_activities enable row level security;
alter table public.posts             enable row level security;

-- Your own row, and only ever your own.
create policy "read own profile"   on public.profiles for select using (auth.uid() = id);
create policy "update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- The allowlist is readable only by those on it; nobody can write to it from
-- the app at all, which is the point.
create policy "admins read allowlist" on public.admins for select using (public.is_admin());

-- Same shape for every table holding a person's writing.
do $$
declare t text;
begin
  foreach t in array array[
    'reflections', 'goals', 'tasks', 'manifestations',
    'vision_years', 'vision_items', 'usage_days', 'hidden_activities'
  ] loop
    execute format(
      'create policy "own rows read"   on public.%I for select using (auth.uid() = user_id)', t);
    execute format(
      'create policy "own rows insert" on public.%I for insert with check (auth.uid() = user_id)', t);
    execute format(
      'create policy "own rows update" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format(
      'create policy "own rows delete" on public.%I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- Published posts are world-readable, including to visitors who never signed
-- in. Drafts and every write are admin-only.
create policy "published posts are public" on public.posts
  for select using (published = true or public.is_admin());
create policy "admins write posts" on public.posts
  for all using (public.is_admin()) with check (public.is_admin());

/* ------------------------------------------------------------- guardrails */

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Give every new account a profile, carrying whatever name the provider gave
-- us (Google supplies one; email signup will not).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name)
  values (
    new.id,
    coalesce(
      split_part(new.raw_user_meta_data->>'full_name', ' ', 1),
      new.raw_user_meta_data->>'name',
      ''
    )
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger posts_touch_updated_at
  before update on public.posts
  for each row execute function public.touch_updated_at();
