"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import {
  PLAN_BODY_SRC,
  PLAN_EYELID,
  PLAN_EYES,
  PLAN_PENCIL_SRC,
  PLAN_PIVOT,
  PLAN_SHUT,
} from "@/lib/plan-jelly";
import { cn } from "@/lib/utils";
import { CLOSING, OPENING, useBlink } from "./use-blink";

/**
 * Jelly, with her checklist, writing.
 *
 * She comes in two layers because only one of them moves. The pencil is cut
 * out of the drawing into a layer of its own and laid back exactly where it
 * was, so at rest this is the picture that was handed over, pixel for pixel —
 * and then that one layer turns a few degrees about a point near its eraser,
 * which is what makes the tip travel rather than the far end wave.
 *
 * She writes in short bursts and then stops, the way anybody does. A pencil
 * that swung without pause would be a metronome sitting in the corner of a
 * page about not overloading your day.
 *
 * And she blinks twice while she does it, the way she does everywhere else.
 */

/** One stroke, out and back, in milliseconds. */
const STROKE = 620;

/** Strokes in a burst, and the rest between bursts. */
const STROKES = 3;
const REST_MIN = 2600;
const REST_MAX = 5200;

/** How far the pencil turns, in degrees. Small: this is writing, not waving. */
const SWING = 7;

export function PlanMark({
  size = 44,
  label,
  /** Off for a still Jelly — a printed sheet, a test. */
  animate = true,
  className,
}: {
  size?: number;
  label?: string;
  animate?: boolean;
  className?: string;
}) {
  const shut = useBlink(animate);
  const [writing, setWriting] = useState(false);

  // Somebody who has asked their computer for less movement has asked for this
  // too. A mascot is the last thing that should argue about it. Read where it
  // is used rather than held in state: the answer is only needed when a loop
  // starts, and keeping it in state means a render just to learn it.
  const wanted = () =>
    animate && !window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  useEffect(() => {
    if (!wanted()) return;
    let stopped = false;
    let timers: ReturnType<typeof setTimeout>[] = [];

    const burst = () => {
      if (stopped) return;
      timers = [];
      setWriting(true);
      timers.push(
        setTimeout(() => {
          setWriting(false);
          timers.push(
            setTimeout(burst, REST_MIN + Math.random() * (REST_MAX - REST_MIN))
          );
        }, STROKE * STROKES)
      );
    };

    burst();
    return () => {
      stopped = true;
      for (const t of timers) clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate]);

  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ width: size, height: size }}
      className={cn("relative block shrink-0 select-none", className)}
    >
      <img
        src={PLAN_BODY_SRC}
        data-jelly="body"
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="block"
        draggable={false}
      />

      <img
        src={PLAN_PENCIL_SRC}
        data-jelly="pencil"
        alt=""
        width={size}
        height={size}
        data-writing={writing ? "" : undefined}
        style={{
          position: "absolute",
          inset: 0,
          width: size,
          height: size,
          // About a point near the eraser, so what travels is the tip.
          transformOrigin: `${PLAN_PIVOT.x * 100}% ${PLAN_PIVOT.y * 100}%`,
          animation: writing
            ? `jelly-write ${STROKE}ms ease-in-out ${STROKES}`
            : undefined,
        }}
        className="block"
        draggable={false}
      />

      {PLAN_EYES.map((eye, i) => (
        <span
          key={i}
          data-jelly="lid"
          aria-hidden
          style={{
            position: "absolute",
            left: `${eye.left * 100}%`,
            top: `${eye.top * 100}%`,
            width: `${eye.width * 100}%`,
            height: `${eye.height * shut * PLAN_SHUT * 100}%`,
            background: PLAN_EYELID,
            transition: `height ${shut ? CLOSING : OPENING}ms ease-in-out`,
            pointerEvents: "none",
          }}
        />
      ))}

      <style>{`
        @keyframes jelly-write {
          0%   { transform: rotate(0deg) translate(0, 0); }
          30%  { transform: rotate(-${SWING}deg) translate(-1.5%, 0.8%); }
          65%  { transform: rotate(${SWING * 0.55}deg) translate(1%, -0.4%); }
          100% { transform: rotate(0deg) translate(0, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-writing] { animation: none !important; }
        }
      `}</style>
    </span>
  );
}
