"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { KEYS, usePersistentState } from "@/lib/storage";
import type { Manifestation, Reflection, Task } from "@/lib/types";
import type { View } from "@/state/app-context";
import {
  useGoals,
  useManifestations,
  useReflections,
  useVisionBoard,
} from "@/state/use-data";

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

export function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

// Compact age, the way a notification feed reads it: 3h, 2d, 5w.
export function relativeAge(iso: string, now = new Date()): string {
  const mins = Math.floor((now.getTime() - new Date(iso).getTime()) / 60000);
  // Day-level activities carry a midday stamp, which is still ahead of the
  // clock for today — "today" is the honest reading, not "now".
  if (mins < 1) return "today";
  if (mins < 60) return mins + "m";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h";
  const days = Math.floor(hrs / 24);
  if (days < 7) return days + "d";
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks + "w";
  const months = Math.floor(days / 30);
  if (months < 12) return months + "mo";
  return Math.floor(days / 365) + "y";
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

/* ----------------------------------------------------------- activities */

export type ActivityType = "vision" | "goal" | "plan" | "completed";

// An activity is a notification about something you did elsewhere in the app.
// It is DERIVED from the data itself rather than written to an event log, so
// it covers everything already in the app and can never drift out of sync.
export type Activity = {
  id: string;
  at: string;
  type: ActivityType;
  text: string;
  detail?: string;
  items?: string[];
  image?: string;
  gradient?: [string, string];
  accent?: string;
  target: View;
  targetLabel: string;
};

const plural = (n: number, one: string, many: string) =>
  n === 1 ? one : String(n) + " " + many;

/* -------------------------------------------------------------- entries */

export type HistoryKind = "reflection" | "manifestation" | "activity";

export type HistoryEntry = {
  id: string;
  day: string;
  at: string;
  search: string;
} & (
  | { kind: "reflection"; reflection: Reflection }
  | { kind: "manifestation"; manifestation: Manifestation }
  | { kind: "activity"; activity: Activity }
);

export type HistoryDay = { day: string; entries: HistoryEntry[] };

const norm = (parts: (string | undefined)[]) =>
  parts.filter(Boolean).join(" ").toLowerCase();

export function useHistory() {
  const [reflections, setReflections] = useReflections();
  const [manifestations, setManifestations] = useManifestations();
  const [goals] = useGoals();
  const [years] = useVisionBoard();
  const taskDays = useTaskDays();
  const [hidden, setHidden] = usePersistentState<string[]>(
    KEYS.activitiesHidden,
    []
  );

  const activities = useMemo<Activity[]>(() => {
    const out: Activity[] = [];

    for (const year of years) {
      for (const item of year.items) {
        // Without a timestamp there is no honest place to put it in time.
        if (!item.createdAt) continue;
        out.push({
          id: "a-vision-" + item.id,
          at: item.createdAt,
          type: "vision",
          text: "You added a new vision to your Vision Board.",
          detail: item.title || "Untitled vision",
          image: item.imageUrl,
          gradient: item.gradient,
          target: "vision-board",
          targetLabel: "Vision Board",
        });
      }
    }

    for (const g of goals) {
      if (!g.createdAt || !g.title.trim()) continue;
      out.push({
        id: "a-goal-" + g.id,
        at: g.createdAt,
        type: "goal",
        text: "You started a new goal.",
        detail: g.title,
        accent: g.color,
        target: "daily-plan",
        targetLabel: "Daily Plan",
      });
    }

    for (const { day, tasks } of taskDays) {
      // Day-level records carry no clock time; midday keeps them ordered
      // sensibly within their day without inventing a precise moment.
      const at = day + "T12:00:00.000Z";
      out.push({
        id: "a-plan-" + day,
        at,
        type: "plan",
        text:
          "You added " +
          plural(tasks.length, "a plan", "plans") +
          " to your Daily Plan.",
        items: tasks.map((t) => t.title),
        target: "daily-plan",
        targetLabel: "Daily Plan",
      });

      const done = tasks.filter((t) => t.done);
      if (done.length) {
        out.push({
          id: "a-done-" + day,
          at: day + "T12:30:00.000Z",
          type: "completed",
          text: "You completed " + plural(done.length, "a plan", "things") + ".",
          items: done.map((t) => t.title),
          target: "daily-plan",
          targetLabel: "Daily Plan",
        });
      }
    }

    return out;
  }, [years, goals, taskDays]);

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

    const dismissed = new Set(hidden);
    for (const a of activities) {
      if (dismissed.has(a.id)) continue;
      const day = dayKey(a.at);
      if (!day) continue;
      all.push({
        kind: "activity",
        id: a.id,
        day,
        at: a.at,
        activity: a,
        search: norm([
          "activity",
          a.text,
          a.detail,
          a.targetLabel,
          ...(a.items ?? []),
        ]),
      });
    }

    return all.sort((a, b) => b.at.localeCompare(a.at));
  }, [reflections, manifestations, activities, hidden]);

  // Every day holding at least one entry, for the calendar's dots.
  const daysWithEntries = useMemo(
    () => new Set(entries.map((e) => e.day)),
    [entries]
  );

  // Reflections and manifestations are records, so removing one deletes it.
  // An activity is only a view onto data that lives elsewhere, so removing it
  // dismisses the notification and leaves the vision, goal or task alone.
  const remove = useCallback(
    (entry: HistoryEntry) => {
      if (entry.kind === "reflection") {
        const target = entry.reflection;
        setReflections((prev) =>
          prev.filter((r) =>
            target.id ? r.id !== target.id : r.date !== target.date
          )
        );
        return;
      }
      if (entry.kind === "manifestation") {
        const savedAt = entry.manifestation.savedAt;
        setManifestations((prev) => prev.filter((m) => m.savedAt !== savedAt));
        return;
      }
      setHidden((prev) => (prev.includes(entry.id) ? prev : [...prev, entry.id]));
    },
    [setReflections, setManifestations, setHidden]
  );

  return { entries, daysWithEntries, remove };
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
