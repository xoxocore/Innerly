-- Can somebody manage their own account, and only their own?
--
-- Throwaway database only. Run after stub.sql, 0001, 0002, setup.sql, 0004-0009.
-- Every line must match its "want". The errors are the point.
--
-- Note the `reset role` before checking Aisha's row from outside her session:
-- RLS means another person's session cannot see it at all, so a check written
-- from Ben's seat would print nothing and quietly pass.

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.set_paused(boolean) to authenticated;
grant execute on function public.email_recipients(text) to authenticated;

insert into auth.users (id, email, email_confirmed_at, created_at) values
  ('11111111-1111-1111-1111-111111111111', 'aisha@example.com', now(), now() - interval '30 days'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com',   now(), now() - interval '30 days'),
  ('33333333-3333-3333-3333-333333333333', 'owner@example.com', now(), now() - interval '60 days')
on conflict (id) do nothing;

insert into public.email_prefs (user_id) select id from auth.users
on conflict (user_id) do nothing;
insert into public.admins (user_id) values ('33333333-3333-3333-3333-333333333333')
on conflict do nothing;

/* ------------------------------------------------------------ pausing ----- */

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select '1. Aisha pauses her account    -> ' ||
  (public.set_paused(true) is not null) || ' (want true)';

reset role;
select '2. It is really recorded       -> ' || (deactivated_at is not null) || ' (want true)'
  from public.profiles where id = '11111111-1111-1111-1111-111111111111';

/* --------------------------------------------- and only their own account - */

set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select '3. Ben cannot see her row      -> rows: ' || count(*) || ' (want 0)'
  from public.profiles where id = '11111111-1111-1111-1111-111111111111';

-- The function takes no account to aim at — it acts on auth.uid() — so the
-- only thing Ben can pause is Ben. And a direct write is stopped by the update
-- policy from 0001 rather than by the function.
update public.profiles set deactivated_at = null
 where id = '11111111-1111-1111-1111-111111111111';

reset role;
select '4. ...nor un-pause her by hand -> ' || (deactivated_at is not null) || ' (want true)'
  from public.profiles where id = '11111111-1111-1111-1111-111111111111';

/* ------------------------------------------- a paused account gets no email */

set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

select '5. Paused people are not sent  -> ' || count(*) || ' (want 2)'
  from public.email_recipients('everyone');

select '6. ...and Aisha is the one out -> ' || string_agg(email, ', ') ||
       ' (want ben and owner)'
  from public.email_recipients('everyone');

/* ---------------------------------------------------------- coming back --- */

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select '7. Aisha comes back            -> ' ||
  coalesce(public.set_paused(false)::text, 'null') || ' (want null)';

set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select '8. ...and is sent to again     -> ' || count(*) || ' (want 3)'
  from public.email_recipients('everyone');

/* ------------------------------------------- the heartbeat, which is how it
   actually happens: nobody presses a resume button, they just open the app.
   This is the statement src/lib/presence.ts runs. */

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select '9. Ben pauses too              -> ' ||
  (public.set_paused(true) is not null) || ' (want true)';

update public.profiles
   set last_active_at = now(), deactivated_at = null
 where id = auth.uid();

reset role;
select '10. Opening the app un-pauses  -> ' || (deactivated_at is null) || ' (want true)'
  from public.profiles where id = '22222222-2222-2222-2222-222222222222';

/* ----------------------------------------------------- a stranger asking -- */

set role anon; set request.jwt.claim.sub = '';
select '11. A signed-out visitor       -> refused below (want an error)';
select public.set_paused(true);

reset role;
