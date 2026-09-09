import { HORIZONS, type Goal, type Horizon, type Step, type SubGoal } from "./types";

/**
 * The goal cascade: architected top-down, executed bottom-up, chosen by hand.
 *
 * A goal is a chain of time — a year, then six months, then three, a month, a
 * week — and it is built backwards, each rung a dependency of the one above it.
 * Work then moves the other way: finishing something today moves the week,
 * which moves the month.
 *
 * What does *not* happen anywhere in here is a machine deciding what somebody
 * does today. An earlier version of this file promoted the next action into
 * Today the moment the last one was ticked, and it was wrong in a way that took
 * a while to see. A queue that refills itself is a queue you stop reading: the
 * day arrives already decided, so the one moment in the whole system that asks
 * a person to look at their week and choose is spent watching something appear.
 * It also cannot know that today is a bad day, and will hand a full load to
 * somebody who has none — so the plan and the person quietly come apart, and
 * the plan is the one that gets abandoned.
 *
 * So promotion is a deliberate act — `takeIntoToday`, called because a person
 * pressed something — and these are the rules that hold around it:
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

const open = (list: SubGoal[]) => list.filter((s) => !s.done);

const hasSteps = (s: SubGoal) => (s.steps?.length ?? 0) > 0;

const HORIZON_KEYS = HORIZONS.map((h) => h.key);

/**
 * The sub-goals whose steps are on today's list.
 *
 * A weekly goal broken into steps does not leave the week when it is picked.
 * It stays written where it was written — that is the plan, and watching the
 * plan empty itself is not the same as making progress — and only its steps
 * come down to be done. It is finished when they are, at which point it is
 * struck through in the week where it has been sitting all along.
 */
export function activeSubs(goal: Goal): { sub: SubGoal; horizon: Horizon }[] {
  const out: { sub: SubGoal; horizon: Horizon }[] = [];
  for (const key of HORIZON_KEYS) {
    if (key === "today") continue;
    for (const s of goal.horizons[key]) {
      if (s.active && !s.done && hasSteps(s)) out.push({ sub: s, horizon: key });
    }
  }
  return out;
}

/** Everything today asks of you: its own actions, plus any borrowed steps. */
export function todaysWork(goal: Goal): {
  sub: SubGoal;
  horizon: Horizon;
  step?: Step;
  parent?: SubGoal;
}[] {
  const own = goal.horizons.today
    .filter((s) => !s.done)
    .map((s) => ({ sub: s, horizon: "today" as Horizon }));

  const borrowed = activeSubs(goal).flatMap(({ sub, horizon }) =>
    (sub.steps ?? [])
      .filter((t) => !t.done)
      .map((step) => ({
        sub: { id: step.id, title: step.title, done: step.done },
        horizon,
        step,
        parent: sub,
      }))
  );

  return [...own, ...borrowed];
}

/* ------------------------------------------------------------- the picks */

/**
 * What a goal is asking of today, counted the way a person feels it.
 *
 * A weekly goal being worked on is one thing you are doing, however many steps
 * it happens to break into — so it counts once. Counting its steps separately
 * would put a careful plan over the cap and a vague one under it, which is
 * exactly backwards.
 */
export function picksOf(goal: Goal): { sub: SubGoal; horizon: Horizon }[] {
  return [
    ...open(goal.horizons.today).map((sub) => ({ sub, horizon: "today" as Horizon })),
    ...activeSubs(goal),
  ];
}

/** How full the day is, across every goal. Rule B is about the day, not a goal. */
export function dayLoad(goals: Goal[]): number {
  return goals.reduce((n, g) => n + picksOf(g).length, 0);
}

export function atCapacity(goals: Goal[]): boolean {
  return dayLoad(goals) >= DAILY_CAP;
}

/**
 * Take something into today. The one way anything gets there.
 *
 * A sub-goal broken into steps lends them and stays where it was written; one
 * that is a single action moves, and carries a note of where it came from so
 * today can say what it is in service of.
 *
 * The cap is not enforced here on purpose: this sees one goal and the cap is
 * about the whole day, so the caller — which can count every goal — is the only
 * thing in a position to say no, and the only thing able to say why.
 */
export function takeIntoToday(goal: Goal, from: Horizon, id: string): Goal {
  if (from === "today") return goal;
  const sub = goal.horizons[from].find((s) => s.id === id);
  if (!sub || sub.done) return goal;

  if (hasSteps(sub)) {
    if (sub.active) return goal;
    return {
      ...goal,
      horizons: {
        ...goal.horizons,
        [from]: goal.horizons[from].map((s) =>
          s.id === id ? { ...s, active: true } : s
        ),
      },
    };
  }

  return {
    ...goal,
    horizons: {
      ...goal.horizons,
      [from]: goal.horizons[from].filter((s) => s.id !== id),
      today: [...goal.horizons.today, { ...sub, promotedFrom: from }],
    },
  };
}

/**
 * Put something back — the other half of choosing.
 *
 * A choice you cannot reverse is not really a choice, and a day that turns out
 * to hold two things instead of three should be able to say so without anybody
 * having to tick something they did not do.
 */
export function putBack(goal: Goal, horizon: Horizon, id: string): Goal {
  const sub = goal.horizons[horizon].find((s) => s.id === id);
  if (!sub) return goal;

  // Borrowed steps: the sub-goal never left, so this only stops it lending.
  if (horizon !== "today") {
    if (!sub.active) return goal;
    return {
      ...goal,
      horizons: {
        ...goal.horizons,
        [horizon]: goal.horizons[horizon].map((s) =>
          s.id === id ? { ...s, active: undefined, primary: undefined } : s
        ),
      },
    };
  }

  const home = sub.promotedFrom;
  if (!home) return goal;
  return {
    ...goal,
    horizons: {
      ...goal.horizons,
      today: goal.horizons.today.filter((s) => s.id !== id),
      [home]: [
        ...goal.horizons[home],
        { ...sub, promotedFrom: undefined, primary: undefined, rolledOver: undefined },
      ],
    },
  };
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
  const already = goals.some(
    (g) =>
      g.id === goalId &&
      HORIZON_KEYS.some((k) =>
        g.horizons[k].some((s) => s.id === subId && s.primary)
      )
  );

  return goals.map((goal) => {
    let touched = false;
    const horizons = { ...goal.horizons };
    for (const key of HORIZON_KEYS) {
      let keyTouched = false;
      const next = horizons[key].map((s) => {
        const want = goal.id === goalId && s.id === subId && !already;
        if (!!s.primary === want) return s;
        keyTouched = true;
        return { ...s, primary: want ? true : undefined };
      });
      if (keyTouched) {
        horizons[key] = next;
        touched = true;
      }
    }
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
 * A sub-goal broken into steps is finished exactly when its steps are.
 *
 * Which means the tick on the parent stops being something to set and becomes
 * something to read. Ticking the last step finishes the whole line, and
 * reopening any step reopens it — nobody has to remember to go back and tick
 * the heading they already satisfied.
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
    // struck through, but it stops asking anything of today and gives up the
    // day's one primary slot rather than holding it.
    active: done ? undefined : sub.active,
    primary: done ? undefined : sub.primary,
  };
}

/** Ticking a sub-action. Nothing takes its place; that is tomorrow's choice. */
export function completeSub(goal: Goal, horizon: Horizon, id: string): Goal {
  const list = goal.horizons[horizon].map((s) => {
    if (s.id !== id) return s;
    const done = !s.done;
    return {
      ...s,
      done,
      completedAt: done ? new Date().toISOString() : undefined,
      active: done ? undefined : s.active,
      primary: done ? undefined : s.primary,
      // Ticking a heading means its parts are done, and unticking it means
      // they are not. Leaving the steps behind would show a finished line
      // sitting above unfinished work.
      steps: s.steps?.map((t) => ({ ...t, done })),
    };
  });
  return { ...goal, horizons: { ...goal.horizons, [horizon]: list } };
}

/** Ticking one step, and letting its heading follow. */
export function completeStep(
  goal: Goal,
  horizon: Horizon,
  subId: string,
  stepId: string
): Goal {
  const list = goal.horizons[horizon].map((s) =>
    s.id === subId
      ? settle({
          ...s,
          steps: s.steps?.map((t) =>
            t.id === stepId ? { ...t, done: !t.done } : t
          ),
        })
      : s
  );
  return { ...goal, horizons: { ...goal.horizons, [horizon]: list } };
}

/** Adding, renaming and removing the parts of a sub-goal. */
export function editSteps(
  goal: Goal,
  horizon: Horizon,
  subId: string,
  change: (steps: Step[]) => Step[]
): Goal {
  const list = goal.horizons[horizon].map((s) =>
    s.id === subId ? settle({ ...s, steps: change(s.steps ?? []) }) : s
  );
  return { ...goal, horizons: { ...goal.horizons, [horizon]: list } };
}

/** How far through its steps a sub-goal is, or null when it has none. */
export function stepProgress(sub: SubGoal): { done: number; total: number } | null {
  if (!sub.steps || sub.steps.length === 0) return null;
  return { done: sub.steps.filter((t) => t.done).length, total: sub.steps.length };
}

/* -------------------------------------------------------- the day's turn */

/**
 * Carry a goal's Today list into a new day.
 *
 * Anything unfinished comes with it and is marked as having been carried, so
 * the day is honest about what is left over rather than quietly presenting
 * last week's undone task as today's fresh idea. Anything finished moves into
 * the record of wins, where it stops taking up room on a working list but is
 * still there to look back at.
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

  const finished = goal.horizons.today.filter((s) => s.done);
  const carried = goal.horizons.today
    .filter((s) => !s.done)
    .map((s) => (s.rolledOver ? s : { ...s, rolledOver: true }));

  return {
    ...goal,
    lastReset: day,
    wins: [...(goal.wins ?? []), ...finished],
    horizons: { ...goal.horizons, today: carried },
  };
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

/**
 * Move a sub-action to another horizon by hand.
 *
 * Re-planning rather than picking: this is how something written against the
 * month becomes something written against the week. Dropped at the end of the
 * target list rather than the front, because a queue somebody arranged should
 * not be rearranged for them.
 */
export function moveSub(
  goal: Goal,
  from: Horizon,
  to: Horizon,
  id: string
): Goal {
  if (from === to) return goal;
  if (to === "today") return takeIntoToday(goal, from, id);
  const item = goal.horizons[from].find((s) => s.id === id);
  if (!item) return goal;

  return {
    ...goal,
    horizons: {
      ...goal.horizons,
      [from]: goal.horizons[from].filter((s) => s.id !== id),
      [to]: [...goal.horizons[to], { ...item, promotedFrom: undefined }],
    },
  };
}

/** Today's finished actions — the ones the drawer counts. */
export function winsToday(goal: Goal): SubGoal[] {
  return goal.horizons.today.filter((s) => s.done);
}

/** What is actually left to do today. */
export function openToday(goal: Goal): SubGoal[] {
  return goal.horizons.today.filter((s) => !s.done);
}
