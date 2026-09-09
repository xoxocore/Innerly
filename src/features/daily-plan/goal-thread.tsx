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
  CornerDownLeft,
  Flag,
  GripVertical,
  Plus,
  Tag,
  Trash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  GOAL_COLORS,
  HORIZONS,
  goalColor,
  type Goal,
  type GoalColor,
  type Horizon,
  type Step,
  type SubGoal,
} from "@/lib/types";
import {
  DAILY_CAP,
  VAGUE_HINT,
  borrowedAt,
  completeStep,
  completeSub,
  editSteps,
  isOn,
  isVague,
  nearer,
  picksOf,
  pullStep,
  pushStep,
  putBack,
  stepAt,
  stepProgress,
  takeIntoToday,
  winsToday,
} from "@/lib/cascade";
import { uid } from "@/state/use-data";

/**
 * One goal, from a year away down to this afternoon.
 *
 * The screen is built the way the method is: the ladder is written top-down,
 * furthest out first, each rung answering the rung above it — and then the work
 * comes back up the other way, one deliberate handful at a time. Today is the
 * only tier nothing arrives in on its own.
 */
export function GoalThread({
  goal,
  dayLoad,
  onBack,
  onUpdate,
  onPrimary,
  onDelete,
}: {
  goal: Goal;
  /** How many things the whole day is already holding, across every goal. */
  dayLoad: number;
  onBack: () => void;
  onUpdate: (g: Goal) => void;
  /** Rule A lives across goals, so naming the day's one thing goes upwards. */
  onPrimary: (subId: string) => void;
  onDelete: () => void;
}) {
  const color = goalColor(goal.color);
  const full = dayLoad >= DAILY_CAP;

  // Which tier the pointer is dragging a row over, so Today can light up as a
  // place to drop it. Null the rest of the time.
  const [overToday, setOverToday] = useState(false);
  const todayBox = useRef<HTMLDivElement>(null);

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

  const onComplete = (h: Horizon, id: string) => onUpdate(completeSub(goal, h, id));

  const onTake = (from: Horizon, id: string) => {
    if (full) return;
    onUpdate(takeIntoToday(goal, from, id));
  };

  const onPutBack = (h: Horizon, id: string) => onUpdate(putBack(goal, h, id));

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

  /* Pushing one action a tier closer. Today is the only tier with a cap on it,
     so that is the only push that can be refused. */
  const onPushStep = (h: Horizon, subId: string, stepId: string) => {
    const step = goal.horizons[h].find((s) => s.id === subId)?.steps
      ?.find((t) => t.id === stepId);
    if (!step) return;
    if (nearer(stepAt(step, h)) === "today" && full) return;
    onUpdate(pushStep(goal, h, subId, stepId));
  };

  const onPullStep = (h: Horizon, subId: string, stepId: string) =>
    onUpdate(pullStep(goal, h, subId, stepId));

  const removeSub = (h: Horizon, id: string) =>
    setHorizon(
      h,
      goal.horizons[h].filter((s) => s.id !== id)
    );

  /* Dragging a row down onto the Today card is the second way to pick, and the
     one people reach for first — the gesture already says "this, now". It is
     hit-tested against the card's own rectangle rather than framer's reorder
     logic, because the row is being taken out of its list, not sorted in it. */
  const dragOver = (y: number) => {
    const box = todayBox.current?.getBoundingClientRect();
    setOverToday(!!box && y >= box.top && y <= box.bottom);
  };

  const dragEnd = (from: Horizon, id: string) => {
    if (overToday) onTake(from, id);
    setOverToday(false);
  };

  const picks = picksOf(goal);

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
        Plan backwards, from the year down to the week. Work forwards, from today
        up. Nothing reaches Today unless you put it there.
      </p>

      {/* Timeline */}
      <div className="relative mt-6 pl-6">
        {/* vertical line */}
        <span
          className="absolute bottom-3 left-[4px] top-3 w-px"
          style={{ backgroundColor: color.dot, opacity: 0.35 }}
        />
        <div className="space-y-2.5">
          {HORIZONS.map(({ key, label, addLabel, prompt }) => {
            const today = key === "today";
            return (
              <div key={key} className="relative">
                {/* node */}
                <span
                  className="absolute -left-[20px] top-[15px] h-2 w-2 rounded-full ring-[3px] ring-background"
                  style={{ backgroundColor: color.dot }}
                />
                <motion.div
                  layout
                  ref={today ? todayBox : undefined}
                  data-tier={key}
                  className={cn(
                    "rounded-3xl border bg-card px-3.5 py-3 transition-colors",
                    today && overToday && !full
                      ? "border-transparent"
                      : "border-border/60"
                  )}
                  style={
                    today && overToday && !full
                      ? { boxShadow: `0 0 0 2px ${color.dot}` }
                      : undefined
                  }
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className="text-[10px] font-medium uppercase tracking-[0.18em]"
                      style={{ color: color.ink }}
                    >
                      {label}
                    </p>
                    {today && <DayCount load={dayLoad} color={color} />}
                  </div>

                  {/* Rule A, asked rather than answered. It appears only on an
                      empty day, which is the one moment it is a question and
                      not a scold. */}
                  {today && picks.length === 0 && (
                    <p className="mt-2 rounded-xl bg-secondary/60 px-2.5 py-2 text-[12px] leading-relaxed text-muted-foreground">
                      Nothing picked yet. Read your Weekly Goal and ask: which
                      one thing today makes the rest easier — or unnecessary?
                    </p>
                  )}

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
                          color={color}
                          prompt={prompt}
                          dayFull={full}
                          onToggle={() => onComplete(key, sub.id)}
                          onChange={(title) => updateSub(key, sub.id, { title })}
                          onRemove={() => removeSub(key, sub.id)}
                          onTake={today ? undefined : () => onTake(key, sub.id)}
                          onPutBack={
                            today && sub.promotedFrom
                              ? () => onPutBack(key, sub.id)
                              : undefined
                          }
                          onPrimary={today ? () => onPrimary(sub.id) : undefined}
                          onDragMove={today ? undefined : dragOver}
                          onDragDone={today ? undefined : () => dragEnd(key, sub.id)}
                          onStep={(stepId) => onStep(key, sub.id, stepId)}
                          onAddStep={() => onAddStep(key, sub.id)}
                          onStepTitle={(stepId, title) =>
                            onStepTitle(key, sub.id, stepId, title)
                          }
                          onDropStep={(stepId) => onDropStep(key, sub.id, stepId)}
                          onPushStep={(stepId) => onPushStep(key, sub.id, stepId)}
                          horizon={key}
                          dayFullForSteps={full}
                          // Today is where things get done, not where they get
                          // broken down: an action decomposed on the day it is
                          // due is a target that was planned too late. It is
                          // broken down where the target lives.
                          allowSteps={!today}
                        />
                      ))}
                    </AnimatePresence>
                  </Reorder.Group>

                  {/* Actions pushed down into this tier from a target written
                      further out. They are shown here and ticked here, but they
                      belong to the target named beside them and are still
                      counted there — which is why that target has not moved. */}
                  {borrowedAt(goal, key).map(({ step, parent, parentHorizon }) => (
                    <BorrowedRow
                      key={step.id}
                      step={step}
                      parent={parent}
                      parentHorizon={parentHorizon}
                      color={color}
                      onStep={() => onStep(parentHorizon, parent.id, step.id)}
                      onPush={
                        nearer(key) && !(nearer(key) === "today" && full)
                          ? () => onPushStep(parentHorizon, parent.id, step.id)
                          : undefined
                      }
                      onPull={() => onPullStep(parentHorizon, parent.id, step.id)}
                      onPrimary={today ? () => onPrimary(parent.id) : undefined}
                      primary={today ? !!parent.primary : false}
                    />
                  ))}

                  <AddRow
                    label={addLabel}
                    disabled={today && full}
                    note={
                      today && full
                        ? `That's ${DAILY_CAP}. Finish one, or put one back.`
                        : undefined
                    }
                    onClick={() => addSub(key)}
                  />

                  {today && (
                    <CompletedWins
                      wins={winsToday(goal)}
                      onUndo={(id) => onComplete("today", id)}
                    />
                  )}
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ parts */

/**
 * How full the day is — Rule B, shown as a fact rather than a warning.
 *
 * It counts every goal, not this one, because the cap belongs to the person and
 * not to any single plan of theirs. Three small goals asking for two things each
 * is a six-thing day however tidily it is filed.
 */
function DayCount({ load, color }: { load: number; color: GoalColor }) {
  const full = load >= DAILY_CAP;
  return (
    <span
      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums"
      style={{
        backgroundColor: full ? color.soft : "var(--secondary)",
        color: full ? color.ink : "var(--muted-foreground)",
      }}
      title={`Across every goal. ${DAILY_CAP} is a full day.`}
    >
      {load} / {DAILY_CAP}
    </span>
  );
}

function AddRow({
  label,
  disabled,
  note,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  note?: string;
  onClick: () => void;
}) {
  return (
    <div className="mt-1.5">
      <button
        onClick={onClick}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" /> {label}
      </button>
      {note && (
        <p className="mt-0.5 px-2 text-[11.5px] leading-relaxed text-muted-foreground">
          {note}
        </p>
      )}
    </div>
  );
}

/**
 * A quiet note on a sub-action about how it came to be here.
 *
 * Both things it says are true and neither is a reproach: something carried
 * from yesterday is not a failure, and something taken down from the month is
 * not something the person forgot they wrote.
 */
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </span>
  );
}

/**
 * What this piece of today is in service of.
 *
 * A day's list read on its own is a list of errands. The tag is the sentence
 * that makes it a plan — it names the tier or the weekly goal the action was
 * drawn from, so the reason for doing it is on the same line as the doing.
 */
function ParentTag({
  children,
  color,
  title,
}: {
  children: React.ReactNode;
  color: GoalColor;
  title?: string;
}) {
  return (
    <span
      className="inline-flex max-w-[45%] shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.08em]"
      style={{ backgroundColor: color.soft, color: color.ink }}
      title={title}
    >
      <Tag className="h-2.5 w-2.5 shrink-0" />
      <span className="truncate">{children}</span>
    </span>
  );
}

function shortLabel(h: Horizon): string {
  return HORIZONS.find((x) => x.key === h)?.label ?? h;
}

/** Rule A's mark: one flag, on the thing the rest of the day depends on. */
function PrimaryFlag({
  on,
  color,
  onClick,
}: {
  on: boolean;
  color: GoalColor;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      aria-label={on ? "Not the main thing today" : "Make this the main thing today"}
      title={
        on
          ? "Today's one thing"
          : "Mark this as the one thing that makes the rest easier"
      }
      className="shrink-0 transition-colors"
      style={{ color: on ? color.dot : "var(--muted-foreground)", opacity: on ? 1 : 0.4 }}
    >
      <Flag className="h-3.5 w-3.5" fill={on ? color.dot : "none"} />
    </button>
  );
}

/**
 * One action, sitting in a tier nearer than the target that owns it.
 *
 * It is ticked here but it does not live here: the target is still in its own
 * month with its count climbing, which is what the tag beside the action says.
 * The tag is the whole point — a nearer tier full of untagged fragments is a
 * list of errands, and the same list tagged is a plan being executed.
 */
function BorrowedRow({
  step,
  parent,
  parentHorizon,
  color,
  primary,
  onStep,
  onPush,
  onPull,
  onPrimary,
}: {
  step: Step;
  parent: SubGoal;
  parentHorizon: Horizon;
  color: GoalColor;
  primary: boolean;
  onStep: () => void;
  /** Absent at Today, and while the day is full. */
  onPush?: () => void;
  onPull: () => void;
  /** Only on Today: Rule A is about the day. */
  onPrimary?: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-accent/40">
      {onPrimary ? (
        <PrimaryFlag on={primary} color={color} onClick={onPrimary} />
      ) : (
        <span className="h-3.5 w-3.5 shrink-0" aria-hidden />
      )}
      <button
        onClick={onStep}
        aria-label={`Mark "${step.title}" complete`}
        className="grid h-[17px] w-[17px] shrink-0 place-items-center rounded-full border-[1.5px] transition-colors"
        style={{ borderColor: color.dot }}
      />
      <span className="min-w-0 flex-1 break-words text-[13px] leading-snug">
        {step.title}
      </span>
      <ParentTag
        color={color}
        title={`An action of "${parent.title}", which is in ${shortLabel(parentHorizon)}`}
      >
        {parent.title || shortLabel(parentHorizon)}
      </ParentTag>
      {onPush && (
        <button
          onClick={onPush}
          aria-label={`Push "${step.title}" closer`}
          title="Push a tier closer"
          className="shrink-0 text-muted-foreground/50 transition-colors hover:text-foreground"
        >
          <ArrowDownToLine className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        onClick={onPull}
        aria-label={`Send "${step.title}" back to "${parent.title}"`}
        title={`Send back to ${shortLabel(parentHorizon)}`}
        className="shrink-0 text-muted-foreground/50 transition-colors hover:text-foreground"
      >
        <CornerDownLeft className="h-3.5 w-3.5" />
      </button>
    </div>
  );
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
  color,
  prompt,
  dayFull,
  onToggle,
  onChange,
  onRemove,
  onTake,
  onPutBack,
  onPrimary,
  onDragMove,
  onDragDone,
  onStep,
  onAddStep,
  onStepTitle,
  onDropStep,
  onPushStep,
  horizon,
  dayFullForSteps,
  allowSteps,
}: {
  sub: SubGoal;
  color: GoalColor;
  prompt: string;
  dayFull: boolean;
  onToggle: () => void;
  onChange: (title: string) => void;
  onRemove: () => void;
  /** Absent on Today itself, which is as far down as anything goes. */
  onTake?: () => void;
  /** Only on something that was taken down and can go home again. */
  onPutBack?: () => void;
  /** Only on Today: Rule A is about the day. */
  onPrimary?: () => void;
  onDragMove?: (y: number) => void;
  onDragDone?: () => void;
  onStep: (stepId: string) => void;
  onAddStep: () => void;
  onStepTitle: (stepId: string, title: string) => void;
  onDropStep: (stepId: string) => void;
  /** Schedule one action a tier closer, leaving this target where it is. */
  onPushStep: (stepId: string) => void;
  /** Where this target is written — what "a tier closer" is measured from. */
  horizon: Horizon;
  dayFullForSteps: boolean;
  /** False on Today, which holds actions rather than plans for them. */
  allowSteps: boolean;
}) {
  const controls = useDragControls();
  const progress = stepProgress(sub);
  // "On today" is not a flag any more: it is simply true when one of this
  // target's open actions is scheduled there.
  const onToday = isOn(sub, "today");
  const [touched, setTouched] = useState(false);
  // Rule C, and only ever as advice: it waits until the field has been left, so
  // it cannot sit there correcting a half-typed word.
  const vague = touched && !sub.done && isVague(sub.title);

  return (
    <Reorder.Item
      value={sub}
      dragListener={false}
      dragControls={controls}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      onDrag={(e) => onDragMove?.((e as PointerEvent).clientY)}
      onDragEnd={() => onDragDone?.()}
      className="group rounded-lg px-1.5 py-1 transition-colors hover:bg-accent/40"
    >
      <div className="flex items-center gap-1.5">
        <button
          onPointerDown={(e) => controls.start(e)}
          aria-label={
            onTake ? "Drag to reorder, or down onto Today" : "Drag to reorder"
          }
          className="cursor-grab touch-none text-muted-foreground/40 transition-colors hover:text-muted-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        {onPrimary && (
          <PrimaryFlag on={!!sub.primary} color={color} onClick={onPrimary} />
        )}

        <button
          onClick={onToggle}
          aria-label={sub.done ? "Mark incomplete" : "Mark complete"}
          className="grid h-[17px] w-[17px] shrink-0 place-items-center rounded-full border-[1.5px] transition-colors"
          style={{
            borderColor: color.dot,
            backgroundColor: sub.done ? color.dot : "transparent",
          }}
        >
          {sub.done && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} />}
        </button>

        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <input
            value={sub.title}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder={prompt}
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
            <ParentTag
              color={color}
              title={`Taken down from ${shortLabel(sub.promotedFrom)}`}
            >
              {shortLabel(sub.promotedFrom)}
            </ParentTag>
          )}
        </span>

        {/* A button, and deliberately not shaped like the tags beside it: a
            filled pill in the goal's colour is what a tag looks like here, and
            two things that look the same have to mean the same. This one is
            outlined and carries the arrow, so it reads as somewhere to press
            rather than something being said. */}
        {onTake && !sub.done && (
          <button
            onClick={onTake}
            disabled={dayFull || onToday}
            aria-label={`Take "${sub.title || "this"}" into today`}
            title={
              onToday
                ? "Already on today"
                : dayFull
                  ? `Today is full — ${DAILY_CAP} is the cap`
                  : "Take into today"
            }
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-[3px] text-[10.5px] font-medium transition-colors",
              onToday
                ? "border-transparent text-muted-foreground"
                : "border-border text-muted-foreground hover:border-transparent hover:text-foreground",
              "disabled:pointer-events-none"
            )}
            style={
              onToday
                ? undefined
                : dayFull
                  ? { opacity: 0.35 }
                  : undefined
            }
          >
            {onToday ? (
              <>
                <Check className="h-3 w-3" strokeWidth={3} /> On today
              </>
            ) : (
              <>
                <ArrowDownToLine className="h-3 w-3" /> Today
              </>
            )}
          </button>
        )}

        {onPutBack && (
          <button
            onClick={onPutBack}
            aria-label={`Put "${sub.title || "this"}" back`}
            title="Not today after all"
            className="shrink-0 text-muted-foreground/50 transition-colors hover:text-foreground"
          >
            <CornerDownLeft className="h-3.5 w-3.5" />
          </button>
        )}

        <button
          onClick={onRemove}
          aria-label="Remove"
          className="shrink-0 text-muted-foreground/50 transition-colors hover:text-foreground"
        >
          <Trash className="h-3.5 w-3.5" />
        </button>
      </div>

      {vague && (
        <p className="ml-[52px] mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          {VAGUE_HINT}
        </p>
      )}

      {/* The steps, joined to their heading by a rule in the goal's own colour.
          That line is the whole of the link: it says these belong to the thing
          above them, and it travels with the sub-goal wherever it is written. */}
      {(allowSteps || (sub.steps?.length ?? 0) > 0) && (
      <div
        className="ml-[13px] border-l pl-3"
        style={{ borderColor: color.dot, opacity: 0.5 }}
      >
        <div style={{ opacity: 1 / 0.5 }}>
          {sub.steps?.map((step) => {
            const where = stepAt(step, horizon);
            const next = nearer(where);
            // The arrow is what turns a month's target into this week's work,
            // so it is on the action itself rather than on the target: the
            // target is the plan and does not move, the action is the doing.
            const canPush =
              !step.done && !!next && !(next === "today" && dayFullForSteps);
            return (
              <div key={step.id} className="flex items-center gap-2 py-[3px]">
                <button
                  onClick={() => onStep(step.id)}
                  aria-label={step.done ? "Mark step incomplete" : "Mark step complete"}
                  className="grid h-[13px] w-[13px] shrink-0 place-items-center rounded-[4px] border transition-colors"
                  style={{
                    borderColor: color.dot,
                    backgroundColor: step.done ? color.dot : "transparent",
                  }}
                >
                  {step.done && <Check className="h-2 w-2 text-white" strokeWidth={4} />}
                </button>
                <input
                  value={step.title}
                  onChange={(e) => onStepTitle(step.id, e.target.value)}
                  placeholder="An action that gets you there…"
                  className={cn(
                    "min-w-0 flex-1 bg-transparent text-[12px] leading-snug outline-none placeholder:text-muted-foreground/50",
                    step.done && "text-muted-foreground line-through"
                  )}
                />
                {/* Where it has been sent, said on the target's own list — so
                    the plan stays honest about what is already scheduled. */}
                {step.at && !step.done && (
                  <span
                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em]"
                    style={{ backgroundColor: color.soft, color: color.ink }}
                    title={`Scheduled on ${shortLabel(step.at)}`}
                  >
                    On {shortLabel(step.at)}
                  </span>
                )}
                {canPush && (
                  <button
                    onClick={() => onPushStep(step.id)}
                    aria-label={`Push "${step.title || "this action"}" to ${shortLabel(next)}`}
                    title={`Push to ${shortLabel(next)}`}
                    // A shade more present than the bin beside it: scheduling
                    // an action is the thing this row is for, deleting it is not.
                    className="shrink-0 text-muted-foreground/60 transition-colors hover:text-foreground"
                  >
                    <ArrowDownToLine className="h-3 w-3" />
                  </button>
                )}
                <button
                  onClick={() => onDropStep(step.id)}
                  aria-label="Remove step"
                  className="shrink-0 text-muted-foreground/40 transition-colors hover:text-foreground"
                >
                  <Trash className="h-3 w-3" />
                </button>
              </div>
            );
          })}

          {allowSteps && (
            <button
              onClick={onAddStep}
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Plus className="h-3 w-3" /> Add action
            </button>
          )}
        </div>
      </div>
      )}
    </Reorder.Item>
  );
}
