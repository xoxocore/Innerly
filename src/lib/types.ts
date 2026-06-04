// Domain model — mirrors the entities persisted by the v48 build.

export type Profile = {
  firstName: string;
  createdAt: string;
  dayStreak?: number;
};

export type ReflectionMoment = {
  text: string; // what felt heavy
  why: string; // why it happened
  next?: string[]; // what I'll do differently next time — one or more points
};

export type Reflection = {
  id: string;
  date: string; // ISO
  moments: ReflectionMoment[];
  differently: string; // what to do differently next time
  review?: string; // pause & review — user's marked-up HTML (bold/underline/highlight)
};

export type Task = {
  id: string;
  title: string;
  done: boolean;
  goalId?: string;
};

// The six time horizons a goal is broken down into, from furthest to nearest.
export type Horizon =
  | "year"
  | "sixMonths"
  | "threeMonths"
  | "oneMonth"
  | "thisWeek"
  | "today";

export type SubGoal = {
  id: string;
  title: string;
  done: boolean;
};

export type Goal = {
  id: string;
  title: string;
  description?: string;
  color: string; // palette key, see GOAL_COLORS
  createdAt: string;
  order: number;
  horizons: Record<Horizon, SubGoal[]>;
};

export function emptyHorizons(): Record<Horizon, SubGoal[]> {
  return {
    year: [],
    sixMonths: [],
    threeMonths: [],
    oneMonth: [],
    thisWeek: [],
    today: [],
  };
}

// Order + labels for the thread timeline (top = furthest out).
export const HORIZONS: { key: Horizon; label: string; addLabel: string }[] = [
  { key: "year", label: "1 Year", addLabel: "Add sub-goal" },
  { key: "sixMonths", label: "6 Months", addLabel: "Add sub-goal" },
  { key: "threeMonths", label: "3 Months", addLabel: "Add sub-goal" },
  { key: "oneMonth", label: "This Month", addLabel: "Add sub-goal" },
  { key: "thisWeek", label: "This Week", addLabel: "Add sub-goal" },
  { key: "today", label: "Today", addLabel: "Add action" },
];

// Short timing labels used on the calendar item pills.
export const HORIZON_SHORT: Record<Horizon, string> = {
  year: "1 Year",
  sixMonths: "6 Months",
  threeMonths: "3 Months",
  oneMonth: "This Month",
  thisWeek: "This Week",
  today: "Today",
};

// Map a horizon to a concrete due date relative to a base date (the goal's
// creation day). Drives where items land on the calendar.
export function horizonDate(base: Date, h: Horizon): Date {
  const d = new Date(base);
  switch (h) {
    case "today":
      return d;
    case "thisWeek":
      d.setDate(d.getDate() + 7);
      return d;
    case "oneMonth":
      d.setMonth(d.getMonth() + 1);
      return d;
    case "threeMonths":
      d.setMonth(d.getMonth() + 3);
      return d;
    case "sixMonths":
      d.setMonth(d.getMonth() + 6);
      return d;
    case "year":
      d.setFullYear(d.getFullYear() + 1);
      return d;
  }
}

function normVisionItem(raw: unknown): VisionItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const images = o.images;
  return {
    id: typeof o.id === "string" ? o.id : rid(),
    // tolerate legacy/v48 `topic` field
    title:
      typeof o.title === "string"
        ? o.title
        : typeof o.topic === "string"
          ? (o.topic as string)
          : "",
    description: typeof o.description === "string" ? o.description : undefined,
    imageUrl:
      typeof o.imageUrl === "string"
        ? o.imageUrl
        : Array.isArray(images) && typeof images[0] === "string"
          ? (images[0] as string)
          : undefined,
    gradient:
      Array.isArray(o.gradient) && o.gradient.length === 2
        ? [String(o.gradient[0]), String(o.gradient[1])]
        : undefined,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : undefined,
  };
}

// Coerce any stored value into a valid VisionYear (always with an `items`
// array), so stale/odd data can never crash the Vision Board.
export function normalizeVisionYear(raw: unknown, index = 0): VisionYear {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const items = Array.isArray(o.items)
    ? (o.items.map(normVisionItem).filter(Boolean) as VisionItem[])
    : [];
  return {
    id: typeof o.id === "string" ? o.id : rid(),
    year:
      o.year != null
        ? String(o.year)
        : String(new Date().getFullYear() + index),
    items,
  };
}

// Vivid, friendly goal palette. `dot`/`bar` are solid; `soft` is the pill fill.
export type GoalColor = {
  key: string;
  dot: string;
  soft: string;
  softDark: string;
};

export const GOAL_COLORS: GoalColor[] = [
  { key: "blue", dot: "#3b82f6", soft: "#dbeafe", softDark: "#1e3a5f" },
  { key: "emerald", dot: "#10b981", soft: "#d1fae5", softDark: "#0f3d2e" },
  { key: "pink", dot: "#ec4899", soft: "#fce7f3", softDark: "#4a1d36" },
  { key: "amber", dot: "#f59e0b", soft: "#fef3c7", softDark: "#43320b" },
  { key: "violet", dot: "#8b5cf6", soft: "#ede9fe", softDark: "#332155" },
  { key: "rose", dot: "#f43f5e", soft: "#ffe4e6", softDark: "#4a1622" },
  { key: "teal", dot: "#14b8a6", soft: "#ccfbf1", softDark: "#0c3b37" },
];

export function goalColor(key: string): GoalColor {
  return GOAL_COLORS.find((c) => c.key === key) ?? GOAL_COLORS[0];
}

const rid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function normSub(s: unknown): SubGoal | null {
  if (!s || typeof s !== "object") return null;
  const o = s as Record<string, unknown>;
  return {
    id: typeof o.id === "string" ? o.id : rid(),
    title: typeof o.title === "string" ? o.title : "",
    done: !!o.done,
  };
}

// Coerce any stored value into a valid Goal. Migrates the old `{ steps: [] }`
// shape into the `today` horizon and backfills missing fields, so stale
// localStorage from earlier versions can never crash the screen.
export function normalizeGoal(raw: unknown, index = 0): Goal {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const horizons = emptyHorizons();
  const keys = Object.keys(horizons) as Horizon[];

  const rawHorizons = o.horizons as Record<string, unknown> | undefined;
  if (rawHorizons && typeof rawHorizons === "object") {
    for (const k of keys) {
      const arr = rawHorizons[k];
      if (Array.isArray(arr)) {
        horizons[k] = arr.map(normSub).filter(Boolean) as SubGoal[];
      }
    }
  } else if (Array.isArray(o.steps)) {
    // legacy migration: old goals stored a flat `steps` list
    horizons.today = (o.steps as unknown[]).map(normSub).filter(Boolean) as SubGoal[];
  }

  const colorKey = GOAL_COLORS.some((c) => c.key === o.color)
    ? (o.color as string)
    : GOAL_COLORS[index % GOAL_COLORS.length].key;

  return {
    id: typeof o.id === "string" ? o.id : rid(),
    title: typeof o.title === "string" ? o.title : "",
    description: typeof o.description === "string" ? o.description : undefined,
    color: colorKey,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString(),
    order: typeof o.order === "number" ? o.order : index,
    horizons,
  };
}

export type Manifestation = {
  goals: string[];
  affirmations: string[];
  gratitude: string[];
  releases: string[];
  savedAt: string;
};

export type VisionItem = {
  id: string;
  title: string; // topic
  description?: string; // rich-text HTML
  imageUrl?: string; // data URL (uploaded) or external link
  gradient?: [string, string];
  createdAt?: string;
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
