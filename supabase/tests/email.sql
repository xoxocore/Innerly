-- Can somebody unsubscribe, and can that link do anything it should not?
--
-- Throwaway database only. Run after stub.sql, 0001, 0002, setup.sql, 0004–0008.
-- Every line must match its "want". The errors are the point.

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant execute on function public.email_recipients(text), public.email_audience_size(text)
  to authenticated;
grant execute on function public.unsubscribe(uuid) to anon, authenticated;

insert into auth.users (id, email, email_confirmed_at, created_at) values
  ('11111111-1111-1111-1111-111111111111', 'aisha@example.com', now(), now() - interval '30 days'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com',   now(), now() - interval '2 days'),
  ('33333333-3333-3333-3333-333333333333', 'owner@example.com', now(), now() - interval '60 days'),
  -- Never confirmed their address; must never be written to.
  ('44444444-4444-4444-4444-444444444444', 'ghost@example.com', null, now())
on conflict (id) do nothing;

insert into public.email_prefs (user_id) select id from auth.users
on conflict (user_id) do nothing;
insert into public.admins (user_id) values ('33333333-3333-3333-3333-333333333333')
on conflict do nothing;

select '1. Everyone opted in to start  -> ' || count(*) || ' (want 4)' from public.email_prefs;

-- The owner sizes an audience before writing anything.
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select '2. Confirmed accounts only     -> ' || public.email_audience_size('everyone') || ' (want 3)';
select '3. Just joined                 -> ' || public.email_audience_size('new') || ' (want 1)';
select '4. Been here a while           -> ' || public.email_audience_size('returning') || ' (want 2)';

-- An ordinary person cannot get the list of addresses.
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select '5. Ben asks for every address  -> refused below (want an error)';
select * from public.email_recipients('everyone');

-- Unsubscribing, as somebody who is not signed in and clicked a link.
--
-- The token has to be read here, as postgres, because that is where it comes
-- from in real life: printed into the email. Somebody clicking the link has
-- the token and no access to anything else, which is what the rest of this
-- section checks.
reset role;
select token as aisha_token from public.email_prefs
 where user_id = '11111111-1111-1111-1111-111111111111' \gset

set role anon; set request.jwt.claim.sub = '';

select '6. A stranger reads the list   -> rows: ' || count(*) || ' (want 0)'
  from public.email_prefs;

select '7. Her link unsubscribes her   -> ' ||
  public.unsubscribe(:'aisha_token'::uuid) || ' (want true)';

select '8. A guessed token does nothing-> ' ||
  public.unsubscribe('00000000-0000-0000-0000-000000000000'::uuid) || ' (want false)';

-- The link cannot be turned around to opt somebody back IN.
update public.email_prefs set marketing = true;

reset role;
select '9. She is really opted out     -> marketing: ' || marketing || ' (want false)'
  from public.email_prefs where user_id = '11111111-1111-1111-1111-111111111111';

set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select '10. And dropped from sends     -> ' || public.email_audience_size('everyone') || ' (want 2)';

-- She can still be sent a password reset: unsubscribing touches marketing
-- only, and Supabase's own auth email does not consult this table at all.
reset role;
select '11. Her account is untouched   -> ' ||
  (select email from auth.users where id = '11111111-1111-1111-1111-111111111111') ||
  ', still confirmed: ' ||
  (select (email_confirmed_at is not null)::text from auth.users
   where id = '11111111-1111-1111-1111-111111111111') || ' (want true)';
