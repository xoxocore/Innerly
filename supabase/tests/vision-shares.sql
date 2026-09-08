-- Can a stranger read a vision that was never shared with them?
--
-- Run against a THROWAWAY local Postgres, never a real project — it creates
-- accounts and writes rows. This is the first feature that lets anything out of
-- the private circle, so the answer wants to be a test result rather than an
-- opinion about the functions in 0011.
--
--   psql -f supabase/tests/stub.sql
--   psql -f supabase/migrations/0011_vision_shares.sql
--   psql -f supabase/tests/vision-shares.sql
--
-- Every line must read "want" and match. The errors along the way are expected
-- and are the point: the tables refuse to be read directly.

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'aisha@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com')
on conflict (id) do nothing;

/* ---------------------------------------------------------- Aisha shares one */

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select public.vision_share_put(
  'item-a', 'A calm morning routine', '<p>Because mornings set the day.</p>',
  '11111111-1111-1111-1111-111111111111/a.jpg', null
) as aisha_token \gset

select 'a token comes back' as check,
       length(:'aisha_token') >= 20 as got, true as want;

-- Sharing the same card twice keeps the link already sent working.
select public.vision_share_put(
  'item-a', 'A calm morning routine (edited)', '<p>Still mornings.</p>',
  '11111111-1111-1111-1111-111111111111/a.jpg', null
) = :'aisha_token' as got, true as want, 're-sharing keeps the same link' as check;

select 'and updates what it shows' as check,
       (select title from public.vision_shares where token = :'aisha_token')
         = 'A calm morning routine (edited)' as got, true as want;

/* ------------------------------------------------- Ben cannot touch her share */

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select 'another signed-in person sees none of her shares' as check,
       count(*) = 0 as got, true as want
from public.vision_shares;

select 'and her card is not among his own' as check,
       count(*) = 0 as got, true as want
from public.vision_share_mine();

-- Trying to revoke someone else's share does nothing rather than erroring,
-- which is the honest outcome: the row is not visible to update.
update public.vision_shares set revoked_at = now() where token = :'aisha_token';
select 'and he cannot revoke it' as check,
       (select revoked_at is null from public.vision_shares
        where token = :'aisha_token') as got, true as want
from (select set_config('request.jwt.claim.sub',
      '11111111-1111-1111-1111-111111111111', false)) _;

/* ------------------------------------------------ a stranger, with no account */

reset role;
set role anon;
reset request.jwt.claim.sub;

select 'a stranger cannot list the shares table' as check,
       count(*) = 0 as got, true as want
from public.vision_shares;

select 'nor the hearts table' as check,
       count(*) = 0 as got, true as want
from public.vision_share_hearts;

-- ...but the token they were given opens exactly one card.
select 'the token they were sent opens the card' as check,
       (select title from public.vision_share_get(:'aisha_token'))
         = 'A calm morning routine (edited)' as got, true as want;

select 'a token that was never issued opens nothing' as check,
       count(*) = 0 as got, true as want
from public.vision_share_get('not-a-real-token');

/* ------------------------------------------------------------------- hearts */

select 'a heart lands' as check,
       public.vision_share_heart(:'aisha_token', 'viewer-one-abcdef', true) = 1 as got,
       true as want;

select 'the same person tapping again is still one heart' as check,
       public.vision_share_heart(:'aisha_token', 'viewer-one-abcdef', true) = 1 as got,
       true as want;

select 'someone else makes it two' as check,
       public.vision_share_heart(:'aisha_token', 'viewer-two-abcdef', true) = 2 as got,
       true as want;

select 'and a heart can be taken back' as check,
       public.vision_share_heart(:'aisha_token', 'viewer-two-abcdef', false) = 1 as got,
       true as want;

select 'the card knows whether this reader hearted it' as check,
       (select hearted from public.vision_share_get(:'aisha_token', 'viewer-one-abcdef'))
         as got, true as want;

select 'and that a different reader did not' as check,
       (select hearted from public.vision_share_get(:'aisha_token', 'viewer-two-abcdef'))
         = false as got, true as want;

select 'a made-up viewer id is refused' as check,
       public.vision_share_heart(:'aisha_token', 'short', true) is null as got,
       true as want;

select 'hearts on a token that does not exist go nowhere' as check,
       public.vision_share_heart('not-a-real-token', 'viewer-one-abcdef', true) is null
         as got, true as want;

/* --------------------------------------------- the count comes back to Aisha */

reset role;
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select 'she sees the heart on her own board' as check,
       (select hearts from public.vision_share_mine() where item_id = 'item-a') = 1
         as got, true as want;

/* ------------------------------------------------------------- taking it back */

update public.vision_shares set revoked_at = now() where token = :'aisha_token';

reset role;
set role anon;
reset request.jwt.claim.sub;

select 'once revoked the link opens nothing' as check,
       count(*) = 0 as got, true as want
from public.vision_share_get(:'aisha_token');

select 'and a revoked card accepts no more hearts' as check,
       public.vision_share_heart(:'aisha_token', 'viewer-three-abcdef', true) is null
         as got, true as want;

reset role;
