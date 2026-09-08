-- A vision card, sent to someone.
--
-- This is the first thing in Innerly that leaves the private circle, so the
-- shape of it matters more than the size. Three rules hold it together:
--
--   1. Sharing is per card, off until asked for, and revocable. There is no
--      "share my board".
--   2. A share is a SNAPSHOT, not a window. Editing the vision afterwards does
--      not silently change what somebody was sent, and nothing a reader can
--      reach ever touches the private board the vision came from.
--   3. The tables are never readable by an anonymous visitor. Everything a
--      reader can do goes through a security-definer function that demands the
--      token — otherwise a policy like "anyone may read unrevoked shares" would
--      let a stranger list every card anybody had ever shared.

create extension if not exists pgcrypto;

/* -------------------------------------------------------------- the share */

create table if not exists public.vision_shares (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The VisionItem this was taken from, so re-sharing updates rather than
  -- scattering a new link every time the button is pressed.
  item_id text not null,
  title text not null,
  description text,
  -- Where the photo lives in the private `visions` bucket. Never handed to a
  -- reader directly; the image route signs it on demand so that revoking a
  -- share genuinely closes the door.
  image_path text,
  -- An external or legacy image link, which needs no signing.
  image_url text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, item_id)
);

create index if not exists vision_shares_user_idx
  on public.vision_shares (user_id);

alter table public.vision_shares enable row level security;

-- The owner, and only over their own rows. Readers are served by the functions
-- below, which is why there is no policy for them here.
drop policy if exists "own shares" on public.vision_shares;
create policy "own shares" on public.vision_shares
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

/* ------------------------------------------------------------- the hearts */

create table if not exists public.vision_share_hearts (
  token text not null references public.vision_shares (token) on delete cascade,
  -- A random id the reader's own browser keeps. Not an identity and not
  -- claimed to be one: it exists so that one person tapping twice is one
  -- heart, and so they can take it back.
  viewer text not null,
  created_at timestamptz not null default now(),
  primary key (token, viewer)
);

alter table public.vision_share_hearts enable row level security;

-- No policies at all. Nothing reaches this table except the functions below.

/* ---------------------------------------------------------- what a reader may do */

-- The card behind a token. Security definer because the tables are closed:
-- knowing the token is the whole of the authority, and it grants exactly this.
create or replace function public.vision_share_get(share_token text, viewer_id text default null)
returns table (
  title text,
  description text,
  image_path text,
  image_url text,
  created_at timestamptz,
  hearts integer,
  hearted boolean
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    s.title,
    s.description,
    s.image_path,
    s.image_url,
    s.created_at,
    (select count(*)::integer from public.vision_share_hearts h where h.token = s.token),
    (
      viewer_id is not null
      and exists (
        select 1 from public.vision_share_hearts h
        where h.token = s.token and h.viewer = viewer_id
      )
    )
  from public.vision_shares s
  where s.token = share_token
    and s.revoked_at is null;
$$;

-- Leaving a heart, or taking it back. Idempotent either way, so a double tap
-- is one heart and a reload cannot inflate the count.
create or replace function public.vision_share_heart(
  share_token text,
  viewer_id text,
  loved boolean
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  total integer;
begin
  -- A revoked share accepts nothing, and an over-long viewer id is not one.
  if not exists (
    select 1 from public.vision_shares s
    where s.token = share_token and s.revoked_at is null
  ) or viewer_id is null or length(viewer_id) not between 8 and 64 then
    return null;
  end if;

  if loved then
    insert into public.vision_share_hearts (token, viewer)
    values (share_token, viewer_id)
    on conflict (token, viewer) do nothing;
  else
    delete from public.vision_share_hearts h
    where h.token = share_token and h.viewer = viewer_id;
  end if;

  select count(*)::integer into total
  from public.vision_share_hearts h
  where h.token = share_token;
  return total;
end;
$$;

revoke all on function public.vision_share_get(text, text) from public;
revoke all on function public.vision_share_heart(text, text, boolean) from public;
grant execute on function public.vision_share_get(text, text) to anon, authenticated;
grant execute on function public.vision_share_heart(text, text, boolean) to anon, authenticated;

/* ------------------------------------------------------- what an owner may do */

-- Share a card, or update what was already shared. Returns the token, which is
-- the same one every time for a given card so a link already sent keeps working.
create or replace function public.vision_share_put(
  p_item_id text,
  p_title text,
  p_description text,
  p_image_path text,
  p_image_url text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  select s.token into existing
  from public.vision_shares s
  where s.user_id = auth.uid() and s.item_id = p_item_id;

  if existing is not null then
    update public.vision_shares
    set title = p_title,
        description = p_description,
        image_path = p_image_path,
        image_url = p_image_url,
        revoked_at = null
    where token = existing;
    return existing;
  end if;

  -- Unguessable, and URL-safe. The token is the only thing standing between a
  -- card and the open internet, so it is not derived from anything knowable.
  existing := replace(replace(encode(gen_random_bytes(18), 'base64'), '+', '-'), '/', '_');

  insert into public.vision_shares
    (token, user_id, item_id, title, description, image_path, image_url)
  values
    (existing, auth.uid(), p_item_id, p_title, p_description, p_image_path, p_image_url);

  return existing;
end;
$$;

revoke all on function public.vision_share_put(text, text, text, text, text) from public;
grant execute on function public.vision_share_put(text, text, text, text, text) to authenticated;

-- How the board shows a heart count beside a card it has shared.
create or replace function public.vision_share_mine()
returns table (item_id text, token text, hearts integer)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    s.item_id,
    s.token,
    (select count(*)::integer from public.vision_share_hearts h where h.token = s.token)
  from public.vision_shares s
  where s.user_id = auth.uid() and s.revoked_at is null;
$$;

revoke all on function public.vision_share_mine() from public;
grant execute on function public.vision_share_mine() to authenticated;
