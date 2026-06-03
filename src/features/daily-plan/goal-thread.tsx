"use client";

import { useState } from "react";
import {
  motion,
  AnimatePresence,
  Reorder,
  useDragControls,
} from "framer-motion";
import { ArrowLeft, Trash, Plus, Check, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  HORIZONS,
  goalColor,
  type Goal,
  type Horizon,
  type SubGoal,
} from "@/lib/types";
import { useApp } from "@/state/app-context";
import { uid } from "@/state/use-data";

export function GoalThread({
  goal,
  onBack,
  onUpdate,
  onDelete,
}: {
  goal: Goal;
  onBack: () => void;
  onUpdate: (g: Goal) => void;
  onDelete: () => void;
}) {
  const { night } = useApp();
  const color = goalColor(goal.color);
  const soft = night ? color.softDark : color.soft;

  const setHorizon = (h: Horizon, subs: SubGoal[]) =>
    onUpdate({ ...goal, horizons: { ...goal.horizons, [h]: subs } });

  const addSub = (h: Horizon) =>
    setHorizon(h, [...goal.horizons[h], { id: uid(), title: "", done: false }]);

  const updateSub = (h: Horizon, id: string, patch: Partial<SubGoal>) =>
    setHorizon(
      h,
      goal.horizons[h].map((s) => (s.id === id ? { ...s, ...patch } : s))
    );

  const removeSub = (h: Horizon, id: string) =>
    setHorizon(
      h,
      goal.horizons[h].filter((s) => s.id !== id)
    );

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All goals
      </button>

      {/* Goal header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-1 items-center gap-3">
          <span
            className="h-3.5 w-3.5 shrink-0 rounded-full"
            style={{ backgroundColor: color.dot }}
          />
          <input
            value={goal.title}
            onChange={(e) => onUpdate({ ...goal, title: e.target.value })}
            placeholder="Name your goal"
            className="w-full bg-transparent text-[2rem] font-bold leading-tight tracking-tight text-heading outline-none placeholder:text-muted-foreground/50"
          />
        </div>
        <button
          onClick={onDelete}
          aria-label="Delete goal"
          className="mt-2 text-muted-foreground transition-colors hover:text-destructive"
        >
          <Trash className="h-5 w-5" />
        </button>
      </div>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
        Your year, broken down until it&apos;s something you can do today. Tick each
        as you go.
      </p>

      {/* Timeline */}
      <div className="relative mt-8 pl-8">
        {/* vertical line */}
        <span
          className="absolute bottom-3 left-[6px] top-3 w-px"
          style={{ backgroundColor: color.dot, opacity: 0.35 }}
        />
        <div className="space-y-4">
          {HORIZONS.map(({ key, label, addLabel }) => (
            <div key={key} className="relative">
              {/* node */}
              <span
                className="absolute -left-[26px] top-5 h-3 w-3 rounded-full ring-4 ring-background"
                style={{ backgroundColor: color.dot }}
              />
              <motion.div
                layout
                className="rounded-3xl border border-border bg-card p-5"
              >
                <p
                  className="text-xs font-semibold uppercase tracking-[0.18em]"
                  style={{ color: color.dot }}
                >
                  {label}
                </p>

                <Reorder.Group
                  axis="y"
                  values={goal.horizons[key]}
                  onReorder={(next) => setHorizon(key, next as SubGoal[])}
                  className="mt-3 space-y-1"
                >
                  <AnimatePresence initial={false}>
                    {goal.horizons[key].map((sub) => (
                      <SubGoalRow
                        key={sub.id}
                        sub={sub}
                        soft={soft}
                        dot={color.dot}
                        onToggle={() =>
                          updateSub(key, sub.id, { done: !sub.done })
                        }
                        onChange={(title) => updateSub(key, sub.id, { title })}
                        onRemove={() => removeSub(key, sub.id)}
                      />
                    ))}
                  </AnimatePresence>
                </Reorder.Group>

                <button
                  onClick={() => addSub(key)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Plus className="h-4 w-4" /> {addLabel}
                </button>
              </motion.div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SubGoalRow({
  sub,
  soft,
  dot,
  onToggle,
  onChange,
  onRemove,
}: {
  sub: SubGoal;
  soft: string;
  dot: string;
  onToggle: () => void;
  onChange: (title: string) => void;
  onRemove: () => void;
}) {
  const controls = useDragControls();
  const [hover, setHover] = useState(false);

  return (
    <Reorder.Item
      value={sub}
      dragListener={false}
      dragControls={controls}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="group flex items-center gap-2 rounded-2xl px-2 py-1.5"
      style={{ backgroundColor: hover ? soft : "transparent" }}
    >
      <button
        onPointerDown={(e) => controls.start(e)}
        aria-label="Drag to reorder"
        className="cursor-grab touch-none text-muted-foreground/50 transition-opacity hover:text-muted-foreground active:cursor-grabbing"
        style={{ opacity: hover ? 1 : 0.25 }}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <button
        onClick={onToggle}
        aria-label={sub.done ? "Mark incomplete" : "Mark complete"}
        className="grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors"
        style={{
          borderColor: dot,
          backgroundColor: sub.done ? dot : "transparent",
        }}
      >
        {sub.done && <Check className="h-3 w-3 text-white" />}
      </button>

      <input
        value={sub.title}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write what you'll achieve…"
        className={cn(
          "flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/50",
          sub.done && "text-muted-foreground line-through"
        )}
      />

      <button
        onClick={onRemove}
        aria-label="Remove"
        className="text-muted-foreground transition-opacity hover:text-destructive"
        style={{ opacity: hover ? 1 : 0 }}
      >
        <Trash className="h-4 w-4" />
      </button>
    </Reorder.Item>
  );
}
