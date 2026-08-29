-- Does the admin panel's activity data actually work, and does adding it open
-- any door to what people wrote?
--
-- Throwaway database only. Run after stub.sql, 0001, 0002, setup.sql, 0004, 0005.
-- Every line must match its "want".

grant usage on schema public, storage to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.admin_accounts(), public.admin_stats() to authenticated;

insert into auth.users (id, email, email_confirmed_at) values
  ('11111111-1111-1111-1111-111111111111', 'aisha@example.com', now()),
  ('33333333-3333-3333-3333-333333333333', 'owner@example.com', now())
on conflict (id) do nothing;
insert into public.admins (user_id) values ('33333333-3333-3333-3333-333333333333')
on conflict do nothing;

-- Aisha opens the app, exactly as the browser now does.
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.usage_days (user_id, day) values
  ('11111111-1111-1111-1111-111111111111', current_date),
  ('11111111-1111-1111-1111-111111111111', current_date - 1),
  ('11111111-1111-1111-1111-111111111111', current_date - 2)
on conflict do nothing;
update public.profiles set last_active_at = now()
  where id = '11111111-1111-1111-1111-111111111111';

-- Can she touch anybody else's presence? She should not.
update public.profiles set last_active_at = now()
  where id = '33333333-3333-3333-3333-333333333333';
select '1. Aisha fakes the owner''s presence -> ' ||
  coalesce((select last_active_at::text from public.profiles
            where id = '33333333-3333-3333-3333-333333333333'), 'null (want null)');

-- Now the owner reads the panel.
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select '2. Days used shows up            -> ' || days_active || ' (want 3)'
  from public.admin_accounts() where email = 'aisha@example.com';
select '3. Last seen is a real timestamp -> ' ||
  case when last_active_at > now() - interval '1 minute' then 'just now (want just now)'
       else 'stale' end
  from public.admin_accounts() where email = 'aisha@example.com';
select '4. Counted as here right now     -> ' ||
  (public.admin_stats()->>'online_now') || ' (want 1)';
select '5. Counted as active today       -> ' ||
  (public.admin_stats()->>'active_today') || ' (want 1)';
select '6. The 30-day chart has data     -> ' ||
  (select count(*) from jsonb_array_elements(public.admin_stats()->'daily') d
   where (d->>'active')::int > 0) || ' days with activity (want 3)';

-- And none of this opened a door to her writing.
reset role;
insert into public.user_state (user_id, key, value) values
  ('11111111-1111-1111-1111-111111111111', 'innerly:reflections', '["private"]'::jsonb)
on conflict do nothing;
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select '7. Owner can still read nothing  -> ' || count(*) || ' (want 0)'
  from public.user_state;
