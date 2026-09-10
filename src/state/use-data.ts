"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { KEYS, storage, usePersistentState } from "@/lib/storage";
import { complete, openToday, removeByPath, shownAt, turnAll } from "@/lib/cascade";
import type { Horizon, Prefs } from "@/lib/types";
import { DEFAULT_PREFS } from "@/lib/types";
import { closedDay, shouldAsk, type Missed } from "@/lib/missed";
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

/**
 * Bring every goal up to today, on the way in.
 *
 * The specification called for a nightly job at midnight. There is nowhere for
 * one to run: a goal lives in this browser, and a server has neither the data
 * nor any idea when midnight is where the person happens to be. So the turn
 * happens on arrival instead — which is not a compromise but the sturdier of
 * the two. A job that fires at midnight misses anyone whose laptop was shut,
 * and a week away would leave a week of days half-turned. Catching up on the
 * way in cannot miss, because it only ever runs when somebody is actually here
 * to see the result.
 */
export function useDayTurn() {
  const [goals, setGoals] = useGoals();
  const day = todayId();
  const turned = useMemo(() => turnAll(goals, day), [goals, day]);

  useEffect(() => {
    if (turned === goals) return;
    // Written here because here is the only moment the old day still exists.
    // A minute later its unfinished work has been carried onto today and is
    // indistinguishable from what was written this morning, and the check-in
    // would be naming the wrong things at somebody.
    recordMissed(goals);
    setGoals(turned);
  }, [turned, goals, setGoals]);

  return turned;
}

/**
 * Note what a day was still holding, as it closes.
 *
 * Every day that has closed since the last visit, not only yesterday: come
 * back after a week away and each of those days had its own list, and the one
 * that gets asked about should be the one it says it is.
 */
function recordMissed(before: Goal[]) {
  for (const goal of before) {
    const last = goal.lastReset;
    if (!last) continue;
    const open = openToday(goal)
      .map((s) => s.title.trim())
      .filter(Boolean);
    const key = KEYS.missedPrefix + last;
    const already = storage.read<string[]>(key, []);
    const merged = [...already];
    for (const t of open) if (!merged.includes(t)) merged.push(t);
    if (merged.length !== already.length) storage.write(key, merged);
  }
}

/**
 * The evening check-in: what a closed day was left holding, and how to answer.
 *
 * Reads rather than writes, except for the one line that records the answer —
 * and that line is written whichever way the answer goes, because "not now"
 * has to settle the day as firmly as "yes" does. A prompt about something that
 * did not go well gets one attempt, or it is nagging.
 *
 * Every source is read through the store rather than off the disk once, so the
 * note taken as the day turns is seen on the same visit that takes it. Read
 * once on mount instead and the check-in is always a day behind its own
 * evidence: the morning you come back is exactly the morning the turn happens.
 */
export function useMissedCheckIn() {
  const [prefs] = usePersistentState<Prefs>(KEYS.prefs, DEFAULT_PREFS);
  const [asked, setAsked] = usePersistentState<string | null>(
    KEYS.missedAsked,
    null
  );
  // Fixed on arrival. Which day is being asked about must not change under
  // somebody who is halfway through reading the question.
  const [now] = useState(() => new Date());
  const closed = useMemo(() => closedDay(now), [now]);
  const day = closed?.day ?? "";

  const [noted] = usePersistentState<string[]>(KEYS.missedPrefix + day, []);
  const [dayTasks] = usePersistentState<Task[]>(KEYS.tasksPrefix + day, []);
  const [goals] = useGoals();

  const missed = useMemo<Missed | null>(() => {
    if (!closed) return null;

    // Goal work comes from the note taken as the day turned. A day still going
    // has not turned yet, so that one is read from the goals themselves.
    const fromGoals =
      closed.when === "today"
        ? goals.flatMap((g) => openToday(g).map((s) => s.title))
        : noted;

    const titles: string[] = [];
    const add = (raw: string) => {
      const t = raw.trim();
      if (t && !titles.includes(t)) titles.push(t);
    };
    for (const t of fromGoals) add(t);
    for (const t of dayTasks) if (!t.done) add(t.title);

    return { day: closed.day, titles, when: closed.when };
  }, [closed, noted, dayTasks, goals]);

  const ask = shouldAsk({
    missed,
    alreadyAsked: asked,
    wanted: prefs.missedCheckIn !== false,
  });

  const settle = useCallback(() => {
    if (missed) setAsked(missed.day);
  }, [missed, setAsked]);

  return { missed, ask, settle };
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
  /** Where in the goal's tree this line lives, so a tick can find it again. */
  home?: Horizon;
  path?: string[];
};

// Single source of truth for the Today list, shared by the Dashboard and the
// Daily Plan so they stay in sync. Toggling writes back to the right store
// (goal sub-goal or ad-hoc task), so a check in either place strikes through
// in both. Use ONE instance per mounted screen (don't also call useGoals/
// useTodayTasks alongside it in the same component).
export function useTodayPlan() {
  const [goals, setGoals] = useGoals();
  const [tasks, setTasks] = useTodayTasks();

  // Everything the day is showing, which is not the same as the `today` list:
  // an action pushed down from a month's target is shown on today while still
  // living inside that target, and the home page has to see it too.
  const goalItems: TodayItem[] = goals.flatMap((g) =>
    shownAt(g, "today")
      .filter((p) => p.sub.title.trim())
      .map((p) => ({
        id: p.sub.id,
        title: p.sub.title,
        done: p.sub.done,
        source: "goal" as const,
        goalId: g.id,
        goalTitle: g.title,
        color: g.color,
        home: p.home,
        path: p.path,
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
      // Through the engine, so a tick here settles the same way it would on the
      // goal itself — a heading's steps follow it, and a finished line gives up
      // the day's primary slot. Nothing new arrives to replace it: what today
      // holds was chosen on the goal page, and only ever there.
      setGoals((prev) =>
        prev.map((g) =>
          g.id === item.goalId && item.home && item.path
            ? complete(g, item.home, item.path)
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
          g.id === item.goalId && item.home && item.path
            ? removeByPath(g, item.home, item.path)
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
