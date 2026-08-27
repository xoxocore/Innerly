"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  Check,
  ChevronDown,
  NotebookPen,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScreenHeader } from "@/components/innerly/screen-header";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { goalColor } from "@/lib/types";
import { useApp } from "@/state/app-context";
import { MiniCalendar } from "./mini-calendar";
import {
  dayLabel,
  dayStamp,
  groupByDay,
  useHistory,
  type HistoryEntry,
  type HistoryKind,
} from "./use-history";

const c = copy.history;

type Filter = "all" | HistoryKind;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: c.filterAll },
  { key: "reflection", label: c.filterReflections },
  { key: "manifestation", label: c.filterManifestations },
  { key: "done", label: c.filterDone },
];

// Each kind borrows a hue from the goal palette so History reads as part of
// the same system rather than a screen with its own colours.
const KIND = {
  reflection: { label: "Reflection", icon: NotebookPen, color: "rose" },
  manifestation: { label: "Manifestation", icon: Sparkles, color: "violet" },
  done: { label: "Completed", icon: Check, color: "emerald" },
} as const;

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/* ------------------------------------------------------------- one entry */

// Collapsed, an entry is a single scannable line; the writing itself is one
// click away. That is the whole point of the screen: an index, not a wall.
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
  const n = e.tasks.length;
  return {
    title: n > 1 ? `${n} things done` : "1 thing done",
    preview: e.tasks.map((t) => t.title).join(" · "),
  };
}

function MicroLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </p>
  );
}

function Detail({ entry }: { entry: HistoryEntry }) {
  if (entry.kind === "reflection") {
    const { moments, differently, review } = entry.reflection;
    return (
      <div className="space-y-5">
        {moments.map((m, i) => (
          <div key={i} className="space-y-1.5">
            {moments.length > 1 && <MicroLabel>Moment {i + 1}</MicroLabel>}
            <p className="text-[15px] leading-relaxed text-foreground">{m.text}</p>
            {m.why && (
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                Because {m.why}
              </p>
            )}
            {m.next && m.next.length > 0 && (
              <ul className="space-y-1 pt-0.5">
                {m.next.filter(Boolean).map((n, j) => (
                  <li
                    key={j}
                    className="flex gap-2 text-[15px] leading-relaxed text-foreground"
                  >
                    <span aria-hidden className="text-muted-foreground">
                      &rarr;
                    </span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}

        {differently && (
          <div className="space-y-1.5">
            <MicroLabel>Next time</MicroLabel>
            <p className="text-[15px] leading-relaxed text-foreground">{differently}</p>
          </div>
        )}

        {review && (
          <div className="space-y-1.5">
            <MicroLabel>Pause &amp; review</MicroLabel>
            <div
              className="prose-innerly text-[15px] leading-relaxed text-foreground/90"
              dangerouslySetInnerHTML={{ __html: review }}
            />
          </div>
        )}
      </div>
    );
  }

  if (entry.kind === "manifestation") {
    const m = entry.manifestation;
    const groups: [string, string[]][] = [
      ["Goals", m.goals],
      ["Affirmations", m.affirmations],
      ["Gratitude", m.gratitude],
      ["Released", m.releases],
    ];
    return (
      <div className="space-y-5">
        {groups
          .filter(([, list]) => list.filter(Boolean).length > 0)
          .map(([label, list]) => (
            <div key={label} className="space-y-1.5">
              <MicroLabel>{label}</MicroLabel>
              <ul className="space-y-1">
                {list.filter(Boolean).map((item, i) => (
                  <li
                    key={i}
                    className="text-[15px] leading-relaxed text-foreground"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {entry.tasks.map((t) => (
        <li key={t.id} className="flex items-start gap-2.5">
          <span className="mt-[3px] grid h-4 w-4 shrink-0 place-items-center rounded-full bg-secondary">
            <Check className="h-2.5 w-2.5 text-muted-foreground" />
          </span>
          <span className="text-[15px] leading-relaxed text-foreground">
            {t.title}
          </span>
        </li>
      ))}
    </ul>
  );
}

function EntryRow({
  entry,
  open,
  onToggle,
}: {
  entry: HistoryEntry;
  open: boolean;
  onToggle: () => void;
}) {
  const { night } = useApp();
  const meta = KIND[entry.kind];
  const color = goalColor(meta.color);
  const Icon = meta.icon;
  const { title, preview } = summarise(entry);

  return (
    <div>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-accent/40 sm:px-5"
      >
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl"
          style={{ backgroundColor: night ? color.softDark : color.soft }}
        >
          <Icon className="h-[15px] w-[15px]" style={{ color: color.dot }} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium leading-snug text-heading">
            {title}
          </span>
          <span
            className={cn(
              "block text-[13px] leading-snug text-muted-foreground",
              open ? "line-clamp-none" : "truncate"
            )}
          >
            {preview}
          </span>
        </span>

        {entry.kind !== "done" && (
          <span className="hidden shrink-0 text-[12px] tabular-nums text-muted-foreground sm:block">
            {timeOf(entry.at)}
          </span>
        )}

        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/50 px-4 py-4 pl-[62px] sm:px-5 sm:pl-[68px]">
              <Detail entry={entry} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ----------------------------------------------------------------- screen */

export function History() {
  const { navigate } = useApp();
  const { entries, daysWithEntries } = useHistory();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [day, setDay] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  // Day + search narrow the set; the segmented control then counts within it,
  // so the numbers on the tabs always describe what is actually on screen.
  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter(
      (e) => (!day || e.day === day) && (!q || e.search.includes(q))
    );
  }, [entries, day, query]);

  const counts = useMemo(() => {
    const t = { all: scoped.length, reflection: 0, manifestation: 0, done: 0 };
    for (const e of scoped) t[e.kind] += 1;
    return t;
  }, [scoped]);

  const visible = useMemo(
    () => (filter === "all" ? scoped : scoped.filter((e) => e.kind === filter)),
    [scoped, filter]
  );

  const grouped = useMemo(() => groupByDay(visible), [visible]);

  // Landing on a single day means you came to read it, so a short day opens
  // itself. Derived rather than an effect, and any click still wins.
  const autoOpen = day !== null && visible.length <= 3;
  const isOpen = (id: string) => overrides[id] ?? autoOpen;
  const toggle = (id: string) =>
    setOverrides((prev) => ({ ...prev, [id]: !(prev[id] ?? autoOpen) }));

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

  // Nothing has ever been recorded — a different situation from a filter that
  // happens to match nothing, and it gets a different answer.
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
              const n = counts[f.key];
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
                    <span className="ml-1.5 tabular-nums text-muted-foreground">{n}</span>
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
                    aria-label="Clear date"
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
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                {c.noMatch}
              </p>
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
                        open={isOpen(e.id)}
                        onToggle={() => toggle(e.id)}
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
    </div>
  );
}
