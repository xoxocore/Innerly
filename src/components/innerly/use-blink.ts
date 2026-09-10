"use client";

import { useEffect, useState } from "react";

/**
 * Jelly's blink, wherever she appears.
 *
 * She blinks twice each time, the way a person does when they are pleased to
 * see you, and the gap between is never the same twice so she never falls into
 * a rhythm. Returns 1 while the lids are down and 0 while they are up; what a
 * lid looks like is the drawing's business, not this one's.
 *
 * There are three Jellys now — the logo, the one with the checklist, the one
 * with the heart — and this is the part all three share.
 */

/** A blink, in milliseconds. Human ones are about this long. */
export const CLOSING = 90;
export const HELD = 60;
export const OPENING = 130;

/** Blinks per blink, and the beat between them. */
const TIMES = 2;
const BETWEEN = 90;

/** Somewhere between these, so she never falls into a rhythm. */
const GAP_MIN = 3800;
const GAP_MAX = 9000;

export function useBlink(on = true): 0 | 1 {
  const [shut, setShut] = useState<0 | 1>(0);

  useEffect(() => {
    if (!on) return;
    // Somebody who has asked their computer for less movement has asked for
    // this too. A mascot is the last thing that should argue about it.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;

    let stopped = false;
    let timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => {
      timers.push(setTimeout(fn, ms));
    };

    const once = () => {
      if (stopped) return;
      let at = 0;
      for (let i = 0; i < TIMES; i++) {
        later(() => setShut(1), at);
        at += CLOSING + HELD;
        later(() => setShut(0), at);
        at += OPENING;
        if (i < TIMES - 1) at += BETWEEN;
      }
      later(schedule, at);
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
  }, [on]);

  return shut;
}
