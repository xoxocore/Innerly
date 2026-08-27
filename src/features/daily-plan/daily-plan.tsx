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
  Sparkles,
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
import { useGoals, useTodayTasks, uid } from "@/state/use-data";
import { GoalThread } from "./goal-thread";
import { CalendarModal } from "./calendar-modal";
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

// Anything added just for today still earns a colour — a day of grey rows is
// the thing this screen exists not to be. Derived from the task's own id so a
// task keeps its colour for as long as it lives, across reloads.
function adhocColor(id: string): GoalColor {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GOAL_COLORS[h % GOAL_COLORS.length];
}

function nudge(done: number, total: number): string {
  if (total === 0) return c.nudgeEmpty;
  const left = total - done;
  if (left === 0) return c.nudgeDone;
  if (left === 1) return c.nudgeAlmost;
  if (done === 0) return fill(c.nudgeStart, { n: String(left) });
  return fill(c.nudgeMoving, { n: String(left) });
}

/* ------------------------------------------------------------- task pill */

// Colour is carried entirely by the content: each row wears the tint of the
// goal it belongs to (or its own, if it is just for today), so the day reads
// as a set of coloured intentions rather than a grey checklist.
function TaskPill({
  title,
  note,
  done,
  color,
  onToggle,
}: {
  title: string;
  note: string;
  done: boolean;
  color: GoalColor;
  onToggle: () => void;
}) {
  const { night } = useApp();

  return (
    <motion.button
      layout
      onClick={onToggle}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      aria-pressed={done}
      className={cn(
        "flex w-full items-center gap-3.5 rounded-2xl px-4 py-3.5 text-left transition-[opacity,transform] hover:-translate-y-px",
        done && "opacity-55"
      )}
      style={{ backgroundColor: night ? color.softDark : color.soft }}
    >
      <span
        className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-2 transition-colors"
        style={{
          borderColor: color.dot,
          backgroundColor: done ? color.dot : "transparent",
        }}
      >
        {done && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[15px] leading-snug text-foreground",
            done && "line-through"
          )}
        >
          {title}
        </span>
        <span
          className="mt-0.5 block truncate text-[12px] font-medium"
          style={{ color: color.dot }}
        >
          {note}
        </span>
      </span>
    </motion.button>
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
      style={{ borderRadius: "1.5rem" }}
    >
      <Card
        onClick={onOpen}
        className="group h-full cursor-pointer border-transparent p-5 transition-transform duration-200 hover:-translate-y-0.5"
        style={{ backgroundColor: night ? color.softDark : color.soft }}
      >
        <div className="flex items-start justify-between gap-2">
          <span
            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color.dot }}
          />
          <button
            onPointerDown={(e) => {
              e.stopPropagation();
              controls.start(e);
            }}
            onClick={(e) => e.stopPropagation()}
            aria-label="Drag to reorder"
            className="-mr-1 -mt-1 cursor-grab touch-none text-foreground/25 transition-colors hover:text-foreground/60 active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </div>

        <h3 className="mt-3 text-[17px] font-medium leading-snug text-heading">
          {goal.title || "Untitled goal"}
        </h3>
        {sub && (
          <p className="mt-1.5 line-clamp-2 text-[14px] leading-relaxed text-foreground/65">
            {sub}
          </p>
        )}

        {totalSubs > 0 && (
          <div
            className="mt-4 h-1 w-full overflow-hidden rounded-full"
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

        <div className="mt-3 flex items-center justify-between">
          <span className="text-[12px] font-medium tabular-nums text-foreground/55">
            {totalSubs > 0
              ? fill(c.goalProgress, {
                  done: String(doneSubs),
                  total: String(totalSubs),
                })
              : c.tapToPlan}
          </span>
          <ChevronRight className="h-4 w-4 text-foreground/35 transition-transform group-hover:translate-x-0.5" />
        </div>
      </Card>
    </Reorder.Item>
  );
}

/* ----------------------------------------------------------------- screen */

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

  // Today aggregate: every goal's `today` sub-goals + anything ad-hoc.
  const goalToday = goals.flatMap((g) =>
    g.horizons.today
      .filter((s) => s.title.trim())
      .map((s) => ({ goal: g, sub: s }))
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
            {c.breadcrumb}
          </p>
          <h1 className="mt-2.5 text-[1.6rem] font-normal leading-[1.15] tracking-tight text-heading sm:text-[1.9rem]">
            {c.title}
          </h1>
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" /> {dateLabel}
          </p>
        </div>
        <button
          onClick={() => setShowCalendar(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <CalendarDays className="h-4 w-4" /> {c.calendar}
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
        <div className="mt-8 space-y-10">
          {/* Today leads the page — it is a daily planner before it is a
              goal tracker, and the day is what you act on. */}
          <section>
            <Card className="hero-surface overflow-hidden p-6 sm:p-8">
              <div className="flex items-center gap-5 sm:gap-7">
                <ProgressRing done={todayDone} total={todayTotal} />
                <div className="min-w-0">
                  <h2 className="text-[1.35rem] font-normal tracking-tight text-heading sm:text-[1.6rem]">
                    {c.todayTitle}
                  </h2>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
                    {nudge(todayDone, todayTotal)}
                  </p>
                </div>
              </div>

              {/* compose */}
              <form
                className="mt-6 flex items-center gap-2.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  addAdhoc();
                }}
              >
                <input
                  value={adhoc}
                  onChange={(e) => setAdhoc(e.target.value)}
                  placeholder={c.addPlaceholder}
                  aria-label={c.addPlaceholder}
                  className="h-12 min-w-0 flex-1 rounded-full border border-border/70 bg-background px-5 text-[15px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-ring"
                />
                <button
                  type="submit"
                  aria-label={c.add}
                  disabled={!adhoc.trim()}
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ec4899] to-[#8b5cf6] text-white transition-[opacity,transform] hover:scale-105 disabled:scale-100 disabled:opacity-30"
                >
                  <Plus className="h-5 w-5" strokeWidth={2.5} />
                </button>
              </form>

              {todayTotal === 0 ? (
                <p className="mt-6 text-[15px] leading-relaxed text-muted-foreground">
                  {c.todayEmpty}
                </p>
              ) : (
                <div className="mt-5 space-y-2">
                  <AnimatePresence initial={false}>
                    {goalToday.map(({ goal, sub }) => (
                      <TaskPill
                        key={sub.id}
                        title={sub.title}
                        note={goal.title || "Untitled goal"}
                        done={sub.done}
                        color={goalColor(goal.color)}
                        onToggle={() => toggleSub(goal.id, "today", sub.id)}
                      />
                    ))}
                    {tasks.map((t) => (
                      <TaskPill
                        key={t.id}
                        title={t.title}
                        note={c.justToday}
                        done={t.done}
                        color={adhocColor(t.id)}
                        onToggle={() =>
                          setTasks((prev) =>
                            prev.map((x) =>
                              x.id === t.id ? { ...x, done: !x.done } : x
                            )
                          )
                        }
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </Card>
          </section>

          {/* Goals */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {c.goalsLabel}
              </p>
              <button
                onClick={addGoal}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                <Plus className="h-4 w-4" /> {c.addGoal}
              </button>
            </div>

            {ordered.length === 0 ? (
              <Card className="p-10 text-center">
                <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[#ec4899] to-[#8b5cf6]">
                  <Sparkles className="h-5 w-5 text-white" />
                </span>
                <p className="mx-auto mt-4 max-w-xs text-[15px] leading-relaxed text-muted-foreground">
                  {c.goalsEmpty}
                </p>
                <button
                  onClick={addGoal}
                  className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <Plus className="h-4 w-4" /> {c.goalsEmptyCta}
                </button>
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
