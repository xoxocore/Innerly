"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { dayDate } from "./use-history";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const keyOf = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

const monthIndex = (y: number, m: number) => y * 12 + m;

export function MiniCalendar({
  days,
  selected,
  onSelect,
  className,
}: {
  days: Set<string>;
  selected: string | null;
  onSelect: (day: string | null) => void;
  className?: string;
}) {
  const today = new Date();
  const todayKey = keyOf(today.getFullYear(), today.getMonth(), today.getDate());

  // Open on the selected day, else on the most recent day that has anything.
  const [view, setView] = useState(() => {
    const anchor = selected ?? [...days].sort().pop();
    const d = anchor ? dayDate(anchor) : today;
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // Any past day is selectable — an empty one answers "nothing on this day"
  // rather than being unreachable. Only the future is closed off.
  const canNext =
    monthIndex(view.year, view.month) <
    monthIndex(today.getFullYear(), today.getMonth());

  const step = (delta: number) =>
    setView(({ year, month }) => {
      const next = new Date(year, month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });

  const firstWeekday = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric" }
  );

  return (
    <div className={cn("select-none", className)}>
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-heading">{monthLabel}</p>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => step(-1)}
            aria-label="Previous month"
            className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => step(1)}
            disabled={!canNext}
            aria-label="Next month"
            className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-25"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-y-1">
        {WEEKDAYS.map((w, i) => (
          <div
            key={i}
            className="text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70"
          >
            {w}
          </div>
        ))}

        {cells.map((d, i) => {
          if (d === null) return <div key={"pad" + i} />;

          const key = keyOf(view.year, view.month, d);
          const has = days.has(key);
          const isSelected = selected === key;
          const isToday = key === todayKey;
          const isFuture = key > todayKey;

          return (
            <div key={key} className="grid place-items-center py-0.5">
              <button
                onClick={() => onSelect(isSelected ? null : key)}
                disabled={isFuture}
                aria-pressed={isSelected}
                aria-label={dayDate(key).toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                className={cn(
                  "relative grid h-8 w-8 place-items-center rounded-full text-[13px] tabular-nums transition-colors",
                  isSelected
                    ? "bg-foreground font-medium text-background"
                    : isFuture
                      ? "cursor-default text-muted-foreground/25"
                      : has
                        ? "font-medium text-foreground hover:bg-accent"
                        : "text-muted-foreground/60 hover:bg-accent hover:text-foreground",
                  !isSelected && isToday && "ring-1 ring-border"
                )}
              >
                {d}
                {has && !isSelected && (
                  <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[#e9a8bf] dark:bg-[#8d5b6e]" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
