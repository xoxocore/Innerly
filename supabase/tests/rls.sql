-- Can one person read another person's entries?
--
-- Run against a THROWAWAY local Postgres, never a real project — it creates
-- accounts and writes rows. It exists so the answer to that question is a test
-- result rather than an opinion about the policies in 0001 and 0003.
--
--   psql -f supabase/tests/stub.sql        -- stand-in for Supabase's auth schema
--   psql -f supabase/migrations/0001_init.sql
--   psql -f supabase/migrations/0003_user_state.sql
--   psql -f supabase/tests/rls.sql
--
-- Every line must read "want" and match. Two errors are expected and are the
-- point: a forged insert and a self-promotion to admin are refused outright.

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'aisha@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com');

-- Aisha writes something private, exactly as the app would.
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.user_state (user_id, key, value) values
  ('11111111-1111-1111-1111-111111111111', 'innerly:reflections',
   '[{"moments":[{"text":"the thing I have told nobody"}]}]'::jsonb);
insert into public.reflections (user_id, differently) values
  ('11111111-1111-1111-1111-111111111111', 'private');
insert into public.goals (user_id, title) values
  ('11111111-1111-1111-1111-111111111111', 'private goal');
insert into public.tasks (user_id, day, title) values
  ('11111111-1111-1111-1111-111111111111', current_date, 'private task');
insert into public.manifestations (user_id, gratitude) values
  ('11111111-1111-1111-1111-111111111111', array['private']);

select '1. Aisha reads her own entry  -> ' || count(*) || ' (want 1)' from public.user_state;

-- Ben. Same app, same public key, different account.
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select '2. Ben, everything he can see -> ' || count(*) || ' (want 0)' from public.user_state;
select '3. Ben, aimed at her row      -> ' || count(*) || ' (want 0)'
  from public.user_state where user_id = '11111111-1111-1111-1111-111111111111';

with x as (update public.user_state set value = '"defaced"'::jsonb
           where user_id = '11111111-1111-1111-1111-111111111111' returning 1)
select '4. Ben overwrites her entry   -> ' || count(*) || ' (want 0)' from x;

with x as (delete from public.user_state
           where user_id = '11111111-1111-1111-1111-111111111111' returning 1)
select '5. Ben deletes her entry      -> ' || count(*) || ' (want 0)' from x;

-- The same question of every other table that holds writing.
select 'reflections    -> ' || count(*) || ' (want 0)' from public.reflections
union all select 'goals          -> ' || count(*) || ' (want 0)' from public.goals
union all select 'tasks          -> ' || count(*) || ' (want 0)' from public.tasks
union all select 'manifestations -> ' || count(*) || ' (want 0)' from public.manifestations
union all select 'vision_items   -> ' || count(*) || ' (want 0)' from public.vision_items;

-- Forging a row under her id must be refused, not quietly dropped.
insert into public.user_state (user_id, key, value)
  values ('11111111-1111-1111-1111-111111111111', 'innerly:goals', '"forged"'::jsonb);

-- Nor can he make himself an admin.
insert into public.admins (user_id) values ('22222222-2222-2222-2222-222222222222');

-- A visitor who never signed in.
reset role; set role anon;
set request.jwt.claim.sub = '';
select '6. A signed-out visitor       -> ' || count(*) || ' (want 0)' from public.user_state;

-- No table may be left unlocked.
reset role;
select '7. Tables with RLS off        -> ' || count(*) || ' (want 0)'
  from pg_tables where schemaname = 'public' and not rowsecurity;

select '8. Her entry, afterwards      -> ' || (value->0->'moments'->0->>'text')
  from public.user_state where user_id = '11111111-1111-1111-1111-111111111111';
