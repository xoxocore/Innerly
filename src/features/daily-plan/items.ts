import {
  HORIZON_SHORT,
  horizonDate,
  type Goal,
  type Horizon,
  type SubGoal,
} from "@/lib/types";
import { placements } from "@/lib/cascade";

export type PlanItem = {
  goalId: string;
  goalTitle: string;
  color: string;
  horizon: Horizon;
  horizonLabel: string;
  sub: SubGoal;
  date: Date;
  /** Where in the goal's tree the line lives, so a tick can find it again. */
  home: Horizon;
  path: string[];
};

/**
 * Every line of one goal, on the date of the tier it is actually shown in.
 *
 * Read through `placements` rather than off the horizon lists directly,
 * because those two answers differ the moment anything is pushed down: an
 * action of a month's target that is being worked on this week belongs on the
 * calendar at the week, not the month. A calendar that disagreed with the
 * thread beside it would be worse than no calendar.
 */
export function goalItems(goal: Goal): PlanItem[] {
  const base = new Date(goal.createdAt);
  return placements(goal).map(({ sub, tier, home, path }) => ({
    goalId: goal.id,
    goalTitle: goal.title,
    color: goal.color,
    horizon: tier,
    horizonLabel: HORIZON_SHORT[tier],
    sub,
    date: horizonDate(base, tier),
    home,
    path,
  }));
}

export function allItems(goals: Goal[]): PlanItem[] {
  return goals.flatMap(goalItems);
}

export const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export function formatItemDate(d: Date) {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
