"use client";

import { useCallback, useEffect, useState } from "react";

// localStorage keys — kept identical to the v48 build so existing data carries over.
export const KEYS = {
  profile: "innerly:profile",
  onboarding: "innerly:onboarding",
  reflections: "innerly:reflections",
  goals: "innerly:goals",
  manifestations: "innerly:manifestations",
  visionboard: "innerly:visionboard",
  content: "innerly:content",
  prefs: "innerly:prefs",
  night: "innerly:night",
  theme: "innerly:theme",
  usageDays: "innerly:usage-days",
  remindersChecked: "innerly:reminders-checked",
  welcome: "innerly:welcome",
  tasksPrefix: "innerly:tasks:",
  // Activities are derived from your data, so "deleting" one hides it here
  // rather than destroying the vision, goal or task behind it.
  activitiesHidden: "innerly:activities-hidden",
} as const;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

// `storage` events only fire in OTHER tabs, so a same-tab write is invisible
// to anything reading the keyspace directly (the calendar counting each day's
// tasks, say). This bus closes that gap. Notification is deferred to a
// microtask because writes happen inside React state updaters, and waking
// other components mid-update would be an update-during-render.
const listeners = new Set<() => void>();

export function subscribeStorage(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// Set once by the sync layer, which mirrors every write to the signed-in
// account. Kept as a hook rather than an import so this file never learns
// what Supabase is: it writes to the device, and says so.
let onWrite: ((key: string, value: unknown) => void) | null = null;

export function setWriteHook(fn: (key: string, value: unknown) => void) {
  onWrite = fn;
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / private-mode errors */
  }
  onWrite?.(key, value);
  queueMicrotask(() => {
    for (const fn of listeners) fn();
  });
}

// SSR-safe persisted state. Reads after mount to avoid hydration mismatch.
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setValue(read<T>(key, initial));
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Re-read when anything else touches the keyspace — a sign-in pulling the
  // account down, or another screen writing the same key. Compared as JSON so
  // an unchanged value does not re-render the tree on every unrelated write.
  useEffect(
    () =>
      subscribeStorage(() => {
        setValue((prev) => {
          const next = read<T>(key, initial);
          return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
        });
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]
  );

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        write(key, resolved);
        return resolved;
      });
    },
    [key]
  );

  return [value, set, hydrated] as const;
}

export const storage = { read, write };
