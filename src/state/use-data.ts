"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { KEYS, usePersistentState } from "@/lib/storage";
import {
  isDataUrl,
  signVisionImages,
  storageEnabled,
  uploadVisionImage,
} from "@/features/vision-board/vision-images";
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

// Tasks are stored per day, so any date is addressable — that is what lets the
// planner's calendar write into a day you pick, and the Dashboard read back
// today's without the two knowing about each other.
export function useDayTasks(day: string) {
  return usePersistentState<Task[]>(KEYS.tasksPrefix + day, []);
}

export function useTodayTasks() {
  return useDayTasks(todayId());
}

export function useManifestations() {
  return usePersistentState<Manifestation[]>(KEYS.manifestations, []);
}

/**
 * Take the signed preview URL back off before anything is written to disk.
 *
 * Callers edit the resolved shape — the one with a working `imageUrl` — so
 * without this an hour-long link would be saved as if it were the photo, and
 * every board would go blank the next day. The rule is one line and absolute:
 * where there is an `imagePath`, `imageUrl` is not persisted.
 */
export function stripSignedUrls(years: VisionYear[]): VisionYear[] {
  return years.map((y) => ({
    ...y,
    items: y.items.map((it) =>
      it.imagePath ? { ...it, imageUrl: undefined } : it
    ),
  }));
}

// Sanitized on read/write so stale/odd vision data can never crash the screen.
//
// This hook is also where vision photos get resolved. Everything downstream —
// the board, the lightbox, the shareable card, the history feed — reads
// `item.imageUrl` and renders it. Signing `imagePath` into that field here
// means none of them had to learn that photos moved to Storage.
export function useVisionBoard() {
  const [raw, setRaw, hydrated] = usePersistentState<unknown[]>(
    KEYS.visionboard,
    []
  );

  const stored = useMemo<VisionYear[]>(
    () => (Array.isArray(raw) ? raw.map((y, i) => normalizeVisionYear(y, i)) : []),
    [raw]
  );

  // path -> signed URL. Kept beside the data rather than inside it, so a link
  // that expires within the hour can never be written to disk.
  const [signed, setSigned] = useState<Map<string, string>>(new Map());

  const paths = useMemo(
    () =>
      stored
        .flatMap((y) => y.items)
        .map((i) => i.imagePath)
        .filter((p): p is string => !!p),
    [stored]
  );
  const pathKey = paths.join("|");

  useEffect(() => {
    if (paths.length === 0) return;
    let cancelled = false;
    signVisionImages(paths).then((map) => {
      if (!cancelled) setSigned(map);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathKey]);

  const years = useMemo<VisionYear[]>(
    () =>
      stored.map((y) => ({
        ...y,
        items: y.items.map((it) =>
          it.imagePath
            ? { ...it, imageUrl: signed.get(it.imagePath) ?? it.imageUrl }
            : it
        ),
      })),
    [stored, signed]
  );

  const setYears = useCallback(
    (next: VisionYear[] | ((prev: VisionYear[]) => VisionYear[])) => {
      setRaw((prev) => {
        const cur = Array.isArray(prev)
          ? prev.map((y, i) => normalizeVisionYear(y, i))
          : [];
        const resolved =
          typeof next === "function"
            ? (next as (p: VisionYear[]) => VisionYear[])(cur)
            : next;
        return stripSignedUrls(resolved);
      });
    },
    [setRaw]
  );

  return [years, setYears, hydrated] as const;
}

/**
 * Move photos that predate Storage — held as data URLs in the browser — up to
 * the bucket, once, after signing in. This is what actually frees the space
 * that was capping a board at about three photos.
 */
export function useVisionImageMigration(
  years: VisionYear[],
  setYears: (next: (prev: VisionYear[]) => VisionYear[]) => void,
  ready: boolean
) {
  const [done, setDone] = useState(false);

  const legacy = useMemo(
    () =>
      years
        .flatMap((y) => y.items)
        .filter((it) => !it.imagePath && isDataUrl(it.imageUrl))
        .map((it) => ({ id: it.id, dataUrl: it.imageUrl as string })),
    [years]
  );
  const legacyKey = legacy.map((l) => l.id).join("|");

  useEffect(() => {
    if (done || !ready || legacy.length === 0 || !storageEnabled()) return;

    let cancelled = false;
    (async () => {
      const moved = new Map<string, string>();
      for (const { id, dataUrl } of legacy) {
        const path = await uploadVisionImage(dataUrl, id);
        if (path) moved.set(id, path);
      }
      if (cancelled || moved.size === 0) return;

      setYears((prev) =>
        prev.map((y) => ({
          ...y,
          items: y.items.map((it) =>
            moved.has(it.id)
              ? { ...it, imagePath: moved.get(it.id), imageUrl: undefined }
              : it
          ),
        }))
      );
      setDone(true);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legacyKey, ready, done]);
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

  const remove = (item: TodayItem) => {
    if (item.source === "goal") {
      setGoals((prev) =>
        prev.map((g) =>
          g.id === item.goalId
            ? {
                ...g,
                horizons: {
                  ...g.horizons,
                  today: g.horizons.today.filter((s) => s.id !== item.id),
                },
              }
            : g
        )
      );
    } else {
      setTasks((prev) => prev.filter((t) => t.id !== item.id));
    }
  };

  const total = items.length;
  const done = items.filter((i) => i.done).length;

  return { items, toggle, addTask, remove, total, done };
}
