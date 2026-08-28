-- A stand-in for the parts of Supabase that the migrations lean on, so the
-- real policies can be run against a plain local Postgres. Test scaffolding
-- only: never run this against a real project.
-- Minimal stand-in for the parts of Supabase the migrations lean on, so the
-- real policies can be exercised against a real Postgres.
create schema if not exists auth;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
-- Supabase's auth.uid() reads the sub claim off the request JWT.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create role anon nologin;
create role authenticated nologin;
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
