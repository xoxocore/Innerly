"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar as CalendarIcon,
  X,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Check,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { goalColor, type Goal, type Horizon } from "@/lib/types";
import { useApp } from "@/state/app-context";
import { allItems, sameDay, formatItemDate, type PlanItem } from "./items";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

// Nearest horizon first in the list.
const HORIZON_ORDER: Horizon[] = [
  "today",
  "thisWeek",
  "oneMonth",
  "threeMonths",
  "sixMonths",
  "year",
];

type GoalGroup = {
  goalId: string;
  goalTitle: string;
  color: string;
  horizons: { horizon: Horizon; label: string; items: PlanItem[] }[];
};

export function CalendarModal({
  goals,
  onToggleSub,
  onClose,
}: {
  goals: Goal[];
  onToggleSub: (goalId: string, horizon: Horizon, subId: string) => void;
  onClose: () => void;
}) {
  const { night } = useApp();
  const today = new Date();

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [focus, setFocus] = useState<PlanItem | null>(null);
  const [flip, setFlip] = useState(false);

  // Only incomplete items appear on the calendar.
  const items = useMemo(
    () => allItems(goals).filter((i) => !i.sub.done && i.sub.title.trim()),
    [goals]
  );

  const monthsWithItems = useMemo(() => {
    const s = new Set<number>();
    for (const i of items)
      if (i.date.getFullYear() === year) s.add(i.date.getMonth());
    return s;
  }, [items, year]);

  const dayCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const i of items)
      if (i.date.getFullYear() === year && i.date.getMonth() === month)
        m.set(i.date.getDate(), (m.get(i.date.getDate()) ?? 0) + 1);
    return m;
  }, [items, year, month]);

  // Group by goal -> sub-group by horizon (nearest first). Day filter applies
  // when a calendar day is clicked.
  const groups = useMemo<GoalGroup[]>(() => {
    const visible = selectedDay
      ? items.filter((i) => sameDay(i.date, selectedDay))
      : items;
    const byGoal = new Map<string, PlanItem[]>();
    for (const i of visible) {
      if (!byGoal.has(i.goalId)) byGoal.set(i.goalId, []);
      byGoal.get(i.goalId)!.push(i);
    }
    return [...byGoal.entries()].map(([goalId, its]) => {
      const horizons = HORIZON_ORDER.map((h) => ({
        horizon: h,
        label: its.find((x) => x.horizon === h)?.horizonLabel ?? "",
        items: its.filter((x) => x.horizon === h),
      })).filter((g) => g.items.length > 0);
      return {
        goalId,
        goalTitle: its[0].goalTitle,
        color: its[0].color,
        horizons,
      };
    });
  }, [items, selectedDay]);

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const goToToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelectedDay(today);
    setFocus(null);
  };

  // Clicking a task: jump the calendar to its deadline and highlight it.
  const focusItem = (it: PlanItem) => {
    setYear(it.date.getFullYear());
    setMonth(it.date.getMonth());
    setSelectedDay(null);
    setFocus(it);
  };

  const ListPanel = (
    <motion.div
      layout
      className="w-full shrink-0 overflow-y-auto overflow-x-hidden pr-1 lg:w-[360px]"
    >
      {groups.length === 0 ? (
        <p className="px-1 py-8 text-[15px] leading-relaxed text-muted-foreground">
          {selectedDay
            ? "Nothing planned for this day."
            : "Add goals and sub-goals — they'll gather here across time."}
        </p>
      ) : (
        <div className="space-y-7">
          {groups.map((group) => {
            const color = goalColor(group.color);
            return (
              <div key={group.goalId}>
                {/* goal header */}
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: color.dot }}
                  />
                  <p className="text-sm font-semibold text-heading">
                    {group.goalTitle || "Untitled goal"}
                  </p>
                </div>

                {/* horizon sub-groups */}
                <div className="space-y-4 border-l border-border pl-3">
                  {group.horizons.map(({ horizon, label, items: hItems }) => (
                    <div key={horizon}>
                      <p
                        className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em]"
                        style={{ color: color.dot }}
                      >
                        {label}
                      </p>
                      <div className="space-y-1.5">
                        <AnimatePresence initial={false}>
                          {hItems.map((it) => {
                            const isFocused = focus?.sub.id === it.sub.id;
                            return (
                              <motion.button
                                key={it.sub.id}
                                layout
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ type: "spring", stiffness: 500, damping: 40 }}
                                onClick={() => focusItem(it)}
                                className="flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition-shadow"
                                style={{
                                  backgroundColor: night ? color.softDark : color.soft,
                                  boxShadow: isFocused ? `0 0 0 2px ${color.dot}` : "none",
                                }}
                              >
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleSub(it.goalId, it.horizon, it.sub.id);
                                  }}
                                  className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors"
                                  style={{ borderColor: color.dot }}
                                  aria-label="Mark complete"
                                >
                                  <Check className="h-3 w-3 opacity-0" />
                                </span>
                                <div className="min-w-0">
                                  <p className="text-[15px] font-medium leading-snug text-foreground">
                                    {it.sub.title}
                                  </p>
                                  <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                                    <CalendarClock className="h-3 w-3" />
                                    {it.horizon === "today" ? "Due today" : "Due"}{" "}
                                    {formatItemDate(it.date)}
                                  </p>
                                </div>
                              </motion.button>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );

  const focusColor = focus ? goalColor(focus.color) : null;

  const CalendarPanel = (
    <motion.div layout className="min-w-0 flex-1">
      {/* year nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="grid h-8 w-8 place-items-center rounded-full hover:bg-accent"
            aria-label="Previous year"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-2xl font-bold tracking-tight text-heading">
            {year}
          </span>
          <button
            onClick={() => setYear((y) => y + 1)}
            className="grid h-8 w-8 place-items-center rounded-full hover:bg-accent"
            aria-label="Next year"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <button
          onClick={goToToday}
          className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          Today
        </button>
      </div>

      {/* deadline banner when a task is focused */}
      <AnimatePresence>
        {focus && focusColor && (
          <motion.div
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            className="mt-3 overflow-hidden"
          >
            <div
              className="flex items-center gap-2 rounded-2xl px-3 py-2.5"
              style={{ backgroundColor: night ? focusColor.softDark : focusColor.soft }}
            >
              <CalendarClock className="h-4 w-4" style={{ color: focusColor.dot }} />
              <p className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                <span className="font-medium">{focus.sub.title}</span>
                <span className="text-muted-foreground"> · due {formatItemDate(focus.date)}</span>
              </p>
              <button
                onClick={() => setFocus(null)}
                aria-label="Clear"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* month row */}
      <div className="mt-5 grid grid-cols-6 gap-1.5">
        {MONTHS.map((m, i) => {
          const active = i === month;
          const has = monthsWithItems.has(i);
          return (
            <button
              key={m}
              onClick={() => {
                setMonth(i);
                setSelectedDay(null);
              }}
              className={cn(
                "relative rounded-xl py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {m}
              {has && !active && (
                <span className="absolute left-1/2 top-1 h-1 w-1 -translate-x-1/2 rounded-full bg-foreground/60" />
              )}
            </button>
          );
        })}
      </div>

      {/* weekday headers */}
      <div className="mt-6 grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="text-xs font-medium text-muted-foreground">
            {w}
          </span>
        ))}
      </div>

      {/* day grid */}
      <div className="mt-2 grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (day === null) return <span key={idx} />;
          const date = new Date(year, month, day);
          const isToday = sameDay(date, today);
          const isSelected = selectedDay && sameDay(date, selectedDay);
          const isFocusDay = focus && sameDay(date, focus.date);
          const count = dayCounts.get(day) ?? 0;
          return (
            <motion.button
              key={idx}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              animate={isFocusDay ? { scale: [1, 1.18, 1] } : { scale: 1 }}
              transition={{ duration: 0.4 }}
              onClick={() => {
                setSelectedDay(isSelected ? null : date);
                setFocus(null);
              }}
              className={cn(
                "relative grid aspect-square place-items-center rounded-2xl text-sm transition-colors",
                isToday && "bg-foreground font-semibold text-background",
                !isToday && (isSelected || isFocusDay) && "font-semibold",
                !isToday && !isSelected && !isFocusDay && "text-foreground hover:bg-accent"
              )}
              style={
                !isToday && isFocusDay && focusColor
                  ? { backgroundColor: focusColor.dot, color: "#fff" }
                  : !isToday && isSelected
                    ? { backgroundColor: "var(--secondary)" }
                    : undefined
              }
            >
              {day}
              {count > 0 && (
                <span className="absolute bottom-1.5 flex gap-0.5">
                  {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1 w-1 rounded-full",
                        isToday || isFocusDay ? "bg-background" : "bg-foreground/60"
                      )}
                    />
                  ))}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-border bg-card p-6 sm:p-8"
        >
          {/* header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-heading">
                <CalendarIcon className="h-6 w-6" /> Calendar
              </h2>
              <p className="mt-1 text-[15px] text-muted-foreground">
                Everything you&apos;re planning, across time.
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFlip((f) => !f)}
                aria-label="Switch sides"
                className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <ArrowLeftRight className="h-5 w-5" />
              </button>
              <button
                onClick={onClose}
                aria-label="Close"
                className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* body */}
          <div
            className={cn(
              "mt-6 flex min-h-0 flex-1 flex-col gap-8 lg:flex-row",
              flip && "lg:flex-row-reverse"
            )}
          >
            {ListPanel}
            <div className="hidden w-px bg-border lg:block" />
            {CalendarPanel}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
