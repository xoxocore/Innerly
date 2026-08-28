"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { copy } from "@/lib/copy";
import { goalColor } from "@/lib/types";
import { useApp } from "@/state/app-context";

const c = copy.dailyPlan;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type DayChip = { id: string; title: string; color: string; done: boolean };

export const keyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const MAX_CHIPS = 3;

function Chip({ chip }: { chip: DayChip }) {
  const { night } = useApp();
  const color = goalColor(chip.color);
  return (
    <span
      className={cn(
        "block truncate rounded-[5px] px-1.5 py-[3px] text-[11px] leading-tight",
        chip.done && "line-through opacity-50"
      )}
      style={{
        backgroundColor: night ? color.softDark : color.soft,
        color: night ? color.dot : color.ink,
      }}
    >
      {chip.title}
    </span>
  );
}

// A month grid in the shape macOS Calendar uses: a quiet frame of hairlines,
// with every bit of colour coming from the things you actually put in the day.
export function MonthCalendar({
  chipsByDay,
  selected,
  onSelect,
}: {
  chipsByDay: Map<string, DayChip[]>;
  selected: string;
  onSelect: (day: string) => void;
}) {
  const today = new Date();
  const todayKey = keyOf(today);

  const [view, setView] = useState(() => {
    const [y, m] = selected.split("-").map(Number);
    return { year: y, month: m - 1 };
  });

  const step = (delta: number) =>
    setView(({ year, month }) => {
      const next = new Date(year, month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });

  const goToday = () => {
    setView({ year: today.getFullYear(), month: today.getMonth() });
    onSelect(todayKey);
  };

  // Always six rows, so the grid never changes height as you page months.
  const cells = useMemo(() => {
    const first = new Date(view.year, view.month, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [view]);

  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric" }
  );

  return (
    <div className="select-none">
      <div className="flex items-center justify-between px-1 pb-3">
        <h2 className="text-[15px] font-medium text-heading">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={goToday}
            className="rounded-full px-2.5 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {c.today}
          </button>
          <button
            onClick={() => step(-1)}
            aria-label="Previous month"
            className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => step(1)}
            aria-label="Next month"
            className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-border/60">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="pb-1.5 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70"
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((d) => {
          const key = keyOf(d);
          const inMonth = d.getMonth() === view.month;
          const isToday = key === todayKey;
          const isSelected = key === selected;
          const chips = chipsByDay.get(key) ?? [];
          const overflow = chips.length - MAX_CHIPS;

          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              aria-pressed={isSelected}
              aria-label={d.toLocaleDateString("en-US", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              className={cn(
                "flex min-h-[58px] flex-col gap-1 sm:min-h-[92px] border-b border-r border-border/50 p-1.5 text-left transition-colors last:border-r-0 [&:nth-child(7n)]:border-r-0",
                !inMonth && "bg-secondary/25",
                isSelected ? "bg-accent/70" : "hover:bg-accent/40"
              )}
            >
              <span
                className={cn(
                  "grid h-[22px] w-[22px] shrink-0 place-items-center justify-self-start rounded-full text-[12px] tabular-nums",
                  !inMonth && "text-muted-foreground/40",
                  inMonth && !isToday && "text-foreground",
                  isToday && "bg-[#FF3B30] font-medium text-white"
                )}
              >
                {d.getDate()}
              </span>

              {/* A phone cell is too narrow for readable titles, so it gets
                  dots — the same thing iOS does at this size. */}
              <span className="flex flex-wrap items-center gap-1 px-0.5 sm:hidden">
                {chips.slice(0, MAX_CHIPS).map((chip) => (
                  <span
                    key={chip.id}
                    className={cn("h-1.5 w-1.5 rounded-full", chip.done && "opacity-40")}
                    style={{ backgroundColor: goalColor(chip.color).dot }}
                  />
                ))}
                {overflow > 0 && (
                  <span className="text-[9px] font-medium leading-none text-muted-foreground">
                    +{overflow}
                  </span>
                )}
              </span>

              <span className="hidden min-w-0 flex-col gap-[3px] sm:flex">
                {chips.slice(0, MAX_CHIPS).map((chip) => (
                  <Chip key={chip.id} chip={chip} />
                ))}
                {overflow > 0 && (
                  <span className="px-1.5 text-[10px] font-medium text-muted-foreground">
                    {overflow} more
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
