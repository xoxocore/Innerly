"use client";

import { useId, useState } from "react";
import type { DailyPoint } from "./use-admin";

/**
 * Thirty days of one measure.
 *
 * Signups and active people live in separate charts on purpose. They are
 * counted differently and grow at different rates, and putting them on one
 * plot would need two y-scales — which is the fastest way to make a chart that
 * looks informative and means nothing.
 *
 * The mark colour is the brand's darker green in both themes: the bright one
 * measures 2.37:1 against a light card, too faint to read as data.
 */
export function Trend({
  points,
  label,
  field,
}: {
  points: DailyPoint[];
  label: string;
  field: "signups" | "active";
}) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const W = 640;
  const H = 132;
  const PAD_Y = 10;

  const values = points.map((p) => p[field]);
  const peak = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);

  // Thirty points: cheap enough to lay out on every render, and memoising it
  // would need a dependency on the values themselves rather than the array.
  const geometry = (() => {
    if (points.length === 0) return null;
    const step = points.length > 1 ? W / (points.length - 1) : 0;
    const y = (v: number) => H - PAD_Y - (v / peak) * (H - PAD_Y * 2);
    const coords = values.map((v, i) => [i * step, y(v)] as const);
    const line = coords.map(([x, yy], i) => `${i ? "L" : "M"}${x},${yy}`).join(" ");
    const area = `${line} L${W},${H} L0,${H} Z`;
    return { step, coords, line, area };
  })();

  if (!geometry) return null;

  const at = hover === null ? null : points[hover];
  const dayLabel = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });

  return (
    <figure className="m-0">
      <figcaption className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-heading">{label}</span>
        <span className="text-[12px] tabular-nums text-muted-foreground">
          {total} in 30 days
        </span>
      </figcaption>

      <div
        className="relative"
        onMouseLeave={() => setHover(null)}
        onPointerLeave={() => setHover(null)}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="block h-[132px] w-full"
          role="img"
          aria-label={`${label}: ${total} over the last 30 days, peaking at ${peak} in a day.`}
          onPointerMove={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - box.left) / box.width;
            const i = Math.round(ratio * (points.length - 1));
            setHover(Math.min(points.length - 1, Math.max(0, i)));
          }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-ink)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--chart-ink)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          <path d={geometry.area} fill={`url(#${gradientId})`} />
          <path
            d={geometry.line}
            fill="none"
            stroke="var(--chart-ink)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />

          {hover !== null && (
            <>
              <line
                x1={geometry.coords[hover][0]}
                x2={geometry.coords[hover][0]}
                y1={0}
                y2={H}
                stroke="var(--border)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              {/* A ring in the surface colour so the dot reads on the line. */}
              <circle
                cx={geometry.coords[hover][0]}
                cy={geometry.coords[hover][1]}
                r="5"
                fill="var(--chart-ink)"
                stroke="var(--card)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
        </svg>

        {at && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-xl border border-border/70 bg-card px-2.5 py-1.5 text-[11.5px] leading-tight shadow-sm"
            style={{
              left: `${(hover! / Math.max(1, points.length - 1)) * 100}%`,
            }}
          >
            <div className="font-medium tabular-nums text-heading">
              {at[field]} {at[field] === 1 ? "person" : "people"}
            </div>
            <div className="text-muted-foreground">{dayLabel(at.day)}</div>
          </div>
        )}
      </div>

      <div className="mt-1 flex justify-between text-[10.5px] text-muted-foreground">
        <span>{dayLabel(points[0].day)}</span>
        <span>Today</span>
      </div>
    </figure>
  );
}
