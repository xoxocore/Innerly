// Seed content — blog posts and tutorials ported verbatim from the v48 build.

export type BlogPost = {
  slug: string;
  title: string;
  date: string;
  category: string;
  excerpt: string;
  content: string;
  gradient: [string, string];
};

export type Tutorial = {
  slug: string;
  title: string;
  duration: string;
  excerpt: string;
  content: string;
  gradient: [string, string];
};

export function gradient([from, to]: readonly [string, string]) {
  return `linear-gradient(135deg, ${from}, ${to})`;
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "the-quiet-cost-of-overthinking",
    title: "The quiet cost of overthinking",
    date: "2026-05-20",
    category: "Mindset",
    gradient: ["#f6d6e0", "#e7e1f0"],
    excerpt:
      "Overthinking feels like progress — like if we just analyse a little longer, we'll finally feel ready. But often it's avoidance wearing a thoughtful disguise.",
    content:
      "<p>Overthinking feels like progress — like if we just analyse a little longer, we'll finally feel ready. But often it's avoidance wearing a thoughtful disguise.</p><p>The mind loops because looping feels safer than acting. Each replay gives the illusion of control while quietly draining the energy we'd need to move.</p><p>A gentler way through isn't to think harder, but to <strong>notice</strong>: write the loop down, read it back slowly, and ask what one small, honest step would look like. Awareness loosens the grip that analysis tightens.</p>",
  },
  {
    slug: "why-patterns-repeat",
    title: "Why patterns repeat — and how noticing breaks them",
    date: "2026-05-12",
    category: "Patterns",
    gradient: ["#d7e8f2", "#eef0e6"],
    excerpt:
      "We rarely repeat patterns because we're weak. We repeat them because they once protected us. Seeing that clearly is where change begins.",
    content:
      "<p>We rarely repeat patterns because we're weak. We repeat them because they once protected us.</p><p>The behaviour that frustrates you today — avoiding, over-checking, pulling away — was probably a sensible response to an earlier moment. It worked then. It just isn't serving you now.</p><p>Change rarely comes from forcing. It comes from <em>observation</em>: catching the pattern mid-motion, naming it without judgment, and choosing differently the next small time it appears.</p>",
  },
  {
    slug: "consistency-is-kindness",
    title: "Consistency isn't discipline — it's kindness",
    date: "2026-05-03",
    category: "Habits",
    gradient: ["#f0e3d6", "#e9dcec"],
    excerpt:
      "If consistency keeps collapsing into guilt, the problem may not be your willpower — it may be the way you're speaking to yourself about it.",
    content:
      "<p>If consistency keeps collapsing into guilt, the problem may not be your willpower — it may be the way you're speaking to yourself about it.</p><p>Shame is a poor motivator. It buys a day or two of effort, then a longer stretch of avoidance. Self-kindness is slower but steadier: it lets you miss a day and return without the spiral.</p><p>Try measuring consistency in returns, not streaks. The goal isn't to never fall off — it's to make coming back easy.</p>",
  },
];

export const TUTORIALS: Tutorial[] = [
  {
    slug: "getting-started",
    title: "Getting started with Innerly",
    duration: "3 min",
    gradient: ["#f3d9e6", "#dfe7f2"],
    excerpt:
      "A gentle tour of the four spaces — Reflect, Plan, Manifest, and Vision — and how they fit together.",
    content:
      "<p>Innerly is built around one quiet loop: reflect, notice, plan, act, reflect again.</p><p>Start with the <strong>Reflective Journal</strong> when something feels heavy. Use the <strong>Daily Plan</strong> to turn intentions into a few small steps. Visit <strong>Manifestation</strong> and the <strong>Vision Board</strong> when you want to align with where you're headed.</p><p>There's no right order. Go where your attention is today.</p>",
  },
  {
    slug: "pause-and-review",
    title: "How to use Pause & Review",
    duration: "4 min",
    gradient: ["#e2eede", "#eadff0"],
    excerpt:
      "The most important step in the journal: re-reading your own words and marking what stands out.",
    content:
      "<p>After you write what happened and why, slow down. Re-read it as if a friend wrote it.</p><p>Select any sentence to <strong>highlight</strong> or <strong>underline</strong> it. Mark the lines that carry the most charge — the fears, the contradictions, the repeated ideas.</p><p>You're not looking for answers. You're letting the pattern show itself.</p>",
  },
  {
    slug: "calm-daily-plan",
    title: "Building a calm daily plan",
    duration: "3 min",
    gradient: ["#f0e6d6", "#e6dcf0"],
    excerpt:
      "Plan from your goals, not your guilt — and let unfinished tasks be information, not failure.",
    content:
      "<p>Add a few honest tasks for today. Set a goal under <strong>Beyond today</strong>, break it into steps, and watch them flow into your plan.</p><p>If something doesn't get done, that's okay. The next morning Innerly simply asks whether you'd like to reflect on why, or let it go.</p>",
  },
];

// Onboarding slides — hero + four messages, from v48.
export const ONBOARDING_SLIDES = [
  {
    hero: true,
    title: "Grow with yourself, quietly.",
    body: "A calm daily ritual for emotionally intentional living.",
  },
  {
    title: "Understand why you do what you do.",
    body: "Innerly helps you observe your thoughts and behaviors honestly.",
  },
  {
    title: "Notice patterns you normally ignore.",
    body: "Re-read your own reflections and uncover the loops you keep living.",
  },
  {
    title: "Align your behavior with the life you want.",
    body: "Turn awareness into intentional steps toward who you want to become.",
  },
  {
    title: "This is not AI therapy.",
    body: "A mirror, not a therapist. No advice, no diagnosis — just space to see yourself clearly.",
  },
];
