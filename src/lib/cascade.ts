import { HORIZONS, type Goal, type Horizon, type SubGoal } from "./types";

/**
 * The goal ladder: architected top-down, executed bottom-up, moved by hand.
 *
 * A goal is a chain of time — a year, then six months, then three, a month, a
 * week, today — and it is built backwards, each rung a dependency of the one
 * above it. Work then moves the other way: finishing something today moves the
 * week, which moves the month.
 *
 * Two rules shape everything in this file.
 *
 * The first is that no machine decides what somebody does today. An earlier
 * version promoted the next action the moment the last was ticked, and it was
 * wrong in a way that took a while to see: a queue that refills itself is a
 * queue you stop reading, so the day arrives already decided and the one moment
 * that asks a person to look at their week and choose is spent watching
 * something appear. It cannot know today is a bad day, either, and hands a full
 * load to somebody who has none.
 *
 * The second is that work descends one rung at a time. A year's target cannot
 * become this afternoon's errand in a single press — it becomes a six-month
 * target, then a three-month one, then a month's, and each of those is a
 * decision somebody made with the tier above it in front of them. Skipping the
 * middle is how a plan turns into a wish with a deadline attached.
 *
 * Those two together are why a line and its position are separate things. A
 * line lives inside the target it belongs to, wherever that was written, and
 * carries `at` to say which nearer tier its doing has been scheduled into.
 * Nothing is ever copied, so ticking it anywhere moves the count everywhere.
 *
 * Around the choice of what today holds, three more rules:
 *
 *   A. One primary. The single task that makes the rest easier or unnecessary.
 *   B. Three at most. A day given more than it has room for manufactures
 *      failure and forces the rollover it was trying to avoid.
 *   C. A verifiable output. "Work on the UI" cannot be ticked honestly;
 *      "Wrap long task sentences in the daily plan" can.
 *
 * Kept as plain functions so all of it can be reasoned about and tested without
 * a browser anywhere near it.
 */

/** Rule B, the capacity cap. Three high-leverage things is a full day. */
export const DAILY_CAP = 3;

const HORIZON_KEYS = HORIZONS.map((h) => h.key);

/** Where a line sits: where it was pushed to, or wherever its parent sits. */
export type Placed = {
  sub: SubGoal;
  /** The tier it is shown in. */
  tier: Horizon;
  /** The line it belongs to, when that line is somewhere else. */
  parent?: SubGoal;
  /** Where that parent is shown, which is what the tag names. */
  parentTier?: Horizon;
  /** The horizon list at the root of this line's chain, for edits. */
  home: Horizon;
  /** Ids from the root of the chain down to this line, for edits. */
  path: string[];
};

/**
 * Walk a goal, working out where every line is actually shown.
 *
 * The plan is a tree and the tiers are a view of it: a line is shown wherever
 * it was pushed to, and a line that was never pushed is shown wherever its
 * parent is. Everything else in this file reads the tree through here, so there
 * is exactly one place that knows the rule.
 */
export function placements(goal: Goal): Placed[] {
  const out: Placed[] = [];

  const walk = (
    sub: SubGoal,
    parentTier: Horizon,
    home: Horizon,
    path: string[],
    parent?: SubGoal
  ) => {
    const tier = sub.at ?? parentTier;
    out.push({
      sub,
      tier,
      // Only worth naming when the line has left its parent behind; a line
      // shown under its own parent needs no tag saying so.
      parent: tier === parentTier ? undefined : parent,
      parentTier: tier === parentTier ? undefined : parentTier,
      home,
      path,
    });
    for (const child of sub.steps ?? []) {
      walk(child, tier, home, [...path, child.id], sub);
    }
  };

  for (const key of HORIZON_KEYS) {
    for (const sub of goal.horizons[key]) walk(sub, key, key, [sub.id]);
  }
  return out;
}

/** The lines shown in one tier, top level first, each with its own children. */
export function shownAt(goal: Goal, horizon: Horizon): Placed[] {
  return placements(goal).filter(
    (p) =>
      p.tier === horizon &&
      // A line shown under its own parent is drawn by that parent, not here.
      (p.parentTier !== undefined || p.path.length === 1)
  );
}

/** Whether a line's own children are drawn beneath it or off in another tier. */
export function childrenHere(sub: SubGoal, tier: Horizon): SubGoal[] {
  return (sub.steps ?? []).filter((t) => (t.at ?? tier) === tier);
}

/** Find one line anywhere in a goal, by the path that identifies it. */
export function findByPath(goal: Goal, home: Horizon, path: string[]): SubGoal | null {
  let list = goal.horizons[home];
  let found: SubGoal | null = null;
  for (const id of path) {
    found = list.find((s) => s.id === id) ?? null;
    if (!found) return null;
    list = found.steps ?? [];
  }
  return found;
}

/** Rewrite one line in place, leaving the rest of the tree untouched. */
export function editByPath(
  goal: Goal,
  home: Horizon,
  path: string[],
  change: (sub: SubGoal) => SubGoal
): Goal {
  const walk = (list: SubGoal[], depth: number): SubGoal[] =>
    list.map((s) => {
      if (s.id !== path[depth]) return s;
      if (depth === path.length - 1) return change(s);
      return settle({ ...s, steps: walk(s.steps ?? [], depth + 1) });
    });

  return {
    ...goal,
    horizons: { ...goal.horizons, [home]: walk(goal.horizons[home], 0) },
  };
}

/** The tier one closer than this one, or null at Today. */
export function nearer(h: Horizon): Horizon | null {
  const i = HORIZON_KEYS.indexOf(h);
  return i >= 0 && i < HORIZON_KEYS.length - 1 ? HORIZON_KEYS[i + 1] : null;
}

/** Take one line out of the tree, wherever it sits. */
export function removeByPath(goal: Goal, home: Horizon, path: string[]): Goal {
  if (path.length === 1) {
    return {
      ...goal,
      horizons: {
        ...goal.horizons,
        [home]: goal.horizons[home].filter((s) => s.id !== path[0]),
      },
    };
  }
  return editByPath(goal, home, path.slice(0, -1), (parent) =>
    settle({
      ...parent,
      steps: (parent.steps ?? []).filter((t) => t.id !== path[path.length - 1]),
    })
  );
}

/**
 * Push one line a tier closer, leaving the target it belongs to where it is.
 *
 * Exactly one rung, and never further. The arrow on a month's action says
 * "Weekly Goal" rather than "Today" because that is the only move it can make:
 * to work on it this afternoon you push it to the week, look at the week, and
 * push it again — and the second press is a second decision, made with the
 * week's other work in front of you.
 *
 * Its own children come with it, since they are parts of it and are shown
 * wherever it is.
 */
export function push(goal: Goal, home: Horizon, path: string[]): Goal {
  const placed = placements(goal).find(
    (p) => p.home === home && p.path.join("/") === path.join("/")
  );
  if (!placed || placed.sub.done) return goal;

  const to = nearer(placed.tier);
  if (!to) return goal;

  return editByPath(goal, home, path, (sub) => ({ ...sub, at: to }));
}

/**
 * Send a line back where it came from — the other half of pushing it.
 *
 * Back one rung, not all the way home, so undoing a push is the same size of
 * decision as making one.
 */
export function pull(goal: Goal, home: Horizon, path: string[]): Goal {
  const all = placements(goal);
  const placed = all.find(
    (p) => p.home === home && p.path.join("/") === path.join("/")
  );
  if (!placed?.sub.at) return goal;

  // Where it would sit with no `at` at all: its parent's tier, or its home.
  const parentTier =
    path.length === 1
      ? home
      : all.find(
          (p) => p.home === home && p.path.join("/") === path.slice(0, -1).join("/")
        )?.tier ?? home;

  const i = HORIZON_KEYS.indexOf(placed.tier);
  const back = HORIZON_KEYS[i - 1];
  // Never back past where it belongs.
  const to =
    HORIZON_KEYS.indexOf(back) <= HORIZON_KEYS.indexOf(parentTier) ? undefined : back;

  return editByPath(goal, home, path, (sub) => ({
    ...sub,
    at: to,
    primary: undefined,
  }));
}

/* ------------------------------------------------------------- the picks */

/**
 * What the day is holding, counted the way a person feels it.
 *
 * A line shown on Today is one thing you are doing, however many parts it
 * happens to break into — so it counts once and its children do not count
 * again. Counting the parts would put a careful plan over the cap and a vague
 * one under it, which is exactly backwards.
 */
export function picksOf(goal: Goal): Placed[] {
  return shownAt(goal, "today").filter((p) => !p.sub.done);
}

/** How full the day is, across every goal. Rule B is about the day, not a goal. */
export function dayLoad(goals: Goal[]): number {
  return goals.reduce((n, g) => n + picksOf(g).length, 0);
}

export function atCapacity(goals: Goal[]): boolean {
  return dayLoad(goals) >= DAILY_CAP;
}

/** Everything today asks of you, in the order the card shows it. */
export function todaysWork(goal: Goal): Placed[] {
  return picksOf(goal);
}

/* ------------------------------------------------------- Rule A: primary */

/** The one thing today, if it has been named. */
export function primaryOf(goals: Goal[]): { goal: Goal; sub: SubGoal } | null {
  for (const goal of goals) {
    for (const { sub } of picksOf(goal)) {
      if (sub.primary) return { goal, sub };
    }
  }
  return null;
}

/**
 * Name today's bottleneck, or take the name back.
 *
 * Across every goal, because a day has one of these. Setting a second would
 * mean two, and a day with two bottlenecks has none — so this clears the old
 * one wherever it happens to live rather than asking anybody to go and find it.
 */
export function setPrimary(goals: Goal[], goalId: string, subId: string): Goal[] {
  // Pressing the one that already holds it takes the name back, rather than
  // leaving a day permanently insisting one of its three matters most.
  let already = false;
  const scan = (list: SubGoal[]) => {
    for (const s of list) {
      if (s.id === subId && s.primary) already = true;
      if (s.steps) scan(s.steps);
    }
  };
  for (const g of goals) {
    if (g.id !== goalId) continue;
    for (const key of HORIZON_KEYS) scan(g.horizons[key]);
  }

  return goals.map((goal) => {
    let touched = false;
    const mark = (list: SubGoal[]): SubGoal[] =>
      list.map((s) => {
        const kids = s.steps ? mark(s.steps) : undefined;
        const want = goal.id === goalId && s.id === subId && !already;
        if (!!s.primary === want && kids === s.steps) return s;
        touched = true;
        return { ...s, primary: want ? true : undefined, steps: kids };
      });

    const horizons = { ...goal.horizons };
    for (const key of HORIZON_KEYS) horizons[key] = mark(horizons[key]);
    return touched ? { ...goal, horizons } : goal;
  });
}

/* ----------------------------------------------- Rule C: a real deliverable */

/**
 * Openers that describe an activity rather than a result.
 *
 * Every one of these can be true all day without anything having happened,
 * which is what makes them impossible to tick honestly — and a list you cannot
 * tick honestly stops being read.
 */
const ACTIVITY_OPENERS = [
  /^work(ing)? on\b/,
  /^think(ing)? about\b/,
  /^focus(ing)? on\b/,
  /^look (at|into)\b/,
  /^continue\b/,
  /^carry on\b/,
  /^keep (going|at)\b/,
  /^spend (some )?time\b/,
  /^try to\b/,
  /^start(ing)? (on|with)\b/,
  /^do (some|more)\b/,
  /^get (better|going|started)\b/,
  /^be better\b/,
  /^improve\b/,
  /^sort out\b/,
  /^deal with\b/,
];

/**
 * Whether a line names an activity instead of an output — Rule C.
 *
 * Advice, never a rule: this returns a hint for the interface to show quietly
 * beside the field, and nothing anywhere refuses to save on the strength of it.
 * A guess about somebody's wording is not grounds for standing between them and
 * their own plan, and the guess will sometimes be wrong.
 */
export function isVague(title: string): boolean {
  const t = title.trim().toLowerCase();
  if (!t) return false;
  // One word is a subject, not a deliverable: "onboarding", "emails".
  if (!/\s/.test(t)) return true;
  return ACTIVITY_OPENERS.some((re) => re.test(t));
}

export const VAGUE_HINT = "Name what will exist when it's done, not what you'll be doing.";

/* ------------------------------------------------------------ completion */

/**
 * A line with parts under it is finished exactly when they are.
 *
 * Which means the tick on it stops being something to set and becomes
 * something to read. Ticking the last part finishes the whole line, and
 * reopening any part reopens it — nobody has to remember to go back and tick
 * the heading they already satisfied. It applies at every depth, so a year's
 * target settles when its six-month parts do.
 */
export function settle(sub: SubGoal): SubGoal {
  const steps = sub.steps;
  if (!steps || steps.length === 0) return sub;

  const done = steps.every((t) => t.done);
  if (done === sub.done) return sub;
  return {
    ...sub,
    done,
    completedAt: done ? new Date().toISOString() : undefined,
    // Finished work is not work in progress. The line stays where it is,
    // struck through, but it gives up the day's one primary slot rather than
    // holding it.
    primary: done ? undefined : sub.primary,
  };
}

/** Tick a line, wherever in the tree it sits. Nothing takes its place. */
export function complete(goal: Goal, home: Horizon, path: string[]): Goal {
  const target = findByPath(goal, home, path);
  if (!target) return goal;
  const done = !target.done;

  // Ticking a heading means its parts are done, and unticking it means they
  // are not. Leaving them behind would show a finished line sitting above
  // unfinished work — and finished work is scheduled nowhere.
  const cascadeDown = (sub: SubGoal): SubGoal => ({
    ...sub,
    done,
    completedAt: done ? new Date().toISOString() : undefined,
    primary: done ? undefined : sub.primary,
    at: done ? undefined : sub.at,
    steps: sub.steps?.map(cascadeDown),
  });

  return editByPath(goal, home, path, cascadeDown);
}

/** Adding, renaming and removing the parts of a line. */
export function editParts(
  goal: Goal,
  home: Horizon,
  path: string[],
  change: (steps: SubGoal[]) => SubGoal[]
): Goal {
  return editByPath(goal, home, path, (sub) =>
    settle({ ...sub, steps: change(sub.steps ?? []) })
  );
}

/** How far through its parts a line is, or null when it has none. */
export function stepProgress(sub: SubGoal): { done: number; total: number } | null {
  if (!sub.steps || sub.steps.length === 0) return null;
  return { done: sub.steps.filter((t) => t.done).length, total: sub.steps.length };
}

/* -------------------------------------------------------- the day's turn */

/** Everything the day is showing, finished or not. */
function todayLines(goal: Goal): SubGoal[] {
  return shownAt(goal, "today").map((p) => p.sub);
}

/**
 * Carry a goal's day into the next one.
 *
 * Anything unfinished stays where it is and is marked as having been carried,
 * so the day is honest about what is left over rather than quietly presenting
 * last week's undone task as today's fresh idea. Anything finished moves into
 * the record of wins and off the day, where it stops taking up room on a
 * working list but is still there to look back at.
 *
 * Nothing new is added. The morning is meant to arrive with a short honest
 * list and a decision to make, not with a full one somebody else wrote — and a
 * board that filled itself overnight would have made that decision already.
 *
 * A goal that has never been through a day turn is only stamped with the date.
 * Nothing is carried or archived on that first pass — the list has not sat
 * through a night yet, and treating it as though it had would put a
 * "carried over" badge on something written twenty minutes ago.
 */
export function turnDay(goal: Goal, day: string): Goal {
  if (goal.lastReset === day) return goal;
  if (!goal.lastReset) return { ...goal, lastReset: day };

  const shown = todayLines(goal);
  const finished = new Set(shown.filter((s) => s.done).map((s) => s.id));
  const carried = new Set(shown.filter((s) => !s.done).map((s) => s.id));
  const wins = shown.filter((s) => s.done);

  // A line pushed down from a target is not deleted when the day turns: it
  // simply stops being scheduled, and goes back to sitting struck through
  // under the target whose count it already moved.
  const walk = (list: SubGoal[]): SubGoal[] =>
    list
      .filter((s) => !(finished.has(s.id) && !s.at))
      .map((s) => {
        const steps = s.steps ? walk(s.steps) : undefined;
        if (finished.has(s.id)) return { ...s, at: undefined, steps };
        if (carried.has(s.id) && !s.rolledOver) return { ...s, rolledOver: true, steps };
        return steps === s.steps ? s : { ...s, steps };
      });

  const horizons = { ...goal.horizons };
  for (const key of HORIZON_KEYS) horizons[key] = walk(horizons[key]);

  return { ...goal, lastReset: day, wins: [...(goal.wins ?? []), ...wins], horizons };
}

/** The whole board, brought up to today. */
export function turnAll(goals: Goal[], day: string): Goal[] {
  let changed = false;
  const next = goals.map((g) => {
    const turned = turnDay(g, day);
    if (turned !== g) changed = true;
    return turned;
  });
  return changed ? next : goals;
}

/** Today's finished work — the ones the drawer counts. */
export function winsToday(goal: Goal): SubGoal[] {
  return shownAt(goal, "today")
    .filter((p) => p.sub.done)
    .map((p) => p.sub);
}

/** What is actually left to do today. */
export function openToday(goal: Goal): SubGoal[] {
  return picksOf(goal).map((p) => p.sub);
}
