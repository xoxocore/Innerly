"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

const SIZE = 46;
const STROKE = 5;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

// The day's one bold mark: a small ring carrying the only gradient on the
// screen, sized to sit beside the date rather than dominate it.
export function ProgressRing({
  done,
  total,
}: {
  done: number;
  total: number;
}) {
  const pct = total > 0 ? done / total : 0;
  const complete = total > 0 && done === total;

  return (
    <div
      className="relative shrink-0"
      style={{ width: SIZE, height: SIZE }}
      role="img"
      aria-label={`${done} of ${total} done`}
    >
      <svg width={SIZE} height={SIZE} className="-rotate-90">
        <defs>
          <linearGradient id="innerly-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#007AFF" />
            <stop offset="100%" stopColor="#AF52DE" />
          </linearGradient>
        </defs>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-secondary"
        />
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="url(#innerly-ring)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={C}
          initial={false}
          animate={{ strokeDashoffset: C * (1 - pct) }}
          transition={{ type: "spring", stiffness: 120, damping: 24 }}
        />
      </svg>

      <div className="absolute inset-0 grid place-items-center">
        {complete ? (
          <motion.span
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            className="grid h-[22px] w-[22px] place-items-center rounded-full bg-[#34C759]"
          >
            <Check className="h-3 w-3 text-white" strokeWidth={3.5} />
          </motion.span>
        ) : (
          <span className="text-[12px] font-medium tabular-nums leading-none text-heading">
            {done}
            <span className="text-muted-foreground">/{total}</span>
          </span>
        )}
      </div>
    </div>
  );
}
