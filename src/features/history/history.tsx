"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronRight,
  ImagePlus,
  NotebookPen,
  Search,
  Sparkles,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScreenHeader } from "@/components/innerly/screen-header";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { goalColor } from "@/lib/types";
import { useApp } from "@/state/app-context";
import { EntryReport } from "./entry-report";
import { MiniCalendar } from "./mini-calendar";
import {
  dayLabel,
  dayStamp,
  groupByDay,
  relativeAge,
  timeOf,
  useHistory,
  type ActivityType,
  type HistoryEntry,
  type HistoryKind,
} from "./use-history";

const c = copy.history;

type Filter = "all" | HistoryKind;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: c.filterAll },
  { key: "reflection", label: c.filterReflections },
  { key: "manifestation", label: c.filterManifestations },
  { key: "activity", label: c.filterActivities },
];

// Kinds borrow their hue from the goal palette so History reads as part of the
// same system rather than a screen with its own colours.
const RECORD = {
  reflection: { label: "Reflection", icon: NotebookPen, color: "rose" },
  manifestation: { label: "Manifestation", icon: Sparkles, color: "violet" },
} as const;

const ACTIVITY: Record<
  ActivityType,
  { icon: typeof Target; color: string }
> = {
  vision: { icon: ImagePlus, color: "pink" },
  goal: { icon: Target, color: "amber" },
  plan: { icon: CalendarPlus, color: "blue" },
  completed: { icon: Check, color: "emerald" },
};

/* ------------------------------------------------------------- one entry */

function summarise(e: HistoryEntry): { title: string; preview: string } {
  if (e.kind === "reflection") {
    const { moments, differently } = e.reflection;
    const n = moments.length;
    return {
      title: n > 1 ? `Reflection · ${n} moments` : "Reflection",
      preview: moments[0]?.text || differently || "A quiet check-in.",
    };
  }
  if (e.kind === "manifestation") {
    const m = e.manifestation;
    return {
      title: "Manifestation",
      preview: m.goals[0] || m.affirmations[0] || m.gratitude[0] || "Named and aligned.",
    };
  }
  const a = e.activity;
  return {
    title: a.text,
    preview: a.detail ?? (a.items ?? []).join(" · "),
  };
}

function DeleteButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground opacity-100 transition-all hover:bg-accent hover:text-destructive lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"
    >
      <Trash2 className="h-[15px] w-[15px]" />
    </button>
  );
}

// The avatar is the activity's own image where it has one — an added vision
// shows the picture you added, the way a notification feed shows a thumbnail.
function EntryAvatar({ entry }: { entry: HistoryEntry }) {
  const { night } = useApp();

  if (entry.kind === "activity") {
    const a = entry.activity;
    const meta = ACTIVITY[a.type];
    const color = goalColor(a.accent ?? meta.color);
    const Icon = meta.icon;

    if (a.image) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={a.image}
          alt=""
          className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-border"
        />
      );
    }
    if (a.gradient) {
      return (
        <span
          className="h-9 w-9 shrink-0 rounded-full ring-1 ring-border"
          style={{
            backgroundImage: `linear-gradient(135deg, ${a.gradient[0]}, ${a.gradient[1]})`,
          }}
        />
      );
    }
    return (
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
        style={{ backgroundColor: night ? color.softDark : color.soft }}
      >
        <Icon className="h-[15px] w-[15px]" style={{ color: color.dot }} />
      </span>
    );
  }

  const meta = RECORD[entry.kind];
  const color = goalColor(meta.color);
  const Icon = meta.icon;
  return (
    <span
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
      style={{ backgroundColor: night ? color.softDark : color.soft }}
    >
      <Icon className="h-[15px] w-[15px]" style={{ color: color.dot }} />
    </span>
  );
}

function EntryRow({
  entry,
  onOpen,
  onDelete,
}: {
  entry: HistoryEntry;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { title, preview } = summarise(entry);
  const isActivity = entry.kind === "activity";

  return (
    <div className="group flex items-center gap-3 pr-2 transition-colors hover:bg-accent/40">
      <button
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3.5 py-3 pl-4 text-left sm:pl-5"
      >
        <EntryAvatar entry={entry} />

        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block text-[15px] leading-snug text-heading",
              isActivity ? "font-normal" : "truncate font-medium"
            )}
          >
            {title}
          </span>
          {preview && (
            <span className="block truncate text-[13px] leading-snug text-muted-foreground">
              {preview}
            </span>
          )}
          {isActivity && (
            <span className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground">
              {entry.activity.targetLabel}
              <ChevronRight className="h-3 w-3" />
            </span>
          )}
        </span>

        <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
          {isActivity ? relativeAge(entry.at) : timeOf(entry.at)}
        </span>
      </button>

      <DeleteButton
        onClick={onDelete}
        label={isActivity ? c.dismiss : c.delete}
      />
    </div>
  );
}

/* ----------------------------------------------------------------- screen */

export function History() {
  const { navigate } = useApp();
  const { entries, daysWithEntries, remove } = useHistory();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [day, setDay] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  // Day + search narrow the set; the segmented control then counts within it,
  // so the numbers on the tabs always describe what is actually on screen.
  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter(
      (e) => (!day || e.day === day) && (!q || e.search.includes(q))
    );
  }, [entries, day, query]);

  const counts = useMemo(() => {
    const t = { all: scoped.length, reflection: 0, manifestation: 0, activity: 0 };
    for (const e of scoped) t[e.kind] += 1;
    return t;
  }, [scoped]);

  const visible = useMemo(
    () => (filter === "all" ? scoped : scoped.filter((e) => e.kind === filter)),
    [scoped, filter]
  );

  const grouped = useMemo(() => groupByDay(visible), [visible]);
  const open = useMemo(
    () => entries.find((e) => e.id === openId) ?? null,
    [entries, openId]
  );

  const filtering = day !== null || query.trim() !== "" || filter !== "all";
  const clearAll = () => {
    setDay(null);
    setQuery("");
    setFilter("all");
  };

  const pickDay = (next: string | null) => {
    setDay(next);
    setPickerOpen(false);
  };

  // An activity points at work that lives on another screen, so opening one
  // goes there. A reflection or manifestation opens as its own report.
  const openEntry = (entry: HistoryEntry) => {
    if (entry.kind === "activity") navigate(entry.activity.target);
    else setOpenId(entry.id);
  };

  const deleteEntry = (entry: HistoryEntry) => {
    remove(entry);
    setOpenId((cur) => (cur === entry.id ? null : cur));
  };

  if (entries.length === 0) {
    return (
      <div>
        <ScreenHeader breadcrumb={c.breadcrumb} title={c.title} subtitle={c.subtitle} />
        <Card className="p-10 text-center">
          <p className="mx-auto max-w-sm text-[15px] leading-relaxed text-muted-foreground">
            {c.empty}
          </p>
          <Button className="mt-5" onClick={() => navigate("reflect")}>
            {copy.dashboard.remindersCta}
          </Button>
        </Card>
      </div>
    );
  }

  const calendar = (
    <MiniCalendar days={daysWithEntries} selected={day} onSelect={pickDay} />
  );

  // A chosen day with nothing on it is a real answer, not an error.
  const emptyDay = day !== null && scoped.length === 0;

  return (
    <div>
      <ScreenHeader breadcrumb={c.breadcrumb} title={c.title} subtitle={c.subtitle} />

      <div className="lg:flex lg:items-start lg:gap-8">
        <div className="min-w-0 flex-1">
          {/* search + date */}
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={c.searchPlaceholder}
                aria-label={c.searchPlaceholder}
                className="h-11 w-full rounded-full border border-border/70 bg-card pl-10 pr-9 text-[15px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-ring"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* the calendar lives in the rail on wide screens, in a popover here */}
            <div className="relative lg:hidden">
              <button
                onClick={() => setPickerOpen((o) => !o)}
                aria-label={c.jumpToDate}
                aria-expanded={pickerOpen}
                className={cn(
                  "grid h-11 w-11 shrink-0 place-items-center rounded-full border transition-colors",
                  day
                    ? "border-transparent bg-foreground text-background"
                    : "border-border/70 bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                <CalendarDays className="h-[18px] w-[18px]" />
              </button>

              <AnimatePresence>
                {pickerOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setPickerOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96, y: -6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96, y: -6 }}
                      transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
                      className="absolute right-0 top-13 z-40 w-[288px] origin-top-right rounded-3xl border border-border bg-card p-4 shadow-xl"
                    >
                      {calendar}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* kind filter */}
          <div className="mt-3 flex gap-1 overflow-x-auto rounded-full bg-secondary p-1">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  aria-pressed={active}
                  className={cn(
                    "relative shrink-0 rounded-full px-3.5 py-1.5 text-[13px] transition-colors",
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="history-filter"
                      className="absolute inset-0 rounded-full bg-card shadow-sm"
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    />
                  )}
                  <span className={cn("relative", active && "font-medium")}>
                    {f.label}
                    <span className="ml-1.5 tabular-nums text-muted-foreground">
                      {counts[f.key]}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* what is being filtered right now */}
          {filtering && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {day && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[13px] text-foreground">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  {dayStamp(day)}
                  <button
                    onClick={() => setDay(null)}
                    aria-label={c.clearDate}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
              <button
                onClick={clearAll}
                className="text-[13px] font-medium text-muted-foreground hover:text-foreground"
              >
                {c.clearFilters}
              </button>
            </div>
          )}

          {/* timeline */}
          {grouped.length === 0 ? (
            <Card className="mt-5 p-10 text-center">
              <p className="text-[15px] font-medium text-heading">
                {emptyDay ? c.noEntriesOnDay : c.noMatch}
              </p>
              {emptyDay && (
                <p className="mx-auto mt-2 max-w-xs text-[14px] leading-relaxed text-muted-foreground">
                  {c.noEntriesOnDayHint}
                </p>
              )}
              <Button variant="secondary" className="mt-5" onClick={clearAll}>
                {c.clearFilters}
              </Button>
            </Card>
          ) : (
            <div className="mt-6 space-y-7">
              {grouped.map(({ day: d, entries: dayEntries }) => (
                <section key={d}>
                  <div className="mb-2.5 flex items-baseline justify-between gap-3 px-1">
                    <h2 className="text-[15px] font-medium text-heading">
                      {dayLabel(d)}
                    </h2>
                    <p className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                      {dayStamp(d)}
                    </p>
                  </div>
                  <Card className="divide-y divide-border/60 overflow-hidden">
                    {dayEntries.map((e) => (
                      <EntryRow
                        key={e.id}
                        entry={e}
                        onOpen={() => openEntry(e)}
                        onDelete={() => deleteEntry(e)}
                      />
                    ))}
                  </Card>
                </section>
              ))}
            </div>
          )}
        </div>

        {/* rail */}
        <aside className="hidden lg:sticky lg:top-8 lg:block lg:w-[248px] lg:shrink-0">
          <Card className="p-4">{calendar}</Card>
          <div className="mt-3 flex items-center justify-between px-1 text-[12px] text-muted-foreground">
            <span className="tabular-nums">
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
            </span>
            <span className="tabular-nums">
              {daysWithEntries.size} {daysWithEntries.size === 1 ? "day" : "days"}
            </span>
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {open && (
          <EntryReport
            entry={open}
            onClose={() => setOpenId(null)}
            onDelete={() => deleteEntry(open)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
