-- Innerly: writing lives in the database now.
--
-- Run after 0005. Safe to run more than once.
--
-- The Blog and Tutorials screens read a hardcoded list in src/lib/content.ts,
-- which means the only way to publish anything is a code change. This moves
-- those six pieces into the posts table so the admin panel can edit them, and
-- so anything written from now on appears without a deploy.
--
-- The posts table itself was built in 0001 and already has its policies:
-- published posts are readable by the whole world, drafts and every write are
-- admin-only. Nothing here loosens that.

/* ------------------------------------------------------------ reading it --- */

-- Reads per post, one row per person per day. A day is enough to answer "how
-- many people read this"; anything finer would be a log of when somebody read
-- something, which is nobody's business.
create table if not exists public.post_reads (
  post_id    uuid not null references public.posts on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  day        date not null default current_date,
  seconds    integer not null default 0,
  primary key (post_id, user_id, day)
);
create index if not exists post_reads_post_idx on public.post_reads (post_id);

-- Hearts. One per person per post, and theirs to take back.
create table if not exists public.post_hearts (
  post_id    uuid not null references public.posts on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_hearts_post_idx on public.post_hearts (post_id);

alter table public.post_reads  enable row level security;
alter table public.post_hearts enable row level security;

do $$
declare t text;
begin
  foreach t in array array['post_reads', 'post_hearts'] loop
    execute format('drop policy if exists "own read row"   on public.%I', t);
    execute format('drop policy if exists "own insert row" on public.%I', t);
    execute format('drop policy if exists "own update row" on public.%I', t);
    execute format('drop policy if exists "own delete row" on public.%I', t);
    -- Your own row only. An admin sees the totals through a function below,
    -- never the rows — who read what is not something the panel needs.
    execute format(
      'create policy "own read row"   on public.%I for select using (auth.uid() = user_id)', t);
    execute format(
      'create policy "own insert row" on public.%I for insert with check (auth.uid() = user_id)', t);
    execute format(
      'create policy "own update row" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format(
      'create policy "own delete row" on public.%I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- How many hearts a post has, for everyone to see. Counts only — never who.
create or replace function public.post_counts()
returns table (post_id uuid, hearts bigint, readers bigint)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
         (select count(*) from public.post_hearts h where h.post_id = p.id),
         (select count(distinct r.user_id) from public.post_reads r where r.post_id = p.id)
  from public.posts p
  where p.published;
$$;

grant execute on function public.post_counts() to anon, authenticated;

/* ---------------------------------------------------------- what exists ---- */

-- The six pieces that were in the code. Matched on (kind, slug), which is
-- already unique, so running this twice changes nothing.
insert into public.posts
  (kind, slug, title, excerpt, content, category, duration, gradient, published, published_at)
values
  ('blog', 'the-quiet-cost-of-overthinking', 'The quiet cost of overthinking', 'Overthinking feels like progress — like if we just analyse a little longer, we''ll finally feel ready. But often it''s avoidance wearing a thoughtful disguise.',
   '<p>Overthinking feels like progress — like if we just analyse a little longer, we''ll finally feel ready. But often it''s avoidance wearing a thoughtful disguise.</p><p>The mind loops because looping feels safer than acting. Each replay gives the illusion of control while quietly draining the energy we''d need to move.</p><p>A gentler way through isn''t to think harder, but to <strong>notice</strong>: write the loop down, read it back slowly, and ask what one small, honest step would look like. Awareness loosens the grip that analysis tightens.</p>',
   'Mindset', null, array['#f6d6e0', '#e7e1f0'], true,
   '2026-05-20'::timestamptz),
  ('blog', 'why-patterns-repeat', 'Why patterns repeat — and how noticing breaks them', 'We rarely repeat patterns because we''re weak. We repeat them because they once protected us. Seeing that clearly is where change begins.',
   '<p>We rarely repeat patterns because we''re weak. We repeat them because they once protected us.</p><p>The behaviour that frustrates you today — avoiding, over-checking, pulling away — was probably a sensible response to an earlier moment. It worked then. It just isn''t serving you now.</p><p>Change rarely comes from forcing. It comes from <em>observation</em>: catching the pattern mid-motion, naming it without judgment, and choosing differently the next small time it appears.</p>',
   'Patterns', null, array['#d7e8f2', '#eef0e6'], true,
   '2026-05-12'::timestamptz),
  ('blog', 'consistency-is-kindness', 'Consistency isn''t discipline — it''s kindness', 'If consistency keeps collapsing into guilt, the problem may not be your willpower — it may be the way you''re speaking to yourself about it.',
   '<p>If consistency keeps collapsing into guilt, the problem may not be your willpower — it may be the way you''re speaking to yourself about it.</p><p>Shame is a poor motivator. It buys a day or two of effort, then a longer stretch of avoidance. Self-kindness is slower but steadier: it lets you miss a day and return without the spiral.</p><p>Try measuring consistency in returns, not streaks. The goal isn''t to never fall off — it''s to make coming back easy.</p>',
   'Habits', null, array['#f0e3d6', '#e9dcec'], true,
   '2026-05-03'::timestamptz),
  ('tutorial', 'getting-started', 'Getting started with Innerly', 'A gentle tour of the four spaces — Reflect, Plan, Manifest, and Vision — and how they fit together.',
   '<p>Innerly is built around one quiet loop: reflect, notice, plan, act, reflect again.</p><p>Start with the <strong>Reflective Journal</strong> when something feels heavy. Use the <strong>Daily Plan</strong> to turn intentions into a few small steps. Visit <strong>Manifestation</strong> and the <strong>Vision Board</strong> when you want to align with where you''re headed.</p><p>There''s no right order. Go where your attention is today.</p>',
   null, '3 min', array['#f3d9e6', '#dfe7f2'], true,
   now()),
  ('tutorial', 'pause-and-review', 'How to use Pause & Review', 'The most important step in the journal: re-reading your own words and marking what stands out.',
   '<p>After you write what happened and why, slow down. Re-read it as if a friend wrote it.</p><p>Select any sentence to <strong>highlight</strong> or <strong>underline</strong> it. Mark the lines that carry the most charge — the fears, the contradictions, the repeated ideas.</p><p>You''re not looking for answers. You''re letting the pattern show itself.</p>',
   null, '4 min', array['#e2eede', '#eadff0'], true,
   now()),
  ('tutorial', 'calm-daily-plan', 'Building a calm daily plan', 'Plan from your goals, not your guilt — and let unfinished tasks be information, not failure.',
   '<p>Add a few honest tasks for today. Set a goal under <strong>Beyond today</strong>, break it into steps, and watch them flow into your plan.</p><p>If something doesn''t get done, that''s okay. The next morning Innerly simply asks whether you''d like to reflect on why, or let it go.</p>',
   null, '3 min', array['#f0e6d6', '#e6dcf0'], true,
   now())
on conflict (kind, slug) do nothing;
