"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { EYES, JELLY_BODY, MARK_SRC } from "@/lib/logo";
import { cn } from "@/lib/utils";

/**
 * Jelly.
 *
 * The artwork is drawn exactly as it was handed over — the only thing removed
 * from the file was the white behind her.
 *
 * She blinks by having a lid in her own body colour drawn over each eye for a
 * moment and then taken away. Nothing about the drawing is edited to do it, so
 * the face at rest is the original picture and a blink cannot damage it. The
 * lid stops short of the bottom of the eye, which leaves the eye's own dark
 * edge showing as the closed line rather than inventing a new shape for it.
 */

/** How far down the eye the lid comes. The rest is the closed eye showing. */
const SHUT = 0.82;

/** A blink, in milliseconds. Human ones are about this long. */
const CLOSING = 90;
const HELD = 60;
const OPENING = 130;

/** Somewhere between these, so she never falls into a rhythm. */
const GAP_MIN = 3800;
const GAP_MAX = 9000;

export function Mark({
  size = 26,
  label,
  /** Off for a still Jelly — a favicon, a printed sheet, a test. */
  blink = true,
  className,
}: {
  size?: number;
  label?: string;
  blink?: boolean;
  className?: string;
}) {
  const [shut, setShut] = useState(0);

  useEffect(() => {
    if (!blink) return;
    // Somebody who has asked their computer for less movement has asked for
    // this too. A logo is the last thing that should argue about it.
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (still?.matches) return;

    let timers: ReturnType<typeof setTimeout>[] = [];
    let stopped = false;

    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(fn, ms);
      timers.push(t);
      return t;
    };

    const once = () => {
      if (stopped) return;
      setShut(1);
      later(() => setShut(0), CLOSING + HELD);
      later(schedule, CLOSING + HELD + OPENING);
    };

    const schedule = () => {
      if (stopped) return;
      timers = [];
      later(once, GAP_MIN + Math.random() * (GAP_MAX - GAP_MIN));
    };

    schedule();
    return () => {
      stopped = true;
      for (const t of timers) clearTimeout(t);
    };
  }, [blink]);

  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ width: size, height: size }}
      className={cn("relative block shrink-0 select-none", className)}
    >
      <img
        src={MARK_SRC}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="block"
        draggable={false}
      />
      {EYES.map((eye, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            position: "absolute",
            left: `${eye.left * 100}%`,
            top: `${eye.top * 100}%`,
            width: `${eye.width * 100}%`,
            height: `${eye.height * shut * SHUT * 100}%`,
            background: JELLY_BODY,
            transition: `height ${shut ? CLOSING : OPENING}ms ease-in-out`,
            pointerEvents: "none",
          }}
        />
      ))}
    </span>
  );
}
