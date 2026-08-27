"use client";

import { useMemo, useState } from "react";
import {
  motion,
  AnimatePresence,
  Reorder,
  useDragControls,
} from "framer-motion";
import {
  CalendarRange,
  Plus,
  GripVertical,
  Check,
  ChevronRight,
  Sparkles,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { copy, fill } from "@/lib/copy";
import { cn } from "@/lib/utils";
import {
  HORIZONS,
  GOAL_COLORS,
  goalColor,
  emptyHorizons,
  type Goal,
  type GoalColor,
  type Horizon,
} from "@/lib/types";
import { useApp } from "@/state/app-context";
import { useDayTasks, useGoals, uid } from "@/state/use-data";
import { useTaskDays } from "@/state/use-task-days";
import { GoalThread } from "./goal-thread";
import { CalendarModal } from "./calendar-modal";
import { MonthCalendar, keyOf, type DayChip } from "./month-calendar";
import { allItems } from "./items";
import { ProgressRing } from "./progress-ring";

const c = copy.dailyPlan;

const NEAREST: Horizon[] = [
  "today",
  "thisWeek",
  "oneMonth",
  "threeMonths",
  "sixMonths",
  "year",
];

function preview(goal: Goal): string | undefined {
  for (const h of NEAREST) {
    const found = goal.horizons[h].find((s) => s.title.trim());
    if (found) return found.title;
  }
  return goal.description;
}

// A task added for a day still earns a colour. Derived from the task's own id
// so it keeps that colour for as long as it lives, across reloads.
function adhocColor(id: string): GoalColor {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GOAL_COLORS[h % GOAL_COLORS.length];
}

function dayHeading(key: string, today: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const [ty, tm, td] = today.split("-").map(Number);
  const diff = Math.round(
    (date.getTime() - new Date(ty, tm - 1, td).getTime()) / 86400000
  );
  if (diff === 0) return c.today;
  if (diff === 1) return c.tomorrow;
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

function daySubheading(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/* --------------------------------------------------------------- day row */

// Compact by design: a hairline-separated row, not a card. The colour is a
// 3px rail and the dot, which is all the day needs to stay legible at a
// glance without turning the list into a stack of blocks.
function DayRow({
  title,
  note,
  done,
  color,
  onToggle,
  onRemove,
}: {
  title: string;
  note: string;
  done: boolean;
  color: GoalColor;
  onToggle: () => void;
  onRemove?: () => void;
}) {
  const { night } = useApp();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ type: "spring", stiffness: 600, damping: 45 }}
      className="group flex items-center gap-2.5 rounded-lg py-1.5 pl-2 pr-1 transition-colors hover:bg-accent/50"
    >
      <span
        aria-hidden
        className="h-7 w-[3px] shrink-0 rounded-full"
        style={{ backgroundColor: done ? "transparent" : color.dot }}
      />
      <button
        onClick={onToggle}
        aria-pressed={done}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
      >
        <span
          className="grid h-[17px] w-[17px] shrink-0 place-items-center rounded-full border-[1.5px] transition-colors"
          style={{
            borderColor: done ? color.dot : color.dot + "99",
            backgroundColor: done ? color.dot : "transparent",
          }}
        >
          {done && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} />}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-[13.5px] leading-snug text-foreground",
              done && "text-muted-foreground line-through"
            )}
          >
            {title}
          </span>
          <span
            className="block truncate text-[11px] leading-tight"
            style={{ color: night ? color.dot : color.ink }}
          >
            {note}
          </span>
        </span>
      </button>

      {onRemove && (
        <button
          onClick={onRemove}
          aria-label={c.remove}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted-foreground opacity-100 transition-all hover:bg-accent hover:text-destructive lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------- goal card */

function GoalCard({ goal, onOpen }: { goal: Goal; onOpen: () => void }) {
  const { night } = useApp();
  const controls = useDragControls();
  const color = goalColor(goal.color);
  const sub = preview(goal);

  const totalSubs = HORIZONS.reduce(
    (n, h) => n + goal.horizons[h.key].filter((s) => s.title.trim()).length,
    0
  );
  const doneSubs = HORIZONS.reduce(
    (n, h) => n + goal.horizons[h.key].filter((s) => s.title.trim() && s.done).length,
    0
  );
  const pct = totalSubs > 0 ? (doneSubs / totalSubs) * 100 : 0;

  return (
    <Reorder.Item
      value={goal}
      dragListener={false}
      dragControls={controls}
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      whileDrag={{ scale: 1.03, boxShadow: "0 12px 40px rgba(0,0,0,0.12)" }}
      className="relative"
      style={{ borderRadius: "1rem" }}
    >
      <Card
        onClick={onOpen}
        className="group h-full cursor-pointer rounded-2xl border-transparent p-3.5 transition-transform duration-200 hover:-translate-y-0.5"
        style={{ backgroundColor: night ? color.softDark : color.soft }}
      >
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: color.dot }}
          />
          <h3 className="min-w-0 flex-1 truncate text-[14px] font-medium text-heading">
            {goal.title || "Untitled goal"}
          </h3>
          <button
            onPointerDown={(e) => {
              e.stopPropagation();
              controls.start(e);
            }}
            onClick={(e) => e.stopPropagation()}
            aria-label="Drag to reorder"
            className="cursor-grab touch-none text-foreground/20 transition-colors hover:text-foreground/60 active:cursor-grabbing"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        </div>

        {sub && (
          <p className="mt-1.5 truncate text-[12.5px] leading-relaxed text-foreground/60">
            {sub}
          </p>
        )}

        {totalSubs > 0 && (
          <div
            className="mt-2.5 h-[3px] w-full overflow-hidden rounded-full"
            style={{ backgroundColor: color.dot + "26" }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: color.dot }}
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={{ type: "spring", stiffness: 200, damping: 30 }}
            />
          </div>
        )}

        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] font-medium tabular-nums text-foreground/50">
            {totalSubs > 0
              ? fill(c.goalProgress, {
                  done: String(doneSubs),
                  total: String(totalSubs),
                })
              : c.tapToPlan}
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-foreground/30 transition-transform group-hover:translate-x-0.5" />
        </div>
      </Card>
    </Reorder.Item>
  );
}

/* ----------------------------------------------------------------- screen */

export function DailyPlan() {
  const [goals, setGoals] = useGoals();
  const taskDays = useTaskDays();

  const todayKey = keyOf(new Date());
  const [selected, setSelected] = useState(todayKey);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [draft, setDraft] = useState("");

  // Tasks for whichever day is selected — the same per-day keys the Dashboard
  // reads today's from, so anything put on today shows up there untouched.
  const [dayTasks, setDayTasks] = useDayTasks(selected);

  const ordered = [...goals].sort((a, b) => a.order - b.order);
  const goal = goals.find((g) => g.id === selectedId) ?? null;

  const updateGoal = (g: Goal) =>
    setGoals((prev) => prev.map((x) => (x.id === g.id ? g : x)));

  const addGoal = () => {
    const color = GOAL_COLORS[goals.length % GOAL_COLORS.length].key;
    const next: Goal = {
      id: uid(),
      title: "",
      color,
      createdAt: new Date().toISOString(),
      order: goals.length,
      horizons: emptyHorizons(),
    };
    setGoals((prev) => [...prev, next]);
    setSelectedId(next.id);
  };

  const deleteGoal = (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    setSelectedId(null);
  };

  const toggleSub = (goalId: string, horizon: Horizon, subId: string) =>
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goalId
          ? {
              ...g,
              horizons: {
                ...g.horizons,
                [horizon]: g.horizons[horizon].map((s) =>
                  s.id === subId ? { ...s, done: !s.done } : s
                ),
              },
            }
          : g
      )
    );

  // Goal sub-goals resolved to the day their horizon falls on, so the calendar
  // carries deadlines alongside the things you added by hand.
  const goalByDay = useMemo(() => {
    const map = new Map<string, ReturnType<typeof allItems>>();
    for (const item of allItems(goals)) {
      if (!item.sub.title.trim()) continue;
      const k = keyOf(item.date);
      const bucket = map.get(k);
      if (bucket) bucket.push(item);
      else map.set(k, [item]);
    }
    return map;
  }, [goals]);

  const chipsByDay = useMemo(() => {
    const map = new Map<string, DayChip[]>();
    const push = (day: string, chip: DayChip) => {
      const bucket = map.get(day);
      if (bucket) bucket.push(chip);
      else map.set(day, [chip]);
    };
    for (const { day, tasks } of taskDays)
      for (const t of tasks)
        push(day, {
          id: t.id,
          title: t.title,
          color: adhocColor(t.id).key,
          done: t.done,
        });
    for (const [day, items] of goalByDay)
      for (const item of items)
        push(day, {
          id: item.sub.id,
          title: item.sub.title,
          color: item.color,
          done: item.sub.done,
        });
    return map;
  }, [taskDays, goalByDay]);

  const dayGoalItems = goalByDay.get(selected) ?? [];
  const total = dayTasks.length + dayGoalItems.length;
  const done =
    dayTasks.filter((t) => t.done).length +
    dayGoalItems.filter((i) => i.sub.done).length;

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    setDayTasks((prev) => [...prev, { id: uid(), title, done: false }]);
    setDraft("");
  };

  if (goal) {
    return (
      <div>
        <GoalThread
          goal={goal}
          onBack={() => setSelectedId(null)}
          onUpdate={updateGoal}
          onDelete={() => deleteGoal(goal.id)}
        />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {c.breadcrumb}
          </p>
          <h1 className="mt-2 text-[1.5rem] font-normal leading-[1.15] tracking-tight text-heading sm:text-[1.75rem]">
            {c.title}
          </h1>
        </div>
        <button
          onClick={() => setShowTimeline(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
        >
          <CalendarRange className="h-3.5 w-3.5" /> {c.calendar}
        </button>
      </div>

      {/* Calendar + the selected day, the way a calendar app pairs them */}
      <div className="mt-6 lg:flex lg:items-start lg:gap-6">
        <Card className="min-w-0 flex-1 overflow-hidden p-3 sm:p-4">
          <MonthCalendar
            chipsByDay={chipsByDay}
            selected={selected}
            onSelect={setSelected}
          />
        </Card>

        <aside className="mt-5 lg:mt-0 lg:sticky lg:top-8 lg:w-[300px] lg:shrink-0">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <ProgressRing done={done} total={total} />
              <div className="min-w-0">
                <h2 className="text-[17px] font-medium leading-tight text-heading">
                  {dayHeading(selected, todayKey)}
                </h2>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {daySubheading(selected)}
                </p>
              </div>
            </div>

            <form
              className="mt-4 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                add();
              }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={c.addPlaceholder}
                aria-label={c.addPlaceholder}
                className="h-9 min-w-0 flex-1 rounded-full border border-border/70 bg-background px-3.5 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-ring"
              />
              <button
                type="submit"
                aria-label={c.add}
                disabled={!draft.trim()}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#007AFF] text-white transition-[opacity,transform] hover:scale-105 disabled:scale-100 disabled:opacity-25"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </form>

            {total === 0 ? (
              <p className="mt-4 px-1 text-[13px] leading-relaxed text-muted-foreground">
                {c.dayEmpty}
              </p>
            ) : (
              <div className="mt-3 space-y-0.5">
                <AnimatePresence initial={false}>
                  {dayGoalItems.map((item) => (
                    <DayRow
                      key={item.sub.id}
                      title={item.sub.title}
                      note={item.goalTitle || c.fromGoals}
                      done={item.sub.done}
                      color={goalColor(item.color)}
                      onToggle={() =>
                        toggleSub(item.goalId, item.horizon, item.sub.id)
                      }
                    />
                  ))}
                  {dayTasks.map((t) => (
                    <DayRow
                      key={t.id}
                      title={t.title}
                      note={c.justToday}
                      done={t.done}
                      color={adhocColor(t.id)}
                      onToggle={() =>
                        setDayTasks((prev) =>
                          prev.map((x) =>
                            x.id === t.id ? { ...x, done: !x.done } : x
                          )
                        )
                      }
                      onRemove={() =>
                        setDayTasks((prev) => prev.filter((x) => x.id !== t.id))
                      }
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </Card>
        </aside>
      </div>

      {/* Goals */}
      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {c.goalsLabel}
          </p>
          <button
            onClick={addGoal}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Plus className="h-3.5 w-3.5" /> {c.addGoal}
          </button>
        </div>

        {ordered.length === 0 ? (
          <Card className="p-8 text-center">
            <span className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-[#007AFF]">
              <Sparkles className="h-4 w-4 text-white" />
            </span>
            <p className="mx-auto mt-3 max-w-xs text-[13.5px] leading-relaxed text-muted-foreground">
              {c.goalsEmpty}
            </p>
            <button
              onClick={addGoal}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" /> {c.goalsEmptyCta}
            </button>
          </Card>
        ) : (
          <Reorder.Group
            axis="y"
            values={ordered}
            onReorder={(next) =>
              setGoals((next as Goal[]).map((g, i) => ({ ...g, order: i })))
            }
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            <AnimatePresence initial={false}>
              {ordered.map((g) => (
                <GoalCard key={g.id} goal={g} onOpen={() => setSelectedId(g.id)} />
              ))}
            </AnimatePresence>
          </Reorder.Group>
        )}
      </section>

      <AnimatePresence>
        {showTimeline && (
          <CalendarModal
            goals={goals}
            onToggleSub={toggleSub}
            onClose={() => setShowTimeline(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
