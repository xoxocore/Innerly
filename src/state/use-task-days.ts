"use client";

import { useSyncExternalStore } from "react";
import { KEYS, subscribeStorage } from "@/lib/storage";
import type { Task } from "@/lib/types";

export type TaskDay = { day: string; tasks: Task[] };

const NO_TASK_DAYS: TaskDay[] = [];
let sig = " ";
let cache: TaskDay[] = NO_TASK_DAYS;

// Each day's tasks live under their own `innerly:tasks:<day>` key, so the whole
// planner is recovered by sweeping the keyspace. The result is memoised against
// a signature of the raw values: `useSyncExternalStore` calls this on every
// render and demands a stable reference when nothing has changed.
function readTaskDays(): TaskDay[] {
  if (typeof window === "undefined") return NO_TASK_DAYS;

  const raw: [string, string][] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(KEYS.tasksPrefix)) continue;
      raw.push([k, window.localStorage.getItem(k) ?? ""]);
    }
  } catch {
    return cache;
  }
  raw.sort((a, b) => a[0].localeCompare(b[0]));

  const next = raw.map(([k, v]) => k + "=" + v).join("");
  if (next === sig) return cache;

  const days: TaskDay[] = [];
  for (const [k, v] of raw) {
    const day = k.slice(KEYS.tasksPrefix.length);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    try {
      const parsed = JSON.parse(v);
      if (!Array.isArray(parsed)) continue;
      const tasks = parsed.filter(
        (t): t is Task =>
          !!t &&
          typeof t === "object" &&
          typeof t.title === "string" &&
          !!t.title.trim()
      );
      if (tasks.length) days.push({ day, tasks });
    } catch {
      /* skip an unreadable day rather than losing the whole sweep */
    }
  }

  sig = next;
  cache = days;
  return days;
}

function subscribe(onChange: () => void) {
  const offBus = subscribeStorage(onChange);
  window.addEventListener("storage", onChange);
  window.addEventListener("focus", onChange);
  return () => {
    offBus();
    window.removeEventListener("storage", onChange);
    window.removeEventListener("focus", onChange);
  };
}

export function useTaskDays(): TaskDay[] {
  return useSyncExternalStore(subscribe, readTaskDays, () => NO_TASK_DAYS);
}

// Every day that holds at least one task, keyed for quick lookup.
export function tasksByDay(days: TaskDay[]): Map<string, Task[]> {
  return new Map(days.map((d) => [d.day, d.tasks]));
}
