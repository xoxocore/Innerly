"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

const SIZE = 92;
const STROKE = 9;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

// The day's one bold mark: a single ring carrying the only gradient on the
// screen, so the eye lands on progress before anything else.
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
            <stop offset="0%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#8b5cf6" />
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
            className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#ec4899] to-[#8b5cf6]"
          >
            <Check className="h-[18px] w-[18px] text-white" />
          </motion.span>
        ) : (
          <span className="text-center leading-none">
            <span className="block text-[22px] font-medium tabular-nums text-heading">
              {done}
            </span>
            <span className="mt-0.5 block text-[11px] tabular-nums text-muted-foreground">
              of {total}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
