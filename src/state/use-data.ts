"use client";

import { useCallback, useMemo } from "react";
import { KEYS, usePersistentState } from "@/lib/storage";
import {
  normalizeGoal,
  normalizeVisionYear,
  type Goal,
  type Manifestation,
  type Reflection,
  type Task,
  type VisionYear,
} from "@/lib/types";

export function useReflections() {
  return usePersistentState<Reflection[]>(KEYS.reflections, []);
}

// Goals are sanitized on every read so stale/old-format data can never crash
// the Daily Plan. Writes pass through the normalized current value.
export function useGoals() {
  const [raw, setRaw, hydrated] = usePersistentState<unknown[]>(KEYS.goals, []);

  const goals = useMemo<Goal[]>(
    () => (Array.isArray(raw) ? raw.map((g, i) => normalizeGoal(g, i)) : []),
    [raw]
  );

  const setGoals = useCallback(
    (next: Goal[] | ((prev: Goal[]) => Goal[])) => {
      setRaw((prev) => {
        const cur = Array.isArray(prev) ? prev.map((g, i) => normalizeGoal(g, i)) : [];
        return typeof next === "function"
          ? (next as (p: Goal[]) => Goal[])(cur)
          : next;
      });
    },
    [setRaw]
  );

  return [goals, setGoals, hydrated] as const;
}

export function todayId(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function useTodayTasks() {
  return usePersistentState<Task[]>(KEYS.tasksPrefix + todayId(), []);
}

export function useManifestations() {
  return usePersistentState<Manifestation[]>(KEYS.manifestations, []);
}

// Sanitized on read/write so stale/odd vision data can never crash the screen.
export function useVisionBoard() {
  const [raw, setRaw, hydrated] = usePersistentState<unknown[]>(
    KEYS.visionboard,
    []
  );

  const years = useMemo<VisionYear[]>(
    () => (Array.isArray(raw) ? raw.map((y, i) => normalizeVisionYear(y, i)) : []),
    [raw]
  );

  const setYears = useCallback(
    (next: VisionYear[] | ((prev: VisionYear[]) => VisionYear[])) => {
      setRaw((prev) => {
        const cur = Array.isArray(prev)
          ? prev.map((y, i) => normalizeVisionYear(y, i))
          : [];
        return typeof next === "function"
          ? (next as (p: VisionYear[]) => VisionYear[])(cur)
          : next;
      });
    },
    [setRaw]
  );

  return [years, setYears, hydrated] as const;
}

export function useRemindersChecked() {
  return usePersistentState<Record<string, boolean>>(KEYS.remindersChecked, {});
}

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// A unified "Today" item — either a goal's Today sub-goal or an ad-hoc task.
export type TodayItem = {
  id: string;
  title: string;
  done: boolean;
  source: "goal" | "task";
  goalId?: string;
  goalTitle?: string;
  color?: string;
};

// Single source of truth for the Today list, shared by the Dashboard and the
// Daily Plan so they stay in sync. Toggling writes back to the right store
// (goal sub-goal or ad-hoc task), so a check in either place strikes through
// in both. Use ONE instance per mounted screen (don't also call useGoals/
// useTodayTasks alongside it in the same component).
export function useTodayPlan() {
  const [goals, setGoals] = useGoals();
  const [tasks, setTasks] = useTodayTasks();

  const goalItems: TodayItem[] = goals.flatMap((g) =>
    g.horizons.today
      .filter((s) => s.title.trim())
      .map((s) => ({
        id: s.id,
        title: s.title,
        done: s.done,
        source: "goal" as const,
        goalId: g.id,
        goalTitle: g.title,
        color: g.color,
      }))
  );
  const taskItems: TodayItem[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    done: t.done,
    source: "task" as const,
  }));
  const items = [...goalItems, ...taskItems];

  const toggle = (item: TodayItem) => {
    if (item.source === "goal") {
      setGoals((prev) =>
        prev.map((g) =>
          g.id === item.goalId
            ? {
                ...g,
                horizons: {
                  ...g.horizons,
                  today: g.horizons.today.map((s) =>
                    s.id === item.id ? { ...s, done: !s.done } : s
                  ),
                },
              }
            : g
        )
      );
    } else {
      setTasks((prev) =>
        prev.map((t) => (t.id === item.id ? { ...t, done: !t.done } : t))
      );
    }
  };

  const addTask = (title: string) => {
    const t = title.trim();
    if (!t) return;
    setTasks((prev) => [...prev, { id: uid(), title: t, done: false }]);
  };

  const total = items.length;
  const done = items.filter((i) => i.done).length;

  return { items, toggle, addTask, total, done };
}
