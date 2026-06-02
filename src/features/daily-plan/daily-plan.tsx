"use client";

import { useState } from "react";
import { Plus, Trash, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScreenHeader } from "@/components/innerly/screen-header";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { useGoals, useTodayTasks, uid } from "@/state/use-data";
import { ACCENTS } from "@/lib/types";
import { gradient } from "@/lib/content";

const c = copy.dailyPlan;

export function DailyPlan() {
  const [tasks, setTasks] = useTodayTasks();
  const [goals, setGoals] = useGoals();
  const [taskInput, setTaskInput] = useState("");
  const [goalInput, setGoalInput] = useState("");

  const addTask = (title: string, goalId?: string) => {
    const t = title.trim();
    if (!t) return;
    setTasks((prev) => [...prev, { id: uid(), title: t, done: false, goalId }]);
  };

  const toggleTask = (id: string) =>
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  const removeTask = (id: string) =>
    setTasks((prev) => prev.filter((t) => t.id !== id));

  const addGoal = () => {
    const title = goalInput.trim();
    if (!title) return;
    setGoals((prev) => [
      ...prev,
      {
        id: uid(),
        title,
        color: ACCENTS[prev.length % ACCENTS.length][0],
        createdAt: new Date().toISOString(),
        steps: [],
      },
    ]);
    setGoalInput("");
  };

  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <div>
      <ScreenHeader breadcrumb={c.breadcrumb} title={c.title} />

      {/* Just for today */}
      <Card className="p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-heading">Just for today</h2>
          {tasks.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {doneCount} of {tasks.length} done
            </span>
          )}
        </div>

        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addTask(taskInput);
            setTaskInput("");
          }}
        >
          <input
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            placeholder="One small step for today…"
            className="flex-1 rounded-2xl border border-input bg-card px-4 py-3 text-[15px] outline-none focus:border-ring"
          />
          <Button type="submit" size="icon" aria-label="Add task">
            <Plus className="h-5 w-5" />
          </Button>
        </form>

        {tasks.length === 0 ? (
          <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">
            {copy.dashboard.todayEmpty}
          </p>
        ) : (
          <ul className="mt-5 space-y-2">
            {tasks.map((t) => (
              <li
                key={t.id}
                className="group flex items-center gap-3 rounded-2xl px-2 py-1.5 hover:bg-accent"
              >
                <button
                  onClick={() => toggleTask(t.id)}
                  className={cn(
                    "grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors",
                    t.done
                      ? "border-foreground bg-foreground text-background"
                      : "border-border"
                  )}
                >
                  {t.done && <Check className="h-3 w-3" />}
                </button>
                <span
                  className={cn(
                    "flex-1 text-[15px]",
                    t.done && "text-muted-foreground line-through"
                  )}
                >
                  {t.title}
                </span>
                <button
                  onClick={() => removeTask(t.id)}
                  aria-label="Delete"
                  className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                >
                  <Trash className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Beyond today — goals */}
      <div className="mt-6">
        <h2 className="mb-3 px-1 text-lg font-semibold text-heading">Beyond today</h2>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addGoal();
          }}
        >
          <input
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
            placeholder="A goal you're working toward…"
            className="flex-1 rounded-2xl border border-input bg-card px-4 py-3 text-[15px] outline-none focus:border-ring"
          />
          <Button type="submit" size="icon" aria-label="Add goal">
            <Plus className="h-5 w-5" />
          </Button>
        </form>

        <div className="mt-4 space-y-4">
          {goals.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              onAddStepToToday={(title) => addTask(title, g.id)}
              onUpdate={(updated) =>
                setGoals((prev) =>
                  prev.map((x) => (x.id === g.id ? updated : x))
                )
              }
              onDelete={() =>
                setGoals((prev) => prev.filter((x) => x.id !== g.id))
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function GoalCard({
  goal,
  onAddStepToToday,
  onUpdate,
  onDelete,
}: {
  goal: import("@/lib/types").Goal;
  onAddStepToToday: (title: string) => void;
  onUpdate: (g: import("@/lib/types").Goal) => void;
  onDelete: () => void;
}) {
  const [stepInput, setStepInput] = useState("");
  const accent = ACCENTS.find((a) => a[0] === goal.color) ?? ACCENTS[0];

  const addStep = () => {
    const title = stepInput.trim();
    if (!title) return;
    onUpdate({
      ...goal,
      steps: [...goal.steps, { id: uid(), title, done: false }],
    });
    onAddStepToToday(title);
    setStepInput("");
  };

  return (
    <Card className="overflow-hidden">
      <div className="h-2 w-full" style={{ backgroundImage: gradient(accent) }} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[17px] font-semibold text-heading">{goal.title}</h3>
          <button
            onClick={onDelete}
            aria-label="Delete goal"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash className="h-4 w-4" />
          </button>
        </div>

        {goal.steps.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {goal.steps.map((s) => (
              <li key={s.id} className="text-[15px] text-muted-foreground">
                · {s.title}
              </li>
            ))}
          </ul>
        )}

        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addStep();
          }}
        >
          <input
            value={stepInput}
            onChange={(e) => setStepInput(e.target.value)}
            placeholder="Break it into a step for today…"
            className="flex-1 rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring"
          />
          <Button type="submit" size="sm" variant="secondary">
            Add to today
          </Button>
        </form>
      </div>
    </Card>
  );
}
