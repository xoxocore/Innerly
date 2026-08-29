"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { KEYS, storage, usePersistentState } from "@/lib/storage";
import { useApp } from "@/state/app-context";
import { TOUR_STEPS } from "./steps";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const PAD = 8;
const CARD_W = 300;

type Box = { top: number; left: number; width: number; height: number };

/**
 * A first-run walkthrough.
 *
 * Cuts a hole in a dimmed overlay around the thing being described, rather than
 * drawing a box on top of it: the real control stays visible and in place, so
 * what somebody is being shown is the app itself.
 *
 * Skippable at every step, from the button, the backdrop or Escape — a tour you
 * cannot leave is an obstacle, not an introduction.
 */
export function Tour() {
  const { navigate } = useApp();
  const [seen, setSeen, hydrated] = usePersistentState<boolean>(KEYS.tourSeen, false);
  const [running, setRunning] = useState(false);
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);

  // Settings restarts it by clearing the flag; this picks that up.
  useEffect(() => {
    if (!hydrated || seen || running) return;
    const timer = setTimeout(() => setRunning(true), 700);
    return () => clearTimeout(timer);
  }, [hydrated, seen, running]);

  const step = TOUR_STEPS[index];

  const finish = useCallback(() => {
    setRunning(false);
    setIndex(0);
    setBox(null);
    setSeen(true);
  }, [setSeen]);

  // Move to the step's screen, then measure its anchor once the screen has
  // actually rendered.
  useEffect(() => {
    if (!running || !step) return;
    if (step.view) navigate(step.view);

    let frame = 0;
    const measure = () => {
      if (!step.anchor) {
        setBox(null);
        return;
      }
      const el = document.querySelector(`[data-tour="${step.anchor}"]`);
      if (!el) {
        // Hidden at this width (the sidebar on a phone, say). A centred card
        // still teaches the point; a tour that dead-ends does not.
        setBox(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    frame = window.setTimeout(measure, step.view ? 320 : 0);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(frame);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, index]);

  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(TOUR_STEPS.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, finish]);

  // No "have we mounted yet" flag needed: `running` only becomes true from a
  // timer, which cannot fire on the server, so the first render is always null
  // on both sides.
  if (!running || !step || typeof document === "undefined") return null;

  const last = index === TOUR_STEPS.length - 1;

  // Below the anchor where there is room, above it where there is not, and
  // never off the side of a narrow screen.
  const card = (() => {
    if (!box) return null;
    const below = box.top + box.height + PAD + 12;
    const roomBelow = window.innerHeight - below > 200;
    const left = Math.min(
      Math.max(12, box.left + box.width / 2 - CARD_W / 2),
      Math.max(12, window.innerWidth - CARD_W - 12)
    );
    return roomBelow
      ? { top: below, left }
      : { top: Math.max(12, box.top - 12 - 190), left };
  })();

  return createPortal(
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Tour">
      {/* The dim. A cut-out via box-shadow keeps the real control interactive
          to the eye without cloning it. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={finish}
        className="absolute inset-0"
        style={
          box
            ? {
                background: "transparent",
                boxShadow: "0 0 0 9999px rgba(9, 14, 11, 0.55)",
                borderRadius: 14,
                top: box.top - PAD,
                left: box.left - PAD,
                width: box.width + PAD * 2,
                height: box.height + PAD * 2,
                position: "fixed",
              }
            : { background: "rgba(9, 14, 11, 0.55)" }
        }
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: EASE }}
          style={
            card
              ? { position: "fixed", top: card.top, left: card.left, width: CARD_W }
              : undefined
          }
          className={
            card
              ? "rounded-3xl border border-border bg-card p-5 shadow-xl"
              : "fixed left-1/2 top-1/2 w-[min(340px,calc(100vw-40px))] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-card p-6 shadow-xl"
          }
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[1.05rem] font-medium leading-snug text-heading">
              {step.title}
            </h2>
            <button
              onClick={finish}
              aria-label="Skip the tour"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            {step.body}
          </p>

          <div className="mt-5 flex items-center justify-between gap-3">
            <div className="flex gap-1.5" aria-hidden>
              {TOUR_STEPS.map((_, i) => (
                <span
                  key={i}
                  className={
                    "h-1.5 rounded-full transition-all " +
                    (i === index ? "w-5 bg-[var(--brand-green)]" : "w-1.5 bg-border")
                  }
                />
              ))}
            </div>

            <div className="flex items-center gap-1">
              {index > 0 && (
                <button
                  onClick={() => setIndex((i) => i - 1)}
                  aria-label="Back"
                  className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => (last ? finish() : setIndex((i) => i + 1))}
                style={{ backgroundColor: "var(--brand-green-strong)" }}
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
              >
                {last ? "Start writing" : "Next"}
                {!last && <ArrowRight className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {index === 0 && (
            <button
              onClick={finish}
              className="mt-3 w-full text-center text-[12.5px] text-muted-foreground hover:text-foreground"
            >
              Skip — I&apos;ll find my way
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body
  );
}

/** Settings uses this to offer the tour again. */
export function restartTour() {
  storage.write(KEYS.tourSeen, false);
}
