-- Can one person see another person's vision-board photos?
--
-- Same throwaway-database rules as rls.sql. Run after stub.sql, 0001 and 0002.
-- Every line must match its "want". Two errors are expected and are the point.

-- Supabase grants these to its two roles automatically; a bare Postgres does
-- not, and without them every query below fails on permissions rather than on
-- the policies we are here to test.
grant usage on schema public, storage to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert, update, delete on all tables in schema storage to authenticated;
grant select on all tables in schema public, storage to anon;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'aisha@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com')
on conflict do nothing;

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into storage.objects (bucket_id, name)
  values ('visions', '11111111-1111-1111-1111-111111111111/my-vision.jpg');

select '1. the visions bucket is private -> ' || (not public)::text || ' (want true)'
  from storage.buckets where id = 'visions';
select '2. Aisha sees her own photo      -> ' || count(*) || ' (want 1)' from storage.objects;

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select '3. Ben sees her photos           -> ' || count(*) || ' (want 0)' from storage.objects
  where bucket_id = 'visions';

with x as (delete from storage.objects
           where name like '11111111%' returning 1)
select '4. Ben deletes her photo         -> ' || count(*) || ' (want 0)' from x;

-- Ben writing into her folder must be refused outright.
insert into storage.objects (bucket_id, name)
  values ('visions', '11111111-1111-1111-1111-111111111111/planted.jpg');

-- And a visitor who never signed in.
reset role; set role anon; set request.jwt.claim.sub = '';
select '5. A signed-out visitor sees     -> ' || count(*) || ' (want 0)' from storage.objects
  where bucket_id = 'visions';

-- Post covers are the deliberate exception: the world reads them.
reset role;
insert into storage.objects (bucket_id, name) values ('posts', 'cover.jpg');
set role anon;
select '6. Post covers stay public       -> ' || count(*) || ' (want 1)' from storage.objects
  where bucket_id = 'posts';

-- Ben cannot upload a post cover; only admins may.
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
insert into storage.objects (bucket_id, name) values ('posts', 'bens-cover.jpg');

reset role;
select '7. Her photo, afterwards         -> ' || name from storage.objects
  where bucket_id = 'visions';
