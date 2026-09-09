"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, Reorder, useDragControls } from "framer-motion";
import {
  ArrowDownToLine,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  CornerLeftUp,
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
  type SubGoal,
} from "@/lib/types";
import {
  DAILY_CAP,
  VAGUE_HINT,
  complete,
  editByPath,
  editParts,
  isVague,
  nearer,
  picksOf,
  pull,
  push,
  removeByPath,
  shownAt,
  stepProgress,
  winsToday,
  type Placed,
} from "@/lib/cascade";
import { uid } from "@/state/use-data";

/**
 * One goal, from a year away down to this afternoon.
 *
 * The screen is built the way the method is. The ladder is written top-down,
 * furthest out first, each rung answering the rung above it. Work then comes
 * back up the other way one rung at a time: a year's target is broken into
 * six-month parts, a part is pushed to six months where it becomes a target in
 * its own right and is broken down again, and so on down to an afternoon.
 *
 * Nothing skips a rung, and nothing arrives anywhere on its own.
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

  // The tier a dragged row is currently over, when that tier is the one rung
  // it is allowed to go to. Null the rest of the time.
  const [dropTier, setDropTier] = useState<Horizon | null>(null);
  const cards = useRef(new Map<Horizon, HTMLDivElement | null>());

  const addTop = (h: Horizon) =>
    onUpdate({
      ...goal,
      horizons: {
        ...goal.horizons,
        [h]: [...goal.horizons[h], { id: uid(), title: "", done: false }],
      },
    });

  const act = {
    toggle: (home: Horizon, path: string[]) => onUpdate(complete(goal, home, path)),
    rename: (home: Horizon, path: string[], title: string) =>
      onUpdate(editByPath(goal, home, path, (sub) => ({ ...sub, title }))),
    remove: (home: Horizon, path: string[]) =>
      onUpdate(removeByPath(goal, home, path)),
    addPart: (home: Horizon, path: string[]) =>
      onUpdate(
        editParts(goal, home, path, (steps) => [
          ...steps,
          { id: uid(), title: "", done: false },
        ])
      ),
    push: (home: Horizon, path: string[]) => onUpdate(push(goal, home, path)),
    pull: (home: Horizon, path: string[]) => onUpdate(pull(goal, home, path)),
  };

  /* A row can be dragged onto the next tier down, which is the same move its
     arrow makes — the gesture is just the one a hand reaches for first. It can
     only ever be the next tier: dropping a year's target onto Today would be
     the skipped rung the whole design is against, so no other card lights up. */
  const dragOver = (from: Horizon, y: number) => {
    const to = nearer(from);
    const box = to ? cards.current.get(to)?.getBoundingClientRect() : undefined;
    const over = !!box && y >= box.top && y <= box.bottom;
    setDropTier(over && !(to === "today" && full) ? to! : null);
  };

  const dragEnd = (home: Horizon, path: string[]) => {
    if (dropTier) act.push(home, path);
    setDropTier(null);
  };

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
        Plan backwards, a year down to a week. Work forwards, one rung at a time
        — nothing skips a tier, and nothing reaches Today unless you put it there.
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
            // Today keeps only what is still to do; the day's finished work
            // steps aside into the drawer below rather than sitting on a
            // working list with a line through it. Every other tier shows its
            // whole plan, done and not, because that is what a plan is.
            const placed = shownAt(goal, key).filter((p) => !(today && p.sub.done));
            // Written here and still here: the rows this tier owns and can
            // reorder. Everything else arrived from a target further out.
            const own = placed.filter(
              (p) => p.home === key && p.path.length === 1 && !p.sub.at
            );
            const incoming = placed.filter((p) => !own.includes(p));
            const lit = dropTier === key;

            return (
              <div key={key} className="relative">
                {/* node */}
                <span
                  className="absolute -left-[20px] top-[15px] h-2 w-2 rounded-full ring-[3px] ring-background"
                  style={{ backgroundColor: color.dot }}
                />
                <motion.div
                  layout
                  ref={(el) => {
                    cards.current.set(key, el);
                  }}
                  data-tier={key}
                  className={cn(
                    "rounded-3xl border bg-card px-3.5 py-3 transition-colors",
                    lit ? "border-transparent" : "border-border/60"
                  )}
                  style={lit ? { boxShadow: `0 0 0 2px ${color.dot}` } : undefined}
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
                  {today && picksOf(goal).length === 0 && (
                    <p className="mt-2 rounded-xl bg-secondary/60 px-2.5 py-2 text-[12px] leading-relaxed text-muted-foreground">
                      Nothing picked yet. Read your Weekly Goal and ask: which
                      one thing today makes the rest easier — or unnecessary?
                    </p>
                  )}

                  <Reorder.Group
                    axis="y"
                    values={own.map((p) => p.sub)}
                    onReorder={(next) =>
                      onUpdate({
                        ...goal,
                        horizons: {
                          ...goal.horizons,
                          [key]: [
                            ...(next as SubGoal[]),
                            ...goal.horizons[key].filter(
                              (s) => !own.some((p) => p.sub.id === s.id)
                            ),
                          ],
                        },
                      })
                    }
                    className="mt-2 space-y-0.5"
                  >
                    <AnimatePresence initial={false}>
                      {own.map((p) => (
                        <Reorder.Item
                          key={p.sub.id}
                          value={p.sub}
                          dragListener={false}
                          dragControls={undefined}
                          as="li"
                          className="list-none"
                        >
                          <PlanRow
                            placed={p}
                            color={color}
                            prompt={prompt}
                            dayFull={full}
                            reorderable
                            onDragMove={(y) => dragOver(key, y)}
                            onDragDone={() => dragEnd(p.home, p.path)}
                            onPrimary={today ? () => onPrimary(p.sub.id) : undefined}
                            act={act}
                          />
                        </Reorder.Item>
                      ))}
                    </AnimatePresence>
                  </Reorder.Group>

                  {/* Lines pushed into this tier from a target further out.
                      They are shown and ticked here, but they belong to the
                      target named beside them and are counted there — which is
                      why that target has not moved. */}
                  {incoming.map((p) => (
                    <PlanRow
                      key={p.sub.id}
                      placed={p}
                      color={color}
                      prompt={prompt}
                      dayFull={full}
                      onPrimary={today ? () => onPrimary(p.sub.id) : undefined}
                      act={act}
                    />
                  ))}

                  {addLabel ? (
                    <AddRow
                      label={addLabel}
                      disabled={today && full}
                      note={
                        today && full
                          ? `That's ${DAILY_CAP}. Finish one, or put one back.`
                          : undefined
                      }
                      onClick={() => addTop(key)}
                    />
                  ) : (
                    own.length + incoming.length === 0 && (
                      <p className="mt-2 px-1 text-[12px] leading-relaxed text-muted-foreground">
                        {prompt}. Push an action down from This Month and it
                        appears here, tagged with the target it serves.
                      </p>
                    )
                  )}

                  {today && (
                    <CompletedWins
                      wins={winsToday(goal)}
                      onUndo={(id) => {
                        const w = shownAt(goal, "today").find((x) => x.sub.id === id);
                        if (w) act.toggle(w.home, w.path);
                      }}
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

/** Everything a row needs to change the plan, without knowing where it is. */
type Actions = {
  toggle: (home: Horizon, path: string[]) => void;
  rename: (home: Horizon, path: string[], title: string) => void;
  remove: (home: Horizon, path: string[]) => void;
  addPart: (home: Horizon, path: string[]) => void;
  push: (home: Horizon, path: string[]) => void;
  pull: (home: Horizon, path: string[]) => void;
};

/**
 * One line of the plan, and the lines under it.
 *
 * The same component at every depth, because a target and an action are the
 * same thing seen from different distances: push an action down a rung and it
 * is a target there, to be broken down again. A renderer that knew the
 * difference would have to change its mind every time somebody pressed an
 * arrow.
 */
function PlanRow({
  placed,
  color,
  prompt,
  dayFull,
  depth = 0,
  reorderable = false,
  onDragMove,
  onDragDone,
  onPrimary,
  act,
}: {
  placed: Placed;
  color: GoalColor;
  prompt: string;
  dayFull: boolean;
  depth?: number;
  reorderable?: boolean;
  onDragMove?: (y: number) => void;
  onDragDone?: () => void;
  onPrimary?: () => void;
  act: Actions;
}) {
  const { sub, tier, parent, home, path } = placed;
  const controls = useDragControls();
  const progress = stepProgress(sub);
  const [touched, setTouched] = useState(false);
  // Rule C, and only ever as advice: it waits until the field has been left, so
  // it cannot sit there correcting a half-typed word.
  const vague = touched && !sub.done && isVague(sub.title);

  const next = nearer(tier);
  const canPush = !sub.done && !!next && !(next === "today" && dayFull);
  // Today holds the doing, not the planning. An action broken down on the day
  // it is due is a target that was planned too late.
  const canBreakDown = tier !== "today";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      drag={reorderable ? "y" : false}
      dragListener={false}
      dragControls={controls}
      dragSnapToOrigin
      onDrag={(e) => onDragMove?.((e as PointerEvent).clientY)}
      onDragEnd={() => onDragDone?.()}
      data-row={sub.id}
      className="rounded-lg px-1.5 py-1 transition-colors hover:bg-accent/40"
    >
      <div className="flex items-center gap-1.5">
        {reorderable && (
          <button
            onPointerDown={(e) => controls.start(e)}
            aria-label={
              next ? `Drag to reorder, or onto ${shortLabel(next)}` : "Drag to reorder"
            }
            className="cursor-grab touch-none text-muted-foreground/40 transition-colors hover:text-muted-foreground active:cursor-grabbing"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        )}

        {onPrimary && depth === 0 && (
          <PrimaryFlag on={!!sub.primary} color={color} onClick={onPrimary} />
        )}

        <button
          onClick={() => act.toggle(home, path)}
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
            onChange={(e) => act.rename(home, path, e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder={depth === 0 ? prompt : "An action that gets you there…"}
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
          {/* What this line is in service of. A tier full of untagged
              fragments is a list of errands; the same list tagged is a plan
              being executed. */}
          {parent && !sub.done && (
            <ParentTag color={color} title={`An action of "${parent.title}"`}>
              {parent.title || "its target"}
            </ParentTag>
          )}
        </span>

        {canPush && (
          <button
            onClick={() => act.push(home, path)}
            aria-label={`Push "${sub.title || "this"}" to ${shortLabel(next!)}`}
            title={`Push to ${shortLabel(next!)}`}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-[3px] text-[10.5px] font-medium text-muted-foreground transition-colors hover:border-transparent hover:text-foreground"
          >
            <ArrowDownToLine className="h-3 w-3" /> {shortLabel(next!)}
          </button>
        )}
        {!canPush && next && !sub.done && (
          <span
            className="shrink-0 rounded-full px-2 py-[3px] text-[10.5px] font-medium opacity-40"
            title={`Today is full — ${DAILY_CAP} is the cap`}
          >
            {shortLabel(next)}
          </span>
        )}

        {sub.at && (
          <button
            onClick={() => act.pull(home, path)}
            aria-label={`Send "${sub.title || "this"}" back a tier`}
            title="Send back a tier"
            className="shrink-0 text-muted-foreground/50 transition-colors hover:text-foreground"
          >
            <CornerLeftUp className="h-3.5 w-3.5" />
          </button>
        )}

        <button
          onClick={() => act.remove(home, path)}
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

      {/* The parts, joined to their heading by a rule in the goal's own colour.
          That line is the whole of the link: it says these belong to the thing
          above them, and it travels with the line wherever it is pushed. */}
      {(canBreakDown || (sub.steps?.length ?? 0) > 0) && (
        <div
          className="ml-[13px] border-l pl-3"
          style={{ borderColor: color.dot, opacity: 0.5 }}
        >
          <div style={{ opacity: 1 / 0.5 }}>
            {(sub.steps ?? []).map((child) =>
              (child.at ?? tier) === tier ? (
                <PlanRow
                  key={child.id}
                  placed={{
                    sub: child,
                    tier,
                    home,
                    path: [...path, child.id],
                  }}
                  color={color}
                  prompt={prompt}
                  dayFull={dayFull}
                  depth={depth + 1}
                  act={act}
                />
              ) : (
                <Scheduled
                  key={child.id}
                  sub={child}
                  color={color}
                  onPull={() => act.pull(home, [...path, child.id])}
                />
              )
            )}

            {canBreakDown && (
              // Named after the line it belongs to: a target and each of its
              // actions all offer this, and three buttons reading "Add action"
              // in one card say nothing about which list they add to.
              <button
                onClick={() => act.addPart(home, path)}
                aria-label={`Add an action to "${sub.title || "this line"}"`}
                className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Plus className="h-3 w-3" /> Add action
              </button>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

/**
 * A part that is out being worked on somewhere nearer.
 *
 * Shown on its target's own list, quietly, so the plan stays honest about what
 * is already scheduled — but not editable here, because the live row is the one
 * in the tier it was pushed to and two editable copies of one line is exactly
 * the confusion this design exists to avoid.
 */
function Scheduled({
  sub,
  color,
  onPull,
}: {
  sub: SubGoal;
  color: GoalColor;
  onPull: () => void;
}) {
  return (
    <div data-scheduled={sub.id} className="flex items-center gap-2 py-[3px] opacity-60">
      <span
        className="h-[13px] w-[13px] shrink-0 rounded-[4px] border"
        style={{ borderColor: color.dot }}
        aria-hidden
      />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[12px] leading-snug",
          sub.done && "line-through"
        )}
      >
        {sub.title}
      </span>
      <span
        className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em]"
        style={{ backgroundColor: color.soft, color: color.ink }}
      >
        On {shortLabel(sub.at!)}
      </span>
      <button
        onClick={onPull}
        aria-label={`Send "${sub.title}" back a tier`}
        title="Send back a tier"
        className="shrink-0 text-muted-foreground/50 transition-colors hover:text-foreground"
      >
        <CornerLeftUp className="h-3 w-3" />
      </button>
    </div>
  );
}

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
 * A quiet note about how a line came to be here.
 *
 * Something carried from yesterday is not a failure, and neither reading is a
 * reproach.
 */
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </span>
  );
}

/** What this line is in service of, named on the same row as the doing. */
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

