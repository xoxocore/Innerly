-- A stand-in for the parts of Supabase that the migrations lean on, so the
-- real policies can be run against a plain local Postgres. Test scaffolding
-- only: never run this against a real project.
-- Minimal stand-in for the parts of Supabase the migrations lean on, so the
-- real policies can be exercised against a real Postgres.
create schema if not exists auth;
-- The columns the migrations actually read. Leaving any of them out makes the
-- suites below fail on scaffolding rather than on the policies they are meant
-- to be testing, which is worse than no test at all.
create table auth.users (
  id uuid primary key,
  email text,
  email_confirmed_at timestamptz,
  banned_until timestamptz,
  created_at timestamptz not null default now(),
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  raw_app_meta_data  jsonb not null default '{}'::jsonb
);
-- Supabase's auth.uid() reads the sub claim off the request JWT.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
-- Roles belong to the cluster, not the database, so a second throwaway
-- database in the same cluster would otherwise fail here before creating
-- anything else.
do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;
grant usage on schema public, auth to anon, authenticated;

-- Supabase's storage schema, enough of it to run the bucket policies in 0002.
create schema if not exists storage;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets,
  name text not null,
  owner uuid
);
alter table storage.objects enable row level security;

-- Returns the directory segments of a path: 'u1/a.jpg' -> {u1}.
create or replace function storage.foldername(name text)
returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)]
$$;

grant usage on schema storage to anon, authenticated;
