-- Innerly: telling people things.
--
-- Run after 0006. Safe to run more than once.
--
-- Notifications are written once and shown to many, so the row holds the
-- message and nothing about who it is for. Who has seen or dismissed one is a
-- separate row belonging to that person — which keeps "everybody gets this"
-- from meaning "a copy per account", and keeps the panel out of the business
-- of knowing who read what.

create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  title         text not null default '',
  body          text not null default '',
  -- Changes the icon and colour, nothing else.
  kind          text not null default 'news'
                check (kind in ('news', 'tip', 'feature')),
  -- Who it is meant for, worked out from when they signed up.
  audience      text not null default 'everyone'
                check (audience in ('everyone', 'new', 'returning')),
  -- 'now' shows as soon as it is published; 'scheduled' waits for its time;
  -- 'on_signin' greets somebody as they arrive, once per visit.
  trigger       text not null default 'now'
                check (trigger in ('now', 'scheduled', 'on_signin')),
  scheduled_for timestamptz,
  -- Optional: sends them somewhere in the app when tapped.
  link_view     text,
  published     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists notifications_live_idx
  on public.notifications (published, scheduled_for);

drop trigger if exists notifications_touch_updated_at on public.notifications;
create trigger notifications_touch_updated_at
  before update on public.notifications
  for each row execute function public.touch_updated_at();

-- Seen and dismissed, per person. Their row, nobody else's.
create table if not exists public.notification_state (
  notification_id uuid not null references public.notifications on delete cascade,
  user_id         uuid not null references auth.users on delete cascade,
  seen_at         timestamptz,
  dismissed_at    timestamptz,
  primary key (notification_id, user_id)
);

alter table public.notifications      enable row level security;
alter table public.notification_state enable row level security;

drop policy if exists "published notifications are readable" on public.notifications;
drop policy if exists "admins write notifications"           on public.notifications;

-- A published notification is readable by anyone signed in. Drafts and every
-- write are admin-only, the same shape as posts.
create policy "published notifications are readable" on public.notifications
  for select using (published = true or public.is_admin());
create policy "admins write notifications" on public.notifications
  for all using (public.is_admin()) with check (public.is_admin());

do $$
begin
  execute 'drop policy if exists "own state read"   on public.notification_state';
  execute 'drop policy if exists "own state write"  on public.notification_state';
  execute 'create policy "own state read"  on public.notification_state
             for select using (auth.uid() = user_id)';
  execute 'create policy "own state write" on public.notification_state
             for all using (auth.uid() = user_id) with check (auth.uid() = user_id)';
end $$;

-- How many people have seen each one. A count, so the panel can tell whether a
-- message landed without learning who was reading it.
create or replace function public.notification_counts()
returns table (notification_id uuid, seen bigint, dismissed bigint)
language sql
stable
security definer
set search_path = public
as $$
  select n.id,
         (select count(*) from public.notification_state s
            where s.notification_id = n.id and s.seen_at is not null),
         (select count(*) from public.notification_state s
            where s.notification_id = n.id and s.dismissed_at is not null)
  from public.notifications n;
$$;

revoke all on function public.notification_counts() from public, anon;
grant execute on function public.notification_counts() to authenticated;
