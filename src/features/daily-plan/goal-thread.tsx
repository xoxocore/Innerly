"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  Reorder,
  useDragControls,
} from "framer-motion";
import { ArrowLeft, Trash, Plus, Check, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  GOAL_COLORS,
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
    // The same narrow column the Reflect screen is written in. A goal is a list
    // of short lines, and run to the full width of the page each one sits alone
    // in a lot of empty card.
    <div className="mx-auto w-full max-w-[600px]">
      <button
        onClick={onBack}
        className="mb-5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All goals
      </button>

      {/* Goal header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <ColorPicker
            value={goal.color}
            onPick={(c) => onUpdate({ ...goal, color: c })}
          />
          <input
            value={goal.title}
            onChange={(e) => onUpdate({ ...goal, title: e.target.value })}
            placeholder="Name your goal"
            className="min-w-0 flex-1 bg-transparent text-[1.35rem] font-normal leading-[1.15] tracking-tight text-heading outline-none placeholder:text-muted-foreground/50 sm:text-[1.5rem]"
          />
        </div>
        <button
          onClick={onDelete}
          aria-label="Delete goal"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Trash className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1.5 max-w-xl text-[12.5px] leading-relaxed text-muted-foreground">
        Your year, broken down until it&apos;s something you can do today. Tick each
        as you go.
      </p>

      {/* Timeline */}
      <div className="relative mt-6 pl-6">
        {/* vertical line */}
        <span
          className="absolute bottom-3 left-[4px] top-3 w-px"
          style={{ backgroundColor: color.dot, opacity: 0.35 }}
        />
        <div className="space-y-2.5">
          {HORIZONS.map(({ key, label, addLabel }) => (
            <div key={key} className="relative">
              {/* node */}
              <span
                className="absolute -left-[20px] top-[15px] h-2 w-2 rounded-full ring-[3px] ring-background"
                style={{ backgroundColor: color.dot }}
              />
              <motion.div
                layout
                className="rounded-3xl border border-border/60 bg-card px-3.5 py-3"
              >
                <p
                  className="text-[10px] font-medium uppercase tracking-[0.18em]"
                  style={{ color: color.ink }}
                >
                  {label}
                </p>

                <Reorder.Group
                  axis="y"
                  values={goal.horizons[key]}
                  onReorder={(next) => setHorizon(key, next as SubGoal[])}
                  className="mt-2 space-y-0.5"
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
                  className="mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" /> {addLabel}
                </button>
              </motion.div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * The goal's colour, on the dot that already shows it.
 *
 * Colours are handed out by position when a goal is made, so the first thing
 * somebody wants to do with one is change it — and the dot beside the title is
 * where they look for that, not a settings screen. Picking one closes the row
 * again, because this is a decision, not a panel.
 */
function ColorPicker({
  value,
  onPick,
}: {
  value: string;
  onPick: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const current = goalColor(value);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <div ref={box} className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Change colour"
        aria-expanded={open}
        className="grid h-7 w-7 place-items-center rounded-full transition-colors hover:bg-accent"
      >
        <span
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: current.dot }}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Goal colour"
          className="absolute left-0 top-8 z-20 flex gap-1 rounded-full border border-border bg-card p-1.5 shadow-lg"
        >
          {GOAL_COLORS.map((c) => (
            <button
              key={c.key}
              role="option"
              aria-selected={c.key === value}
              aria-label={c.key}
              onClick={() => {
                onPick(c.key);
                setOpen(false);
              }}
              className="grid h-6 w-6 place-items-center rounded-full transition-transform hover:scale-110"
            >
              <span
                className="h-3.5 w-3.5 rounded-full"
                style={{
                  backgroundColor: c.dot,
                  boxShadow:
                    c.key === value
                      ? `0 0 0 2px var(--card), 0 0 0 3.5px ${c.dot}`
                      : undefined,
                }}
              />
            </button>
          ))}
        </div>
      )}
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
      className="group flex items-center gap-1.5 rounded-lg px-1.5 py-1"
      style={{ backgroundColor: hover ? soft : "transparent" }}
    >
      <button
        onPointerDown={(e) => controls.start(e)}
        aria-label="Drag to reorder"
        className="cursor-grab touch-none text-muted-foreground/50 transition-opacity hover:text-muted-foreground active:cursor-grabbing"
        style={{ opacity: hover ? 1 : 0.25 }}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <button
        onClick={onToggle}
        aria-label={sub.done ? "Mark incomplete" : "Mark complete"}
        className="grid h-[17px] w-[17px] shrink-0 place-items-center rounded-full border-[1.5px] transition-colors"
        style={{
          borderColor: dot,
          backgroundColor: sub.done ? dot : "transparent",
        }}
      >
        {sub.done && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} />}
      </button>

      <input
        value={sub.title}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write what you'll achieve…"
        className={cn(
          "min-w-0 flex-1 bg-transparent text-[13px] leading-snug outline-none placeholder:text-muted-foreground/50",
          sub.done && "text-muted-foreground line-through"
        )}
      />

      <button
        onClick={onRemove}
        aria-label="Remove"
        className="text-muted-foreground transition-opacity hover:text-foreground"
        style={{ opacity: hover ? 1 : 0 }}
      >
        <Trash className="h-3.5 w-3.5" />
      </button>
    </Reorder.Item>
  );
}
