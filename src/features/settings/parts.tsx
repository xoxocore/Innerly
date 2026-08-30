"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The pieces Settings is built from.
 *
 * Sized to match Reflect and Daily Plan rather than the older, roomier screens:
 * 12.5px body, 15px section titles, glass cards. Settings is a page people
 * skim for one switch, so density is the point — a list you can take in at a
 * glance beats a stack of paragraphs.
 */

export const FIELD =
  "w-full rounded-2xl border border-border/60 bg-card/60 px-3.5 py-2.5 text-[13.5px] text-foreground outline-none backdrop-blur-sm transition-colors placeholder:text-muted-foreground/60 focus:border-[var(--brand-green)] focus:bg-card/80";

export function Section({
  title,
  desc,
  children,
  className,
}: {
  title: string;
  desc?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("glass-card p-5 sm:p-6", className)}>
      <h2 className="text-[15px] leading-snug text-heading">{title}</h2>
      {desc && (
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
          {desc}
        </p>
      )}
      {children}
    </section>
  );
}

/** A quiet label above a field, matching the eyebrows used across the app. */
export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
      {children}
    </p>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <motion.button
      type={type}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      disabled={disabled}
      onClick={onClick}
      style={{ backgroundColor: "var(--brand-green-strong)" }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40",
        className
      )}
    >
      {children}
    </motion.button>
  );
}

export function QuietButton({
  children,
  onClick,
  disabled,
  tone = "normal",
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /** `danger` for the things that cannot be undone. */
  tone?: "normal" | "danger";
  className?: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12.5px] font-medium transition-colors disabled:opacity-40",
        tone === "danger"
          ? "border-red-500/30 text-red-600 hover:bg-red-500/10 dark:text-red-400"
          : "border-border/60 text-muted-foreground hover:bg-accent/60 hover:text-foreground",
        className
      )}
    >
      {children}
    </motion.button>
  );
}

export function Toggle({
  label,
  desc,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
          {desc}
        </p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={onChange}
        className={cn(
          "relative h-[22px] w-10 shrink-0 rounded-full p-0 transition-colors disabled:opacity-40",
          checked ? "bg-[var(--brand-green-strong)]" : "bg-border"
        )}
      >
        <span
          // left-0 matters: without a horizontal origin the knob starts at the
          // button's default padding and rides off the end of the track.
          className={cn(
            "absolute left-0 top-[3px] h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-[21px]" : "translate-x-[3px]"
          )}
        />
      </button>
    </div>
  );
}

/** A one-line result under an action: what just happened, or what went wrong. */
export function Note({
  text,
  bad,
  quiet,
}: {
  text: string | null;
  bad?: boolean;
  /** Advice rather than an outcome — green would read as "that worked". */
  quiet?: boolean;
}) {
  if (!text) return null;
  return (
    <p
      role={quiet ? undefined : "status"}
      className={cn(
        "mt-3 text-[12px] leading-relaxed",
        bad
          ? "text-red-600 dark:text-red-400"
          : quiet
            ? "text-muted-foreground"
            : "text-[var(--brand-green-ink)]"
      )}
    >
      {text}
    </p>
  );
}
