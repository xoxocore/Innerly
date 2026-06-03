"use client";

import { useState } from "react";
import {
  motion,
  AnimatePresence,
  Reorder,
  useDragControls,
} from "framer-motion";
import {
  CalendarDays,
  Plus,
  GripVertical,
  Check,
  ChevronRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  HORIZONS,
  GOAL_COLORS,
  goalColor,
  emptyHorizons,
  type Goal,
  type Horizon,
} from "@/lib/types";
import { useApp } from "@/state/app-context";
import { useGoals, useTodayTasks, uid } from "@/state/use-data";
import { GoalThread } from "./goal-thread";
import { CalendarModal } from "./calendar-modal";

const NEAREST: Horizon[] = ["today", "thisWeek", "oneMonth", "threeMonths", "sixMonths", "year"];

function preview(goal: Goal): string | undefined {
  for (const h of NEAREST) {
    const found = goal.horizons[h].find((s) => s.title.trim());
    if (found) return found.title;
  }
  return goal.description;
}

export function DailyPlan() {
  const [goals, setGoals] = useGoals();
  const [tasks, setTasks] = useTodayTasks();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [adhoc, setAdhoc] = useState("");

  const ordered = [...goals].sort((a, b) => a.order - b.order);
  const selected = goals.find((g) => g.id === selectedId) ?? null;

  const updateGoal = (g: Goal) =>
    setGoals((prev) => prev.map((x) => (x.id === g.id ? g : x)));

  const addGoal = () => {
    const color = GOAL_COLORS[goals.length % GOAL_COLORS.length].key;
    const goal: Goal = {
      id: uid(),
      title: "",
      color,
      createdAt: new Date().toISOString(),
      order: goals.length,
      horizons: emptyHorizons(),
    };
    setGoals((prev) => [...prev, goal]);
    setSelectedId(goal.id);
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

  const reorderGoals = (next: Goal[]) =>
    setGoals(next.map((g, i) => ({ ...g, order: i })));

  // Today aggregate: every goal's `today` sub-goals + ad-hoc tasks.
  const goalToday = goals.flatMap((g) =>
    g.horizons.today
      .filter((s) => s.title.trim())
      .map((s) => ({ kind: "goal" as const, goal: g, sub: s }))
  );
  const todayTotal = goalToday.length + tasks.length;
  const todayDone =
    goalToday.filter((t) => t.sub.done).length + tasks.filter((t) => t.done).length;

  const addAdhoc = () => {
    const t = adhoc.trim();
    if (!t) return;
    setTasks((prev) => [...prev, { id: uid(), title: t, done: false }]);
    setAdhoc("");
  };

  const dateLabel = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Innerly · Daily Plan
          </p>
          <h1 className="mt-2.5 text-[1.6rem] font-normal leading-[1.15] tracking-tight text-heading sm:text-[1.9rem]">
            Daily Plan
          </h1>
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" /> {dateLabel}
          </p>
        </div>
        <button
          onClick={() => setShowCalendar(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <CalendarDays className="h-4 w-4" /> Calendar
        </button>
      </div>

      {selected ? (
        <div className="mt-10">
          <GoalThread
            goal={selected}
            onBack={() => setSelectedId(null)}
            onUpdate={updateGoal}
            onDelete={() => deleteGoal(selected.id)}
          />
        </div>
      ) : (
        <div className="mt-10 space-y-10">
          {/* Your goals */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Your goals
              </p>
              <button
                onClick={addGoal}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                <Plus className="h-4 w-4" /> Add goal
              </button>
            </div>

            {ordered.length === 0 ? (
              <Card className="p-10 text-center">
                <p className="text-[15px] leading-relaxed text-muted-foreground">
                  No goals yet. Add one and break it down from a year to today.
                </p>
              </Card>
            ) : (
              <Reorder.Group
                axis="y"
                values={ordered}
                onReorder={(next) => reorderGoals(next as Goal[])}
                className="grid gap-4 sm:grid-cols-2"
              >
                <AnimatePresence initial={false}>
                  {ordered.map((goal) => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      onOpen={() => setSelectedId(goal.id)}
                    />
                  ))}
                </AnimatePresence>
              </Reorder.Group>
            )}
          </section>

          {/* Today aggregate */}
          <section>
            <Card className="p-6 sm:p-8">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-medium text-heading">Today</h2>
                  <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
                    Every action from every goal, plus anything just for today.
                  </p>
                </div>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {todayDone} of {todayTotal}
                </span>
              </div>

              {/* progress bar */}
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <motion.div
                  className="h-full rounded-full bg-foreground"
                  initial={false}
                  animate={{
                    width: todayTotal ? `${(todayDone / todayTotal) * 100}%` : "0%",
                  }}
                  transition={{ type: "spring", stiffness: 200, damping: 30 }}
                />
              </div>

              <div className="mt-5 space-y-1">
                <AnimatePresence initial={false}>
                  {goalToday.map(({ goal, sub }) => {
                    const color = goalColor(goal.color);
                    return (
                      <motion.div
                        key={sub.id}
                        layout
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-3 rounded-2xl px-2 py-2"
                      >
                        <button
                          onClick={() => toggleSub(goal.id, "today", sub.id)}
                          className="grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors"
                          style={{
                            borderColor: color.dot,
                            backgroundColor: sub.done ? color.dot : "transparent",
                          }}
                          aria-label="Toggle"
                        >
                          {sub.done && <Check className="h-3 w-3 text-white" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "text-[15px] leading-snug",
                              sub.done && "text-muted-foreground line-through"
                            )}
                          >
                            {sub.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {goal.title || "Untitled goal"}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}

                  {tasks.map((t) => (
                    <motion.div
                      key={t.id}
                      layout
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-3 rounded-2xl px-2 py-2"
                    >
                      <button
                        onClick={() =>
                          setTasks((prev) =>
                            prev.map((x) =>
                              x.id === t.id ? { ...x, done: !x.done } : x
                            )
                          )
                        }
                        className={cn(
                          "grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors",
                          t.done
                            ? "border-foreground bg-foreground text-background"
                            : "border-border"
                        )}
                        aria-label="Toggle"
                      >
                        {t.done && <Check className="h-3 w-3" />}
                      </button>
                      <p
                        className={cn(
                          "flex-1 text-[15px]",
                          t.done && "text-muted-foreground line-through"
                        )}
                      >
                        {t.title}
                      </p>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {todayTotal === 0 && (
                  <p className="px-2 py-3 text-[15px] leading-relaxed text-muted-foreground">
                    Open a goal and add a Today action — or add one just for today
                    below.
                  </p>
                )}
              </div>

              <form
                className="mt-4 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  addAdhoc();
                }}
              >
                <input
                  value={adhoc}
                  onChange={(e) => setAdhoc(e.target.value)}
                  placeholder="Add something just for today…"
                  className="flex-1 rounded-2xl border border-input bg-card px-4 py-3 text-[15px] outline-none focus:border-ring"
                />
                <button
                  type="submit"
                  aria-label="Add"
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </form>
            </Card>
          </section>
        </div>
      )}

      <AnimatePresence>
        {showCalendar && (
          <CalendarModal
            goals={goals}
            onToggleSub={toggleSub}
            onClose={() => setShowCalendar(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

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
      style={{ borderRadius: "1.5rem" }}
    >
      <Card
        onClick={onOpen}
        className="group h-full cursor-pointer p-5 transition-colors hover:bg-accent"
        style={{ backgroundColor: night ? color.softDark : color.soft }}
      >
        <div className="flex items-center justify-between">
          <span
            className="h-3.5 w-3.5 rounded-full"
            style={{ backgroundColor: color.dot }}
          />
          <button
            onPointerDown={(e) => {
              e.stopPropagation();
              controls.start(e);
            }}
            onClick={(e) => e.stopPropagation()}
            aria-label="Drag to reorder"
            className="cursor-grab touch-none text-foreground/30 transition-opacity hover:text-foreground/60 active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </div>
        <h3 className="mt-4 text-lg font-medium text-heading">
          {goal.title || "Untitled goal"}
        </h3>
        {sub && (
          <p className="mt-1.5 line-clamp-2 text-[15px] leading-relaxed text-foreground/70">
            {sub}
          </p>
        )}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs font-medium text-foreground/60">
            {totalSubs > 0 ? `${doneSubs}/${totalSubs} done` : "Tap to plan"}
          </span>
          <ChevronRight className="h-4 w-4 text-foreground/40 transition-transform group-hover:translate-x-0.5" />
        </div>
      </Card>
    </Reorder.Item>
  );
}
