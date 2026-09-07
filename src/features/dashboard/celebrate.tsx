"use client";

/**
 * A small burst, thrown from the tick that earned it.
 *
 * Deliberately the size of the tick and not the size of the screen: this fires
 * every time somebody finishes anything, and a full-window shower would be
 * charming twice and tiresome after that. It lands beside the task, says well
 * done, and gets out of the way.
 *
 * Drawn by the stylesheet rather than animated in JavaScript. Twelve throwaway
 * shapes that no one interacts with are exactly what CSS keyframes are for —
 * they run off the main thread, they cost nothing to mount, and they cannot be
 * cut short by anything else on the page deciding to re-render.
 */

const COLORS = [
  "#00bf63",
  "#ff9500",
  "#af52de",
  "#007aff",
  "#f2709c",
  "#5ac8fa",
];

/**
 * Fixed rather than random, so a burst looks the same every time and cannot
 * come out lopsided on an unlucky roll. Fanned upward and outward, because
 * that is the direction the gesture goes.
 */
const SPARKS = Array.from({ length: 12 }, (_, i) => {
  const degrees = -160 + i * 11;
  const radians = (degrees * Math.PI) / 180;
  const distance = 20 + ((i * 7) % 12);
  return {
    // A little further down than it was thrown, so the pieces fall rather
    // than simply stopping.
    dx: `${(Math.cos(radians) * distance).toFixed(1)}px`,
    dy: `${(Math.sin(radians) * distance + 8).toFixed(1)}px`,
    turn: `${(i % 2 ? 1 : -1) * (60 + i * 22)}deg`,
    color: COLORS[i % COLORS.length],
    width: i % 3 === 0 ? 6 : 4,
    height: i % 4 === 0 ? 3 : 5,
    delay: `${(i % 4) * 18}ms`,
  };
});

/** Enough for the burst to finish before the row it belongs to leaves. */
export const CELEBRATION_MS = 780;

export function Celebrate() {
  return (
    <span aria-hidden className="celebrate">
      {SPARKS.map((s, i) => (
        <span
          key={i}
          className="celebrate-spark"
          style={
            {
              width: s.width,
              height: s.height,
              backgroundColor: s.color,
              animationDelay: s.delay,
              "--spark-x": s.dx,
              "--spark-y": s.dy,
              "--spark-turn": s.turn,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}
