"use client";

import { useEffect, useRef, useState } from "react";
import { EmojiPicker } from "@/components/innerly/emoji-picker";
import { cn } from "@/lib/utils";
import { Check, MoreHorizontal } from "lucide-react";
import type { GoalColor } from "@/lib/types";

/**
 * The small pieces the goal thread is drawn from.
 *
 * They live here rather than in the thread itself because the thread's job is
 * the shape of the ladder, and these are all answers to a different question:
 * how do you put six tiers of nested work on one screen without it reading as
 * a wall. Every one of them is a way of spending less ink per line.
 */

/* --------------------------------------------------------------- distance */

/**
 * How present a tier should feel, by how close it is.
 *
 * A year away and this afternoon are not equally urgent, and a page that draws
 * them identically is asking the eye to work out the difference from the words
 * alone. So the goal's own colour comes up in strength as the ladder descends
 * — faint at the top, full at the bottom. One hue, six weights: colour that
 * means something rather than colour for its own sake.
 */
export const HEAT = [0.16, 0.26, 0.4, 0.58, 0.8, 1];

/** A hex colour at a given strength, for rails, nodes and tints. */
export function tint(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
  return hex + a.toString(16).padStart(2, "0");
}

/* ----------------------------------------------------------------- gauge */

/**
 * An arc, for a number that means "how far along".
 *
 * A ring is read in one glance and a fraction has to be parsed, so the ring
 * carries the feeling and the fraction beside it carries the fact. Drawn as a
 * three-quarter arc rather than a full circle because a gap gives the eye a
 * start and an end, which is what makes the fill legible at this size.
 */
export function Gauge({
  done,
  total,
  color,
  size = 64,
  children,
}: {
  done: number;
  total: number;
  color: string;
  size?: number;
  children?: React.ReactNode;
}) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  // Three quarters of the circle, opened at the bottom.
  const arc = c * 0.75;
  const pct = total > 0 ? done / total : 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <g transform={`rotate(135 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={tint(color, 0.15)}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={`${arc} ${c}`}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={`${arc * pct} ${c}`}
            style={{ transition: "stroke-dasharray 600ms cubic-bezier(.2,.8,.2,1)" }}
          />
        </g>
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

/* ----------------------------------------------------------------- token */

/**
 * The mark at the head of a line: a ring, or a tick.
 *
 * This is where two controls became one. A line with actions under it has a
 * finished state that is *read* rather than set — it is done exactly when its
 * parts are — so the tick on it was never a control at all, and a ring showing
 * how far through it is says more in the same square. That ring is also where
 * its emoji lives, since neither is a thing you can press for any other reason.
 *
 * A line with no parts keeps its tick, because there ticking is the whole job,
 * and its emoji sits beside the words instead. An emoji drawn *instead of* a
 * tick would be an emoji you cannot tick and a done state you cannot see.
 */
export function Token({
  icon,
  done,
  color,
  progress,
  onToggle,
  onPick,
  label,
}: {
  icon?: string;
  done: boolean;
  color: GoalColor;
  /** Present when the line has parts, in which case it cannot be ticked. */
  progress: { done: number; total: number } | null;
  onToggle?: () => void;
  /** Opens the emoji picker, which the row owns. */
  onPick: () => void;
  label: string;
}) {
  const ring = !!progress && progress.total > 0;
  const pct = ring ? progress!.done / progress!.total : 0;

  if (!ring) {
    return (
      <button
        onClick={onToggle}
        aria-label={done ? "Mark incomplete" : "Mark complete"}
        className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full transition-transform hover:scale-110"
      >
        <span
          className="grid h-[17px] w-[17px] place-items-center rounded-full border-[1.5px] transition-colors"
          style={{
            borderColor: color.dot,
            backgroundColor: done ? color.dot : "transparent",
          }}
        >
          {done && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} />}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={onPick}
      aria-label={`Choose an emoji for ${label}`}
      className="relative grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full transition-transform hover:scale-110"
    >
      <svg viewBox="0 0 22 22" className="absolute inset-0" aria-hidden>
        <circle cx="11" cy="11" r="10" fill="none"
          stroke={tint(color.dot, 0.22)} strokeWidth="2" />
        <circle cx="11" cy="11" r="10" fill="none"
          stroke={color.dot} strokeWidth="2" strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * 10 * pct} ${2 * Math.PI * 10}`}
          transform="rotate(-90 11 11)"
          style={{ transition: "stroke-dasharray 450ms cubic-bezier(.2,.8,.2,1)" }} />
      </svg>
      {icon ? (
        <span className="text-[12px] leading-none">{icon}</span>
      ) : (
        <span
          className="h-[7px] w-[7px] rounded-full"
          style={{ backgroundColor: color.dot }}
        />
      )}
    </button>
  );
}

/**
 * The emoji grid, hung under whatever opened it.
 *
 * Kept separate from the mark because both kinds of line can carry an emoji but
 * only one of them has a mark free to open it with.
 */
export function IconPicker({
  onPick,
  onClose,
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const down = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", down);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", down);
    };
  }, [onClose]);

  return (
    <div ref={box} className="absolute left-6 top-7 z-30">
      <EmojiPicker
        onPick={(e) => {
          onPick(e);
          onClose();
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ menu */

export type MenuItem = {
  label: string;
  onSelect: () => void;
  danger?: boolean;
};

/**
 * Everything a line can do that is not its one main move.
 *
 * The row used to carry a tick, a flag, a grip, a push, a pull, a bin and an
 * emoji all at once, and seven controls on every line of a six-tier plan is
 * most of why the page felt loud. They are not gone — they are one press away,
 * behind a mark that is always in the same place and never changes size, so
 * nothing shifts under the pointer.
 */
export function RowMenu({ items, label }: { items: MenuItem[]; label: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const down = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", down);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", down);
    };
  }, [open]);

  return (
    <div ref={box} className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`More for ${label}`}
        aria-expanded={open}
        className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground/45 transition-colors hover:bg-accent hover:text-foreground"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-7 z-30 min-w-[168px] overflow-hidden rounded-2xl border border-border bg-card py-1 shadow-xl"
        >
          {items.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              onClick={() => {
                it.onSelect();
                setOpen(false);
              }}
              className={cn(
                "block w-full px-3 py-1.5 text-left text-[12.5px] transition-colors hover:bg-accent",
                it.danger && "text-[#c0392b]"
              )}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
