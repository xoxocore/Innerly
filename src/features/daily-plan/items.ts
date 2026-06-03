import {
  HORIZONS,
  HORIZON_SHORT,
  horizonDate,
  type Goal,
  type Horizon,
  type SubGoal,
} from "@/lib/types";

export type PlanItem = {
  goalId: string;
  goalTitle: string;
  color: string;
  horizon: Horizon;
  horizonLabel: string;
  sub: SubGoal;
  date: Date;
};

// All sub-goals of one goal, each resolved to a concrete calendar date.
export function goalItems(goal: Goal): PlanItem[] {
  const base = new Date(goal.createdAt);
  const out: PlanItem[] = [];
  for (const { key } of HORIZONS) {
    for (const sub of goal.horizons[key]) {
      out.push({
        goalId: goal.id,
        goalTitle: goal.title,
        color: goal.color,
        horizon: key,
        horizonLabel: HORIZON_SHORT[key],
        sub,
        date: horizonDate(base, key),
      });
    }
  }
  return out;
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
