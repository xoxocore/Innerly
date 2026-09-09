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

/** One action, shown in a nearer tier than the target that owns it. */
export type Borrowed = {
  /** The action itself. Ticking it is ticking it inside its target. */
  step: Step;
  /** The target it belongs to, and where that target is written. */
  parent: SubGoal;
  parentHorizon: Horizon;
};

/**
 * The actions scheduled into one tier from targets written further out.
 *
 * A target broken into actions does not travel. It stays written where it was
 * written — that is the plan, and watching the plan empty itself is not the
 * same as making progress — and its actions are scheduled down one at a time.
 * "Finalise the user interface" sits in the month with its count climbing,
 * while "Notifications + stickers" is on this week, tagged with the target it
 * is in service of. The target is struck through when its actions are done, in
 * the month where it has been sitting all along.
 */
export function borrowedAt(goal: Goal, horizon: Horizon): Borrowed[] {
  const out: Borrowed[] = [];
  for (const key of HORIZON_KEYS) {
    if (key === horizon) continue;
    for (const parent of goal.horizons[key]) {
      if (parent.done) continue;
      for (const step of parent.steps ?? []) {
        if (!step.done && step.at === horizon) {
          out.push({ step, parent, parentHorizon: key });
        }
      }
    }
  }
  return out;
}

/** The targets currently lending an action to somewhere nearer. */
export function lentSubs(goal: Goal): { sub: SubGoal; horizon: Horizon }[] {
  const out: { sub: SubGoal; horizon: Horizon }[] = [];
  for (const key of HORIZON_KEYS) {
    for (const s of goal.horizons[key]) {
      if (!s.done && (s.steps ?? []).some((t) => !t.done && t.at)) {
        out.push({ sub: s, horizon: key });
      }
    }
  }
  return out;
}

/** Whether any of a target's open actions are scheduled onto a given tier. */
export function isOn(sub: SubGoal, horizon: Horizon): boolean {
  return (sub.steps ?? []).some((t) => !t.done && t.at === horizon);
}

/** Everything today asks of you: its own actions, plus any borrowed ones. */
export function todaysWork(goal: Goal): {
  sub: SubGoal;
  horizon: Horizon;
  step?: Step;
  parent?: SubGoal;
}[] {
  const own = goal.horizons.today
    .filter((s) => !s.done)
    .map((s) => ({ sub: s, horizon: "today" as Horizon }));

  const borrowed = borrowedAt(goal, "today").map(({ step, parent, parentHorizon }) => ({
    sub: { id: step.id, title: step.title, done: step.done },
    horizon: parentHorizon,
    step,
    parent,
  }));

  return [...own, ...borrowed];
}

/** The tier one closer than this one, or null at Today. */
export function nearer(h: Horizon): Horizon | null {
  const i = HORIZON_KEYS.indexOf(h);
  return i >= 0 && i < HORIZON_KEYS.length - 1 ? HORIZON_KEYS[i + 1] : null;
}

/** Where an action currently sits: where it was pushed to, or its target's tier. */
export function stepAt(step: Step, parentHorizon: Horizon): Horizon {
  return step.at ?? parentHorizon;
}

/**
 * Push one action a tier closer, leaving its target where it is.
 *
 * This is the arrow on an action's own row, and it is how a month's target
 * turns into this week's work without the target itself pretending to be a
 * weekly one. Nothing is copied: the line the week shows is the same object
 * the target counts, so ticking it there moves the target's progress.
 */
export function pushStep(
  goal: Goal,
  horizon: Horizon,
  subId: string,
  stepId: string,
  to?: Horizon
): Goal {
  const parent = goal.horizons[horizon].find((s) => s.id === subId);
  const step = parent?.steps?.find((t) => t.id === stepId);
  if (!parent || !step || step.done) return goal;

  const target = to ?? nearer(stepAt(step, horizon));
  if (!target || target === stepAt(step, horizon)) return goal;

  return {
    ...goal,
    horizons: {
      ...goal.horizons,
      [horizon]: goal.horizons[horizon].map((s) =>
        s.id !== subId
          ? s
          : {
              ...s,
              steps: s.steps?.map((t) => (t.id === stepId ? { ...t, at: target } : t)),
            },
      ),
    },
  };
}

/** Send an action back to its target — the other half of pushing it down. */
export function pullStep(
  goal: Goal,
  horizon: Horizon,
  subId: string,
  stepId: string
): Goal {
  const parent = goal.horizons[horizon].find((s) => s.id === subId);
  if (!parent?.steps?.some((t) => t.id === stepId && t.at)) return goal;

  return {
    ...goal,
    horizons: {
      ...goal.horizons,
      [horizon]: goal.horizons[horizon].map((s) =>
        s.id !== subId
          ? s
          : {
              ...s,
              steps: s.steps?.map((t) =>
                t.id === stepId ? { ...t, at: undefined } : t
              ),
            },
      ),
    },
  };
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
  const lending: { sub: SubGoal; horizon: Horizon }[] = [];
  for (const key of HORIZON_KEYS) {
    if (key === "today") continue;
    for (const sub of goal.horizons[key]) {
      if (!sub.done && isOn(sub, "today")) lending.push({ sub, horizon: key });
    }
  }
  return [
    ...open(goal.horizons.today).map((sub) => ({ sub, horizon: "today" as Horizon })),
    ...lending,
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

  // A target with actions sends them all down and stays where it was written.
  // The per-action arrow is the finer version of this; this is the whole
  // target at once, which is what pressing Today on its own row means.
  if (hasSteps(sub)) {
    if (isOn(sub, "today")) return goal;
    return {
      ...goal,
      horizons: {
        ...goal.horizons,
        [from]: goal.horizons[from].map((s) =>
          s.id === id
            ? {
                ...s,
                steps: s.steps?.map((t) =>
                  t.done ? t : { ...t, at: "today" as Horizon }
                ),
              }
            : s
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

  // A lending target never left, so this only calls its actions home.
  if (horizon !== "today") {
    if (!isOn(sub, "today")) return goal;
    return {
      ...goal,
      horizons: {
        ...goal.horizons,
        [horizon]: goal.horizons[horizon].map((s) =>
          s.id === id
            ? {
                ...s,
                primary: undefined,
                steps: s.steps?.map((t) =>
                  t.at === "today" ? { ...t, at: undefined } : t
                ),
              }
            : s
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
    // struck through, but it stops asking anything of any tier and gives up
    // the day's one primary slot rather than holding it.
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
      primary: done ? undefined : s.primary,
      // Ticking a target means its actions are done, and unticking it means
      // they are not. Leaving them behind would show a finished line sitting
      // above unfinished work — and a finished action is scheduled nowhere.
      steps: s.steps?.map((t) => ({ ...t, done, at: done ? undefined : t.at })),
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
