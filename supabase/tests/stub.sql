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
