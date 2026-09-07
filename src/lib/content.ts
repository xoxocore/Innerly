// Seed content — tutorials ported verbatim from the v48 build.

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
