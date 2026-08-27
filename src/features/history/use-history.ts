"use client";

import { useMemo, useSyncExternalStore } from "react";
import { KEYS } from "@/lib/storage";
import type { Manifestation, Reflection, Task } from "@/lib/types";
import { useManifestations, useReflections } from "@/state/use-data";

/* ----------------------------------------------------------------- days */

// Day buckets use the same UTC-sliced key the rest of the app uses for
// `innerly:tasks:<key>`, so entries and task days line up exactly.
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

// Build a LOCAL date from a day key so month grids and labels never land on
// the neighbouring day the way `new Date("2026-08-27")` (parsed as UTC) can.
export function dayDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function dayLabel(key: string, now = new Date()): string {
  const date = dayDate(key);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((today.getTime() - date.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function dayStamp(key: string): string {
  return dayDate(key).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* ------------------------------------------------------------ task days */

export type TaskDay = { day: string; tasks: Task[] };

const NO_TASK_DAYS: TaskDay[] = [];
let taskSig = " ";
let taskCache: TaskDay[] = NO_TASK_DAYS;

// Each day's ad-hoc tasks live under their own `innerly:tasks:<day>` key, so
// the whole history is recovered by sweeping the keyspace. The result is
// memoised against a signature of the raw values: `useSyncExternalStore`
// calls this on every render and demands a stable reference when unchanged.
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
    return taskCache;
  }
  raw.sort((a, b) => a[0].localeCompare(b[0]));

  const sig = raw.map(([k, v]) => k + "=" + v).join("");
  if (sig === taskSig) return taskCache;

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

  taskSig = sig;
  taskCache = days;
  return days;
}

function subscribeTaskDays(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("focus", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("focus", onChange);
  };
}

function useTaskDays(): TaskDay[] {
  return useSyncExternalStore(subscribeTaskDays, readTaskDays, () => NO_TASK_DAYS);
}

/* -------------------------------------------------------------- entries */

export type HistoryKind = "reflection" | "manifestation" | "done";

export type HistoryEntry = {
  id: string;
  day: string;
  at: string;
  search: string;
} & (
  | { kind: "reflection"; reflection: Reflection }
  | { kind: "manifestation"; manifestation: Manifestation }
  | { kind: "done"; tasks: Task[] }
);

export type HistoryDay = { day: string; entries: HistoryEntry[] };

const norm = (parts: (string | undefined)[]) =>
  parts.filter(Boolean).join(" ").toLowerCase();

export function useHistory() {
  const [reflections] = useReflections();
  const [manifestations] = useManifestations();
  const taskDays = useTaskDays();

  const entries = useMemo<HistoryEntry[]>(() => {
    const all: HistoryEntry[] = [];

    for (const r of reflections) {
      const day = dayKey(r.date);
      if (!day) continue;
      all.push({
        kind: "reflection",
        id: "r-" + (r.id || r.date),
        day,
        at: r.date,
        reflection: r,
        search: norm([
          "reflection",
          ...r.moments.flatMap((m) => [m.text, m.why, ...(m.next ?? [])]),
          r.differently,
        ]),
      });
    }

    for (const m of manifestations) {
      const day = dayKey(m.savedAt);
      if (!day) continue;
      all.push({
        kind: "manifestation",
        id: "m-" + m.savedAt,
        day,
        at: m.savedAt,
        manifestation: m,
        search: norm([
          "manifestation",
          ...m.goals,
          ...m.affirmations,
          ...m.gratitude,
          ...m.releases,
        ]),
      });
    }

    // Only days with something actually finished are worth looking back on.
    for (const { day, tasks } of taskDays) {
      const done = tasks.filter((t) => t.done);
      if (!done.length) continue;
      all.push({
        kind: "done",
        id: "t-" + day,
        day,
        at: day + "T23:59:59.000Z",
        tasks: done,
        search: norm(["completed done tasks", ...done.map((t) => t.title)]),
      });
    }

    return all.sort((a, b) => b.at.localeCompare(a.at));
  }, [reflections, manifestations, taskDays]);

  // Every day holding at least one entry: drives the calendar's dots and
  // decides which days are reachable at all.
  const daysWithEntries = useMemo(
    () => new Set(entries.map((e) => e.day)),
    [entries]
  );

  return { entries, daysWithEntries };
}

// Group a flat, already-sorted list into day buckets (newest day first).
export function groupByDay(entries: HistoryEntry[]): HistoryDay[] {
  const byDay = new Map<string, HistoryEntry[]>();
  for (const e of entries) {
    const bucket = byDay.get(e.day);
    if (bucket) bucket.push(e);
    else byDay.set(e.day, [e]);
  }
  return [...byDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, list]) => ({ day, entries: list }));
}
