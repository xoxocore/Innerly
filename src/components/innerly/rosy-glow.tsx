"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// The ambient wash the writing screens float on — the thing that makes the
// glass above it read as glass rather than as a flat panel.
export function RosyGlow({
  night,
  className,
}: {
  night: boolean;
  className?: string;
}) {
  return (
    <motion.div
      aria-hidden
      className={cn("pointer-events-none absolute -z-10 rounded-full blur-3xl", className)}
      style={{
        background: night
          ? "radial-gradient(circle, rgba(196,206,234,0.22), transparent 70%)"
          : "radial-gradient(circle, rgba(255,201,220,0.55), rgba(255,224,234,0.22) 46%, transparent 72%)",
      }}
      animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.08, 1] }}
      transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}
