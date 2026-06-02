"use client";

import { KEYS, usePersistentState } from "@/lib/storage";
import type { Goal, Manifestation, Reflection, Task, VisionYear } from "@/lib/types";

export function useReflections() {
  return usePersistentState<Reflection[]>(KEYS.reflections, []);
}

export function useGoals() {
  return usePersistentState<Goal[]>(KEYS.goals, []);
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

export function useVisionBoard() {
  return usePersistentState<VisionYear[]>(KEYS.visionboard, []);
}

export function useRemindersChecked() {
  return usePersistentState<Record<string, boolean>>(KEYS.remindersChecked, {});
}

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
