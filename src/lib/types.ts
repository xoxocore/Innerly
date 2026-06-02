// Domain model — mirrors the entities persisted by the v48 build.

export type Profile = {
  firstName: string;
  createdAt: string;
  dayStreak?: number;
};

export type ReflectionMoment = {
  text: string; // what felt heavy
  why: string; // why it happened
};

export type Reflection = {
  id: string;
  date: string; // ISO
  moments: ReflectionMoment[];
  differently: string; // what to do differently next time
};

export type Task = {
  id: string;
  title: string;
  done: boolean;
  goalId?: string;
};

export type Goal = {
  id: string;
  title: string;
  color: string;
  createdAt: string;
  steps: { id: string; title: string; done: boolean }[];
};

export type Manifestation = {
  goals: string[];
  affirmations: string[];
  gratitude: string[];
  releases: string[];
  savedAt: string;
};

export type VisionItem = {
  id: string;
  title: string;
  imageUrl?: string;
  gradient?: [string, string];
};

export type VisionYear = {
  id: string;
  year: string;
  items: VisionItem[];
};

export type Prefs = {
  notifications: boolean;
  dailyReminder: boolean;
  weeklyReport: boolean;
};

export const DEFAULT_PREFS: Prefs = {
  notifications: false,
  dailyReminder: true,
  weeklyReport: false,
};

// Soft palette used for goal accents / vision tiles (from v48).
export const ACCENTS = [
  ["#f6d6e0", "#e7e1f0"],
  ["#d7e8f2", "#eef0e6"],
  ["#f0e3d6", "#e9dcec"],
  ["#e2eede", "#eadff0"],
  ["#f3d9e6", "#dfe7f2"],
] as const;
