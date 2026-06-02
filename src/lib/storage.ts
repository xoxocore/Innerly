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

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / private-mode errors */
  }
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
