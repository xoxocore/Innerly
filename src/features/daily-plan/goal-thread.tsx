"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  Reorder,
  useDragControls,
} from "framer-motion";
import {
  ArrowDownToLine,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  GripVertical,
  Plus,
  Trash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  GOAL_COLORS,
  HORIZONS,
  goalColor,
  type Goal,
  type Horizon,
  type SubGoal,
} from "@/lib/types";
import {
  activeSubs,
  completeStep,
  completeSub,
  editSteps,
  moveSub,
  stepProgress,
  winsToday,
} from "@/lib/cascade";
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
  const color = goalColor(goal.color);

  const setHorizon = (h: Horizon, subs: SubGoal[]) =>
    onUpdate({ ...goal, horizons: { ...goal.horizons, [h]: subs } });

  const addSub = (h: Horizon) =>
    setHorizon(h, [...goal.horizons[h], { id: uid(), title: "", done: false }]);

  const updateSub = (h: Horizon, id: string, patch: Partial<SubGoal>) =>
    setHorizon(
      h,
      goal.horizons[h].map((s) => (s.id === id ? { ...s, ...patch } : s))
    );

  /** Today hides what is finished; every other tier shows its whole queue. */
  const visible = (h: Horizon) =>
    h === "today" ? goal.horizons.today.filter((s) => !s.done) : goal.horizons[h];

  const onComplete = (h: Horizon, id: string) =>
    onUpdate(completeSub(goal, h, id));

  const onMoveToToday = (from: Horizon, id: string) =>
    onUpdate(moveSub(goal, from, "today", id));

  const onStep = (h: Horizon, subId: string, stepId: string) =>
    onUpdate(completeStep(goal, h, subId, stepId));

  const onAddStep = (h: Horizon, subId: string) =>
    onUpdate(
      editSteps(goal, h, subId, (steps) => [
        ...steps,
        { id: uid(), title: "", done: false },
      ])
    );

  const onStepTitle = (h: Horizon, subId: string, stepId: string, title: string) =>
    onUpdate(
      editSteps(goal, h, subId, (steps) =>
        steps.map((t) => (t.id === stepId ? { ...t, title } : t))
      )
    );

  const onDropStep = (h: Horizon, subId: string, stepId: string) =>
    onUpdate(
      editSteps(goal, h, subId, (steps) => steps.filter((t) => t.id !== stepId))
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

                {/* Today keeps only what is still to do; the day's finished
                    work steps aside into the drawer below rather than sitting
                    on a working list with a line through it. */}
                <Reorder.Group
                  axis="y"
                  values={visible(key)}
                  onReorder={(next) =>
                    setHorizon(key, [
                      ...(next as SubGoal[]),
                      ...goal.horizons[key].filter((s) => !visible(key).includes(s)),
                    ])
                  }
                  className="mt-2 space-y-0.5"
                >
                  <AnimatePresence initial={false}>
                    {visible(key).map((sub) => (
                      <SubGoalRow
                        key={sub.id}
                        sub={sub}
                        dot={color.dot}
                        onToggle={() => onComplete(key, sub.id)}
                        onChange={(title) => updateSub(key, sub.id, { title })}
                        onRemove={() => removeSub(key, sub.id)}
                        onMoveToToday={
                          key === "today" ? undefined : () => onMoveToToday(key, sub.id)
                        }
                        onStep={(stepId) => onStep(key, sub.id, stepId)}
                        onAddStep={() => onAddStep(key, sub.id)}
                        onStepTitle={(stepId, title) =>
                          onStepTitle(key, sub.id, stepId, title)
                        }
                        onDropStep={(stepId) => onDropStep(key, sub.id, stepId)}
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

                {/* The steps of whatever weekly or monthly goal is being
                    worked on. They are shown here and ticked here, but they
                    belong to the goal named beside them and are still counted
                    there — which is why that goal has not moved. */}
                {key === "today" &&
                  activeSubs(goal).map(({ sub: parent, horizon }) => (
                    <div key={parent.id} className="mt-1.5">
                      {(parent.steps ?? [])
                        .filter((step) => !step.done)
                        .map((step) => (
                          <div
                            key={step.id}
                            className="group flex items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-accent/40"
                          >
                            <button
                              onClick={() => onStep(horizon, parent.id, step.id)}
                              aria-label={`Mark "${step.title}" complete`}
                              className="grid h-[17px] w-[17px] shrink-0 place-items-center rounded-full border-[1.5px] transition-colors"
                              style={{ borderColor: color.dot }}
                            />
                            <span className="min-w-0 flex-1 truncate text-[13px] leading-snug">
                              {step.title}
                            </span>
                            <span
                              className="shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.08em]"
                              style={{ backgroundColor: color.soft, color: color.ink }}
                              title={`Part of "${parent.title}" in ${shortLabel(horizon)}`}
                            >
                              {parent.title}
                            </span>
                          </div>
                        ))}
                    </div>
                  ))}

                {key === "today" && (
                  <CompletedWins
                    wins={winsToday(goal)}
                    onUndo={(id) => onComplete("today", id)}
                  />
                )}
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
/**
 * A quiet note on a sub-action about how it came to be here.
 *
 * Both things it says are true and neither is a reproach: something carried
 * from yesterday is not a failure, and something the cascade dropped down is
 * not something the person forgot they wrote.
 */
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </span>
  );
}

function shortLabel(h: Horizon): string {
  return HORIZONS.find((x) => x.key === h)?.label ?? h;
}

/**
 * The day's finished work, folded away.
 *
 * Out of the working list, because a list of things to do should be things
 * left to do — but not deleted, because seeing what a day actually came to is
 * most of the reason for keeping one. Shut by default; a day's wins are a
 * thing to look at on purpose, not a thing to scroll past.
 */
function CompletedWins({
  wins,
  onUndo,
}: {
  wins: SubGoal[];
  onUndo: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (wins.length === 0) return null;

  return (
    <div className="mt-2 border-t border-dashed border-border/70 pt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <CheckCircle2 className="h-3.5 w-3.5 text-[var(--brand-green-ink)]" />
        Completed wins ({wins.length})
        <ChevronDown
          className={cn("h-3 w-3 transition-transform", open && "rotate-180")}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {wins.map((w) => (
              <li key={w.id} className="flex items-center gap-2 px-2 py-1">
                <button
                  onClick={() => onUndo(w.id)}
                  aria-label={`Put "${w.title}" back on today's list`}
                  className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[var(--brand-green-strong)]"
                >
                  <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} />
                </button>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted-foreground line-through">
                  {w.title}
                </span>
                {w.completedAt && (
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70">
                    {new Date(w.completedAt).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

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
  dot,
  onToggle,
  onChange,
  onRemove,
  onMoveToToday,
  onStep,
  onAddStep,
  onStepTitle,
  onDropStep,
}: {
  sub: SubGoal;
  dot: string;
  onToggle: () => void;
  onChange: (title: string) => void;
  onRemove: () => void;
  /** Absent on Today itself, which is as far down as anything goes. */
  onMoveToToday?: () => void;
  onStep: (stepId: string) => void;
  onAddStep: () => void;
  onStepTitle: (stepId: string, title: string) => void;
  onDropStep: (stepId: string) => void;
}) {
  const controls = useDragControls();
  const progress = stepProgress(sub);

  return (
    <Reorder.Item
      value={sub}
      dragListener={false}
      dragControls={controls}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      className="group rounded-lg px-1.5 py-1 transition-colors hover:bg-accent/40"
    >
      <div className="flex items-center gap-1.5">
      <button
        onPointerDown={(e) => controls.start(e)}
        aria-label="Drag to reorder"
        className="cursor-grab touch-none text-muted-foreground/40 transition-colors hover:text-muted-foreground active:cursor-grabbing"
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

      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <input
          value={sub.title}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write what you'll achieve…"
          className={cn(
            "min-w-0 flex-1 bg-transparent text-[13px] leading-snug outline-none placeholder:text-muted-foreground/50",
            sub.done && "text-muted-foreground line-through"
          )}
        />
        {progress && (
          <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[9.5px] font-semibold tabular-nums text-muted-foreground">
            {progress.done}/{progress.total}
          </span>
        )}
        {sub.rolledOver && !sub.done && <Badge>Rolled over</Badge>}
        {sub.promotedFrom && !sub.done && (
          <Badge>From {shortLabel(sub.promotedFrom)}</Badge>
        )}
      </span>

      {onMoveToToday && !sub.done && (
        <button
          onClick={onMoveToToday}
          aria-label={`Move "${sub.title || "this"}" to Today`}
          title="Move to Today"
          className="shrink-0 text-muted-foreground/50 transition-colors hover:text-foreground"
        >
          <ArrowDownToLine className="h-3.5 w-3.5" />
        </button>
      )}

      <button
        onClick={onRemove}
        aria-label="Remove"
        className="text-muted-foreground/50 transition-colors hover:text-foreground"
      >
        <Trash className="h-3.5 w-3.5" />
      </button>
      </div>

      {/* The steps, joined to their heading by a rule in the goal's own colour.
          That line is the whole of the link: it says these belong to the thing
          above them, and it travels with the sub-goal when the cascade carries
          it down to another horizon. */}
      {(
        <div
          className="ml-[13px] border-l pl-3"
          style={{ borderColor: dot, opacity: 0.5 }}
        >
          <div style={{ opacity: 1 / 0.5 }}>
            {sub.steps?.map((step) => (
              <div key={step.id} className="group/step flex items-center gap-2 py-[3px]">
                <button
                  onClick={() => onStep(step.id)}
                  aria-label={step.done ? "Mark step incomplete" : "Mark step complete"}
                  className="grid h-[13px] w-[13px] shrink-0 place-items-center rounded-[4px] border transition-colors"
                  style={{
                    borderColor: dot,
                    backgroundColor: step.done ? dot : "transparent",
                  }}
                >
                  {step.done && (
                    <Check className="h-2 w-2 text-white" strokeWidth={4} />
                  )}
                </button>
                <input
                  value={step.title}
                  onChange={(e) => onStepTitle(step.id, e.target.value)}
                  placeholder="A smaller piece of it…"
                  className={cn(
                    "min-w-0 flex-1 bg-transparent text-[12px] leading-snug outline-none placeholder:text-muted-foreground/50",
                    step.done && "text-muted-foreground line-through"
                  )}
                />
                <button
                  onClick={() => onDropStep(step.id)}
                  aria-label="Remove step"
                  className="shrink-0 text-muted-foreground/40 transition-colors hover:text-foreground"
                >
                  <Trash className="h-3 w-3" />
                </button>
              </div>
            ))}

            <button
              onClick={onAddStep}
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Plus className="h-3 w-3" /> Add step
            </button>
          </div>
        </div>
      )}
    </Reorder.Item>
  );
}
