"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, Reorder, useDragControls } from "framer-motion";
import {
  ArrowDownToLine,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Flag,
  GripVertical,
  Plus,
  Trash,
} from "lucide-react";
import { PlanMark } from "@/components/innerly/plan-mark";
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
  placements,
  pull,
  push,
  removeByPath,
  shownAt,
  stepProgress,
  winsToday,
  type Placed,
} from "@/lib/cascade";
import { useApp } from "@/state/app-context";
import { uid } from "@/state/use-data";
import {
  Gauge,
  HEAT,
  IconPicker,
  RowMenu,
  Token,
  tint,
  type MenuItem,
} from "./thread-parts";

/**
 * One goal, from a year away down to this afternoon.
 *
 * The structure is the method: the ladder is written top-down, each rung a
 * dependency of the rung above, and work comes back up one rung at a time.
 *
 * The *drawing* of it is a separate problem, and the harder one. Six tiers of
 * nested lines is a lot of page, and the first version spent its ink evenly —
 * every row the same size in the same colour with the same seven controls, so
 * nothing told you where to look and the year shouted as loudly as this
 * afternoon. Three things fix that, and they are the whole visual idea:
 *
 *   Distance is colour. The goal's own hue comes up in strength as the ladder
 *   descends, so the page is coolest where the work is furthest away and
 *   brightest where it is due. The rail down the side is a path, lit where
 *   there is work in flight.
 *
 *   One mark per line. The tick and the emoji are the same control, because a
 *   line with parts under it cannot be ticked anyway — its ring shows how far
 *   through it is instead. The glyph is what the eye lands on.
 *
 *   One move per line. Pushing it a rung closer is the only thing a row does
 *   out loud; everything else is behind a menu that never moves or resizes.
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
  const { night } = useApp();
  const color = goalColor(goal.color);
  // `ink` is a darkened shade meant to stay readable on a pale tint; on a dark
  // one it disappears. `dot` is the shade that survives there.
  const ink = night ? color.dot : color.ink;
  const full = dayLoad >= DAILY_CAP;

  // The tier a dragged row is currently over, when that tier is the one rung
  // it is allowed to go to. Null the rest of the time.
  const [dropTier, setDropTier] = useState<Horizon | null>(null);
  // Tiers folded away. A long plan is mostly reference most of the time, and
  // the two rungs you are actually working are the ones worth the room.
  const [shut, setShut] = useState<Horizon[]>([]);
  const cards = useRef(new Map<Horizon, HTMLDivElement | null>());

  const all = placements(goal);
  const written = all.filter((p) => p.sub.title.trim());
  const finished = written.filter((p) => p.sub.done).length;

  const addTop = (h: Horizon) =>
    onUpdate({
      ...goal,
      horizons: {
        ...goal.horizons,
        [h]: [...goal.horizons[h], { id: uid(), title: "", done: false }],
      },
    });

  const act: Actions = {
    toggle: (home, path) => onUpdate(complete(goal, home, path)),
    rename: (home, path, title) =>
      onUpdate(editByPath(goal, home, path, (sub) => ({ ...sub, title }))),
    icon: (home, path, icon) =>
      onUpdate(editByPath(goal, home, path, (sub) => ({ ...sub, icon }))),
    remove: (home, path) => onUpdate(removeByPath(goal, home, path)),
    addPart: (home, path) =>
      onUpdate(
        editParts(goal, home, path, (steps) => [
          ...steps,
          { id: uid(), title: "", done: false },
        ])
      ),
    push: (home, path) => onUpdate(push(goal, home, path)),
    pull: (home, path) => onUpdate(pull(goal, home, path)),
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
    <div className="mx-auto w-full max-w-[620px]">
      <button
        onClick={onBack}
        className="mb-5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All goals
      </button>

      {/* The header carries the one number that says how the whole goal is
          going, so the page opens on an answer rather than on a list. */}
      {/* One number for the whole goal, so the page opens on an answer rather
          than on a list. Deliberately not tinted: Today is the only coloured
          card on the page, and two of them would be two heroes. */}
      <div className="flex items-center gap-4 rounded-3xl border border-border/50 bg-card px-4 py-3.5">
        <Gauge done={finished} total={written.length} color={color.dot} size={64}>
          <span
            className="text-[15px] font-semibold tabular-nums"
            style={{ color: ink }}
          >
            {written.length ? Math.round((finished / written.length) * 100) : 0}
            <span className="text-[9px]">%</span>
          </span>
        </Gauge>

        <div className="min-w-0 flex-1">
          <input
            value={goal.title}
            onChange={(e) => onUpdate({ ...goal, title: e.target.value })}
            placeholder="Name your goal"
            className="w-full bg-transparent text-[1.3rem] font-medium leading-[1.15] tracking-tight text-heading outline-none placeholder:text-muted-foreground/50"
          />
          <p className="mt-1 text-[12px] text-muted-foreground">
            {written.length
              ? `${finished} of ${written.length} done · ${dayLoad}/${DAILY_CAP} on today`
              : "Start at the year and work backwards"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <ColorPicker
            value={goal.color}
            onPick={(c) => onUpdate({ ...goal, color: c })}
          />
          <button
            onClick={onDelete}
            aria-label="Delete goal"
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground"
          >
            <Trash className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* The ladder */}
      <div className="relative mt-4 pl-7">
        <div className="space-y-2">
          {HORIZONS.map(({ key, label, addLabel, prompt }, i) => {
            const today = key === "today";
            const heat = HEAT[i];
            // Today keeps only what is still to do; the day's finished work
            // steps aside into the drawer below rather than sitting on a
            // working list with a line through it. Every other tier shows its
            // whole plan, done and not, because that is what a plan is.
            const placedHere = shownAt(goal, key).filter(
              (p) => !(today && p.sub.done)
            );
            const own = placedHere.filter(
              (p) => p.home === key && p.path.length === 1 && !p.sub.at
            );
            const incoming = placedHere.filter((p) => !own.includes(p));
            const lit = dropTier === key;
            const folded = shut.includes(key);
            const live = placedHere.length > 0;
            const bare = !live && !today;

            return (
              <div key={key} className="relative">
                {/* The rail, drawn per tier so it can be lit where there is
                    work and left faint where there is not — the path in an
                    onboarding map, doing the same job. */}
                {i < HORIZONS.length - 1 && (
                  <span
                    className="absolute -left-[19px] top-5 -bottom-2 w-[3px] rounded-full"
                    style={{ backgroundColor: tint(color.dot, live ? heat : 0.14) }}
                    aria-hidden
                  />
                )}
                <span
                  className="absolute -left-[24px] top-[14px] grid h-[13px] w-[13px] place-items-center rounded-full ring-[3px] ring-background transition-colors"
                  style={{
                    backgroundColor: live ? tint(color.dot, heat) : "var(--secondary)",
                  }}
                  aria-hidden
                >
                  {live && <span className="h-[4px] w-[4px] rounded-full bg-white/90" />}
                </span>

                {/* No card around the tier. There was one, and with the
                    targets inside it now carrying their own soft field it made
                    three nested containers for one list — box inside box inside
                    page. The rail, the node and the label say which rung this
                    is; the tier does not also need a wall around it. */}
                <motion.div
                  layout
                  ref={(el) => {
                    cards.current.set(key, el);
                  }}
                  data-tier={key}
                  className={cn(
                    "rounded-3xl transition-colors",
                    bare ? "py-0.5" : "pb-1 pt-0.5"
                  )}
                  style={{
                    boxShadow: lit ? `0 0 0 2px ${color.dot}` : undefined,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() =>
                        setShut((s) =>
                          s.includes(key) ? s.filter((k) => k !== key) : [...s, key]
                        )
                      }
                      aria-expanded={!folded}
                      aria-label={`${folded ? "Show" : "Hide"} ${label}`}
                      className="group inline-flex min-w-0 items-center gap-1.5"
                    >
                      <span
                        className={cn(
                          "font-medium uppercase tracking-[0.16em]",
                          today ? "text-[11px]" : "text-[10px]"
                        )}
                        style={{ color: tint(ink, Math.max(0.55, heat)) }}
                      >
                        {label}
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-3 w-3 text-muted-foreground/40 transition-transform",
                          folded && "-rotate-90"
                        )}
                      />
                    </button>

                    {today ? (
                      <DayCount load={dayLoad} color={color} />
                    ) : bare && addLabel ? (
                      <button
                        onClick={() => addTop(key)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[11.5px] font-medium text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <Plus className="h-3 w-3" /> {addLabel}
                      </button>
                    ) : (
                      live && (
                        <span className="text-[10.5px] font-medium tabular-nums text-muted-foreground/50">
                          {placedHere.filter((p) => p.sub.done).length}/
                          {placedHere.length}
                        </span>
                      )
                    )}
                  </div>

                  {!folded && (
                    <>
                      {/* Rule A, asked rather than answered, and asked by
                          somebody. It appears only on an empty day, which is
                          the one moment it is a question and not a scold. */}
                      {today && picksOf(goal).length === 0 && (
                        <div className="mt-2.5 flex items-start gap-3 rounded-2xl bg-background/70 px-3 py-2.5">
                          <PlanMark size={52} />
                          <p className="text-[12px] leading-relaxed text-muted-foreground">
                            Nothing picked yet. Read your Weekly Goal and ask:
                            which one thing today makes the rest easier — or
                            unnecessary?
                          </p>
                        </div>
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
                        className="mt-1.5 space-y-1.5"
                      >
                        <AnimatePresence initial={false}>
                          {own.map((p) => (
                            <Reorder.Item
                              key={p.sub.id}
                              value={p.sub}
                              dragListener={false}
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
                                onPrimary={
                                  today ? () => onPrimary(p.sub.id) : undefined
                                }
                                hero={today}
                                heat={heat}
                                act={act}
                              />
                            </Reorder.Item>
                          ))}
                        </AnimatePresence>
                      </Reorder.Group>

                      {/* Lines pushed into this tier from a target further out.
                          They are shown and ticked here, but they belong to the
                          target named beside them and are counted there — which
                          is why that target has not moved. */}
                      {incoming.map((p) => (
                        <div key={p.sub.id} className="mt-1.5">
                        <PlanRow
                          placed={p}
                          color={color}
                          prompt={prompt}
                          dayFull={full}
                          onPrimary={today ? () => onPrimary(p.sub.id) : undefined}
                          hero={today}
                          heat={heat}
                          act={act}
                        />
                        </div>
                      ))}

                      {addLabel && !bare ? (
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
                        // Only the week, which cannot be written into: it needs
                        // a line saying so. A tier that simply has nothing in it
                        // has its add button up on the label and needs nothing.
                        !addLabel &&
                        placedHere.length === 0 && (
                          <p className="mt-1.5 px-1 text-[11.5px] leading-relaxed text-muted-foreground/80">
                            Push an action down from This Month and it appears
                            here, tagged with the target it serves.
                          </p>
                        )
                      )}

                      {today && (
                        <CompletedWins
                          wins={winsToday(goal)}
                          onUndo={(id) => {
                            const w = shownAt(goal, "today").find(
                              (x) => x.sub.id === id
                            );
                            if (w) act.toggle(w.home, w.path);
                          }}
                        />
                      )}
                    </>
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
  icon: (home: Horizon, path: string[], icon: string) => void;
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
 * is a target there, to be broken down again.
 *
 * Three things are visible on it and nothing else: the mark, the words, and
 * the one move it can make. Depth is carried by weight rather than by another
 * control — a top-level line is a heading and reads like one, a part beneath it
 * is smaller and quieter — so nesting is legible without anything being drawn
 * around it.
 */
function PlanRow({
  placed,
  color,
  prompt,
  dayFull,
  depth = 0,
  reorderable = false,
  hero = false,
  heat = 1,
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
  /** Today's own lines, which are the ones being worked on right now. */
  hero?: boolean;
  /** How close this tier is, which is how strongly it is coloured. */
  heat?: number;
  onDragMove?: (y: number) => void;
  onDragDone?: () => void;
  onPrimary?: () => void;
  act: Actions;
}) {
  const { sub, tier, parent, home, path } = placed;
  const { night } = useApp();
  const ink = night ? color.dot : color.ink;
  const controls = useDragControls();
  const progress = stepProgress(sub);
  const [touched, setTouched] = useState(false);
  const [picking, setPicking] = useState(false);
  // Rule C, and only ever as advice: it waits until the field has been left, so
  // it cannot sit there correcting a half-typed word.
  const vague = touched && !sub.done && isVague(sub.title);

  const next = nearer(tier);
  const canPush = !sub.done && !!next && !(next === "today" && dayFull);
  // Today holds the doing, not the planning. An action broken down on the day
  // it is due is a target that was planned too late.
  const canBreakDown = tier !== "today";
  const name = sub.title || "this line";

  const menu: MenuItem[] = [
    {
      label: sub.icon ? "Change the emoji" : "Choose an emoji",
      onSelect: () => setPicking(true),
    },
    ...(canBreakDown
      ? [{ label: "Add an action", onSelect: () => act.addPart(home, path) }]
      : []),
    ...(progress
      ? [
          {
            label: sub.done ? "Reopen it all" : "Mark it all done",
            onSelect: () => act.toggle(home, path),
          },
        ]
      : []),
    ...(next && !canPush && !sub.done
      ? [{ label: `Push to ${shortLabel(next)} (day is full)`, onSelect: () => {} }]
      : []),
    ...(sub.at
      ? [{ label: "Send back a tier", onSelect: () => act.pull(home, path) }]
      : []),
    { label: "Delete", onSelect: () => act.remove(home, path), danger: true },
  ];

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
      // A target and its actions are one thing, so they sit on one soft field
      // of the goal's colour. It groups them without a border, gives the eye a
      // block to land on instead of a column of same-length sentences, and is
      // most of what stops six tiers of lines reading as a wall.
      className={cn(
        "group/row transition-colors",
        depth === 0
          ? "rounded-2xl px-2 py-1.5"
          : "rounded-xl px-1 py-[3px] hover:bg-black/[0.03]"
      )}
      style={
        depth === 0
          ? {
              backgroundColor: tint(color.dot, 0.035 + heat * 0.135),
              boxShadow: hero ? `0 0 0 1px ${tint(color.dot, 0.35)}` : undefined,
            }
          : undefined
      }
    >
      <div className="flex items-center gap-2">
        {reorderable ? (
          <button
            onPointerDown={(e) => controls.start(e)}
            aria-label={
              next ? `Drag to reorder, or onto ${shortLabel(next)}` : "Drag to reorder"
            }
            className="-ml-1 cursor-grab touch-none text-muted-foreground/25 transition-colors hover:text-muted-foreground active:cursor-grabbing"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span className="-ml-1 w-3.5 shrink-0" aria-hidden />
        )}

        {onPrimary && depth === 0 && (
          <PrimaryFlag on={!!sub.primary} color={color} onClick={onPrimary} />
        )}

        <span className="relative shrink-0">
          <Token
            icon={sub.icon}
            done={sub.done}
            color={color}
            progress={progress}
            onToggle={() => act.toggle(home, path)}
            onPick={() => setPicking(true)}
            label={name}
          />
          {picking && (
            <IconPicker
              onPick={(e) => act.icon(home, path, e)}
              onClose={() => setPicking(false)}
            />
          )}
        </span>

        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          {!progress && sub.icon && (
            <span className="shrink-0 text-[12.5px] leading-none">{sub.icon}</span>
          )}
          <input
            value={sub.title}
            onChange={(e) => act.rename(home, path, e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder={depth === 0 ? prompt : "An action that gets you there…"}
            className={cn(
              "min-w-0 flex-1 bg-transparent leading-snug outline-none placeholder:text-muted-foreground/45",
              depth === 0
                ? hero
                  ? "text-[14.5px] font-medium text-heading"
                  : "text-[13.5px] font-medium text-heading"
                : "text-[12.5px] text-foreground/80",
              sub.done && "text-muted-foreground line-through"
            )}
          />
          {progress && (
            <span
              className="shrink-0 text-[10.5px] font-semibold tabular-nums"
              style={{ color: tint(ink, 0.85) }}
            >
              {progress.done}/{progress.total}
            </span>
          )}
          {sub.rolledOver && !sub.done && <Badge>Rolled over</Badge>}
          {/* What this line is in service of. A tier full of untagged
              fragments is a list of errands; the same list tagged is a plan
              being executed. */}
          {parent && !sub.done && (
            <ParentTag ink={ink} color={color} title={`An action of "${parent.title}"`}>
              {parent.icon ? `${parent.icon} ` : ""}
              {parent.title || "its target"}
            </ParentTag>
          )}
        </span>

        {canPush && (
          <button
            onClick={() => act.push(home, path)}
            aria-label={`Push "${name}" to ${shortLabel(next!)}`}
            title={`Push to ${shortLabel(next!)}`}
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-[3px] text-[10.5px] font-medium transition-colors"
            style={{ backgroundColor: tint(color.dot, 0.13), color: ink }}
          >
            <ArrowDownToLine className="h-3 w-3" /> {shortLabel(next!)}
          </button>
        )}

        <RowMenu items={menu} label={name} />
      </div>

      {vague && (
        <p className="ml-[62px] mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          {VAGUE_HINT}
        </p>
      )}

      {/* The parts, joined to their heading by a rule in the goal's own colour.
          That line is the whole of the link: it says these belong to the thing
          above them, and it travels with the line wherever it is pushed. */}
      {(sub.steps?.length ?? 0) > 0 && (
        <div
          className="ml-[18px] mt-0.5 border-l-2 pl-2.5"
          style={{ borderColor: tint(color.dot, 0.22) }}
        >
          {(sub.steps ?? []).map((child) =>
            (child.at ?? tier) === tier ? (
              <PlanRow
                key={child.id}
                placed={{ sub: child, tier, home, path: [...path, child.id] }}
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
        </div>
      )}

      {/* Adding a part is on the menu for every line, and offered in the open
          on a top-level one — that is where a plan is actually broken down, and
          a menu is one press too many for the thing you came to do. */}
      {canBreakDown && depth === 0 && (
        <button
          onClick={() => act.addPart(home, path)}
          aria-label={`Add an action to "${sub.title || "this line"}"`}
          className="ml-[18px] mt-0.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
        >
          <Plus className="h-3 w-3" /> Add action
        </button>
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
  const { night } = useApp();
  return (
    <div
      data-scheduled={sub.id}
      className="flex items-center gap-2 px-1 py-[3px] opacity-55"
    >
      {/* The same empty gutter a real row has for its grip, so a part that is
          out being worked on sits on exactly the line its siblings sit on. */}
      <span className="-ml-1 w-3.5 shrink-0" aria-hidden />
      <span
        className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full text-[12.5px] leading-none"
        style={{ backgroundColor: tint(color.dot, 0.12) }}
      >
        {sub.icon ?? (
          <span
            className="h-[5px] w-[5px] rounded-full"
            style={{ backgroundColor: color.dot }}
          />
        )}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[12.5px] leading-snug",
          sub.done && "line-through"
        )}
      >
        {sub.title}
      </span>
      <button
        onClick={onPull}
        aria-label={`Send "${sub.title}" back a tier`}
        title="Send back a tier"
        className="shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.08em] transition-opacity hover:opacity-100"
        style={{
          backgroundColor: tint(color.dot, 0.15),
          color: night ? color.dot : color.ink,
        }}
      >
        On {shortLabel(sub.at!)}
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
  const { night } = useApp();
  return (
    <span
      className="flex shrink-0 items-center gap-1"
      title={`Across every goal. ${DAILY_CAP} is a full day.`}
    >
      {Array.from({ length: DAILY_CAP }).map((_, i) => (
        <span
          key={i}
          className="h-[7px] w-[7px] rounded-full transition-colors"
          style={{
            backgroundColor: i < load ? color.dot : tint(color.dot, 0.22),
          }}
        />
      ))}
      <span
        className="ml-1 text-[10.5px] font-semibold tabular-nums"
        style={{ color: night ? color.dot : color.ink }}
      >
        {load}/{DAILY_CAP}
      </span>
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
    <div className="mt-1">
      <button
        onClick={onClick}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-full px-1.5 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" /> {label}
      </button>
      {note && (
        <p className="mt-0.5 px-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
          {note}
        </p>
      )}
    </div>
  );
}

/**
 * A quiet note about how a line came to be here.
 *
 * Something carried from yesterday is not a failure; this is a fact, not a
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
  ink,
  title,
}: {
  children: React.ReactNode;
  color: GoalColor;
  ink: string;
  title?: string;
}) {
  return (
    <span
      className="inline-flex max-w-[42%] shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.08em]"
      style={{ backgroundColor: tint(color.dot, 0.15), color: ink }}
      title={title}
    >
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
      style={{ color: on ? color.dot : "var(--muted-foreground)", opacity: on ? 1 : 0.35 }}
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

