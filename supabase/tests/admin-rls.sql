-- Can someone who is not an admin reach the admin panel's data?
--
-- Throwaway database only. Run after stub.sql, 0001, 0002, setup.sql, 0004.
-- The three "permission denied"/"not an admin" errors are the point.

grant usage on schema public, storage to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant execute on function public.admin_accounts(), public.admin_stats() to authenticated;

insert into auth.users (id, email, email_confirmed_at) values
  ('11111111-1111-1111-1111-111111111111', 'aisha@example.com', now()),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com', now()),
  ('33333333-3333-3333-3333-333333333333', 'owner@example.com', now())
on conflict (id) do nothing;

insert into public.usage_days (user_id, day) values
  ('11111111-1111-1111-1111-111111111111', current_date),
  ('11111111-1111-1111-1111-111111111111', current_date - 1)
on conflict do nothing;

-- Only the owner is on the allowlist.
insert into public.admins (user_id) values ('33333333-3333-3333-3333-333333333333')
on conflict do nothing;

-- Ben is an ordinary signed-in person.
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select '1. Ben lists every account    -> refused below (want an error)';
select * from public.admin_accounts();

select '2. Ben reads the numbers      -> refused below (want an error)';
select public.admin_stats();

select '3. Ben reads the audit log    -> rows: ' || count(*) || ' (want 0)'
  from public.admin_actions;

-- A visitor who never signed in.
reset role; set role anon; set request.jwt.claim.sub = '';
select '4. A signed-out visitor       -> refused below (want an error)';
select * from public.admin_accounts();

-- Now the owner, who IS on the allowlist.
reset role; set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

select '5. The owner lists accounts   -> rows: ' || count(*) || ' (want 3)'
  from public.admin_accounts();
select '6. ...and sees real emails    -> ' || email from public.admin_accounts()
  where email = 'aisha@example.com';
select '7. ...and how often they came -> ' || days_active || ' days (want 2)'
  from public.admin_accounts() where email = 'aisha@example.com';
select '8. The numbers come back      -> accounts: ' ||
       (public.admin_stats()->>'accounts') || ' (want 3)';

-- The line that matters. Aisha has written something; the panel must have no
-- way to reach it, even for the owner.
reset role;
insert into public.user_state (user_id, key, value) values
  ('11111111-1111-1111-1111-111111111111', 'innerly:reflections',
   '["the thing I have told nobody"]'::jsonb)
on conflict do nothing;

set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select '9. Owner reads her writing    -> rows: ' || count(*) || ' (want 0)'
  from public.user_state
  where user_id = '11111111-1111-1111-1111-111111111111';
select '10. ...any writing at all     -> rows: ' || count(*) || ' (want 0)'
  from public.user_state;
select '11. ...her reflections table  -> rows: ' || count(*) || ' (want 0)'
  from public.reflections;

-- The log is readable by an admin and writable by nobody through the panel.
select '12. The audit log, as owner   -> rows: ' || count(*) || ' (want 0 so far)'
  from public.admin_actions;

-- Even an admin cannot write to it from a browser session: the server does
-- that with the service key, so a record cannot be quietly edited.
insert into public.admin_actions (actor_email, target_email, action)
  values ('owner@example.com', 'aisha@example.com', 'delete');
