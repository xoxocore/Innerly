import { HORIZONS, type Goal, type Horizon, type SubGoal } from "./types";

/**
 * The goal cascade, and the turn of the day.
 *
 * A goal is a chain of time — a year, then six months, then three, a month, a
 * week, today — and the point of writing it that way is that the far end
 * eventually becomes something to do this afternoon. These are the two rules
 * that make it move, kept as plain functions so they can be reasoned about and
 * tested without a browser anywhere near them.
 */

/** Nearest first, which is the direction work flows. */
const NEAREST_FIRST = [...HORIZONS].reverse().map((h) => h.key);

const open = (list: SubGoal[]) => list.filter((s) => !s.done);

/**
 * Let the next thing fall into the gap that finishing something just made.
 *
 * A tier asks to be refilled when it holds work and all of that work is done —
 * completion is the trigger, not emptiness. The difference matters a great
 * deal: a goal with one line written against next year, and nothing below it
 * yet, would otherwise drain itself down into this afternoon the moment it was
 * created, which is the opposite of what writing a year down is for.
 *
 * A tier emptied by the turn of the day is the exception, and says so by asking
 * — `refillEmpty` is how the morning arrives with the next action already
 * waiting instead of a blank board.
 *
 * It settles rather than making a single pass, so clearing Today and This Week
 * together carries the month's action the whole way down. That is what makes it
 * a waterfall rather than one step.
 */
export function cascade(goal: Goal, refillEmpty: Horizon[] = []): Goal {
  const horizons = { ...goal.horizons };
  let moved = false;

  // Each move can let the next one through, so this runs until it settles.
  // Bounded by the number of tiers, which is the most anything can travel.
  for (let pass = 0; pass < NEAREST_FIRST.length; pass++) {
    let movedThisPass = false;

    for (let i = 0; i < NEAREST_FIRST.length - 1; i++) {
      const lower = NEAREST_FIRST[i];
      const upper = NEAREST_FIRST[i + 1];

      const held = horizons[lower];
      const wants =
        held.length > 0
          ? open(held).length === 0
          : refillEmpty.includes(lower);
      if (!wants) continue;

      const next = open(horizons[upper])[0];
      if (!next) continue;

      horizons[upper] = horizons[upper].filter((s) => s.id !== next.id);
      horizons[lower] = [...horizons[lower], { ...next, promotedFrom: upper }];
      movedThisPass = true;
      moved = true;
    }

    if (!movedThisPass) break;
  }

  return moved ? { ...goal, horizons } : goal;
}

/** Ticking a sub-action, with whatever the cascade makes of it. */
export function completeSub(goal: Goal, horizon: Horizon, id: string): Goal {
  const list = goal.horizons[horizon].map((s) =>
    s.id === id
      ? {
          ...s,
          done: !s.done,
          completedAt: s.done ? undefined : new Date().toISOString(),
        }
      : s
  );
  const next = { ...goal, horizons: { ...goal.horizons, [horizon]: list } };
  return cascade(next);
}

/**
 * Carry a goal's Today list into a new day.
 *
 * Anything unfinished comes with it and is marked as having been carried, so
 * the day is honest about what is left over rather than quietly presenting
 * last week's undone task as today's fresh idea. Anything finished moves into
 * the record of wins, where it stops taking up room on a working list but is
 * still there to look back at.
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

  return cascade(
    {
      ...goal,
      lastReset: day,
      wins: [...(goal.wins ?? []), ...finished],
      horizons: { ...goal.horizons, today: carried },
    },
    // A day cleared by finishing everything has earned the next action; a day
    // that was simply never used has not, so nothing is moved for it.
    finished.length > 0 ? ["today"] : []
  );
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
 * The cascade decides what happens on its own; this is the person overruling
 * it, which they must always be able to do. Dropped at the end of the target
 * list rather than the front, because a queue somebody arranged should not be
 * rearranged for them.
 */
export function moveSub(
  goal: Goal,
  from: Horizon,
  to: Horizon,
  id: string
): Goal {
  if (from === to) return goal;
  const item = goal.horizons[from].find((s) => s.id === id);
  if (!item) return goal;

  return {
    ...goal,
    horizons: {
      ...goal.horizons,
      [from]: goal.horizons[from].filter((s) => s.id !== id),
      // Moved on purpose, so it is no longer something the cascade did.
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
