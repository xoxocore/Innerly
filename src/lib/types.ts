// Domain model — mirrors the entities persisted by the v48 build.

export type Profile = {
  firstName: string;
  createdAt: string;
  dayStreak?: number;
  /** Where the profile picture lives in the avatars bucket, if there is one. */
  avatarPath?: string | null;
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
    // "Today" means the day you are living, not the day the goal was made.
    // Anchoring it to `base` stranded a goal's Today actions on its creation
    // date, which then disagreed with the Dashboard's Today list.
    case "today":
      return new Date();
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
    imagePath: typeof o.imagePath === "string" ? o.imagePath : undefined,
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

// Apple's system colours, the palette macOS Calendar tints its events with.
// `dot` is the vivid mark; `ink` is the darkened variant that stays readable
// as text on `soft`, since several of these (orange especially) fail contrast
// at full saturation. In night mode `dot` sits on `softDark` and reads fine.
// The KEYS are deliberately unchanged from the previous palette so goals
// already saved keep the colour they were given.
export type GoalColor = {
  key: string;
  dot: string;
  ink: string;
  soft: string;
  softDark: string;
};

export const GOAL_COLORS: GoalColor[] = [
  { key: "blue", dot: "#007AFF", ink: "#0060DF", soft: "#E8F1FE", softDark: "#12233A" },
  { key: "emerald", dot: "#34C759", ink: "#1E8E3E", soft: "#E6F7EC", softDark: "#12301D" },
  { key: "pink", dot: "#FF2D55", ink: "#D81B50", soft: "#FFE9EF", softDark: "#3A1421" },
  { key: "amber", dot: "#FF9500", ink: "#B96A0E", soft: "#FFF1E0", softDark: "#3A2610" },
  { key: "violet", dot: "#AF52DE", ink: "#8E3EBD", soft: "#F6EAFC", softDark: "#2C1638" },
  { key: "rose", dot: "#FF3B30", ink: "#D32F2F", soft: "#FFEBE9", softDark: "#3A1714" },
  { key: "teal", dot: "#5AC8FA", ink: "#0A7EA4", soft: "#E4F5FE", softDark: "#0F2A38" },
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
  /**
   * Where the uploaded photo lives in Supabase Storage, as `<user-id>/<file>`.
   * This is the durable one. The bucket is private, so it cannot be rendered
   * directly — useVisionBoard() signs it into `imageUrl` on the way out.
   */
  imagePath?: string;
  /**
   * An external link, a legacy data URL from before Storage existed, or — once
   * useVisionBoard() has resolved `imagePath` — a signed URL. The signed case
   * expires within the hour, which is why it is never persisted alongside an
   * `imagePath`.
   */
  imageUrl?: string;
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
};

export const DEFAULT_PREFS: Prefs = {
  notifications: false,
  dailyReminder: true,
};

// Soft palette used for goal accents / vision tiles (from v48).
export const ACCENTS = [
  ["#f6d6e0", "#e7e1f0"],
  ["#d7e8f2", "#eef0e6"],
  ["#f0e3d6", "#e9dcec"],
  ["#e2eede", "#eadff0"],
  ["#f3d9e6", "#dfe7f2"],
] as const;
