"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Heart } from "lucide-react";
import { MultiAdd } from "@/components/innerly/multi-add";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { GOAL_COLORS } from "@/lib/types";
import { useApp } from "@/state/app-context";
import { useReflections, uid } from "@/state/use-data";
import type { Reflection } from "@/lib/types";

const c = copy.reflect;

// soft, calm ease (cubic-bezier)
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function RosyGlow({ night, className }: { night: boolean; className?: string }) {
  return (
    <motion.div
      aria-hidden
      className={cn("pointer-events-none absolute -z-10 rounded-full blur-3xl", className)}
      style={{
        background: night
          ? "radial-gradient(circle, rgba(196,206,234,0.22), transparent 70%)"
          : "radial-gradient(circle, rgba(255,201,220,0.50), rgba(255,224,234,0.20) 46%, transparent 72%)",
      }}
      animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.08, 1] }}
      transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

// gentle writing surface, shared by the textareas
const writeBox =
  "w-full resize-none rounded-2xl border border-border/60 bg-card/60 px-4 py-3 text-sm leading-relaxed text-foreground outline-none backdrop-blur-sm transition-colors placeholder:text-muted-foreground/60 focus:border-[#f4c4d6] focus:bg-card/80 dark:focus:border-[#3a2a30]";

export function Reflect() {
  const { navigate, night } = useApp();
  const [, setReflections] = useReflections();

  const [step, setStep] = useState(0); // 0..3
  const [done, setDone] = useState(false);
  const [moments, setMoments] = useState<string[]>([""]);
  const [whys, setWhys] = useState<Record<number, string>>({});
  const [differently, setDifferently] = useState("");

  const cleanMoments = moments.map((m) => m.trim()).filter(Boolean);
  const canContinue = cleanMoments.length > 0;

  const save = () => {
    const reflection: Reflection = {
      id: uid(),
      date: new Date().toISOString(),
      moments: cleanMoments.map((text, i) => ({ text, why: whys[i] ?? "" })),
      differently: differently.trim(),
    };
    setReflections((prev) => [...prev, reflection]);
    setDone(true);
  };

  if (done) return <Completion night={night} onNavigate={navigate} />;

  const steps = [
    { title: c.step1Title, hint: c.step1Hint },
    { title: c.step2Title, hint: c.step2Hint },
    { title: c.step3Title, hint: c.step3Hint },
    { title: c.step4Title, hint: c.step4Hint },
  ];
  const cur = steps[step];

  return (
    <div className="relative isolate">
      <RosyGlow night={night} className="-top-16 left-1/2 h-64 w-[34rem] -translate-x-1/2" />

      {/* Calm header */}
      <header className="mb-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {c.breadcrumb}
        </p>
        <h1 className="title-regular mt-2.5 text-[1.6rem] leading-[1.15] tracking-tight text-heading sm:text-[1.9rem]">
          {c.title}
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          {c.subtitle}
        </p>
      </header>

      {/* Progress */}
      <div className="mb-5">
        <div className="flex gap-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/10"
            >
              <motion.div
                className="h-full rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, #f7b8ce, var(--foreground))",
                }}
                initial={false}
                animate={{ width: i <= step ? "100%" : "0%" }}
                transition={{ duration: 0.5, ease: EASE }}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Step {step + 1} of {steps.length}
        </p>
      </div>

      {/* Glass writing card */}
      <motion.div
        layout
        transition={{ duration: 0.4, ease: EASE }}
        className="relative overflow-hidden rounded-3xl border border-border/50 bg-card/45 p-6 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.18)] backdrop-blur-2xl sm:p-8"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <h2 className="text-[17px] leading-snug text-heading">{cur.title}</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              {cur.hint}
            </p>

            <div className="mt-6">
              {step === 0 && (
                <MultiAdd
                  values={moments}
                  onChange={setMoments}
                  placeholders={c.momentPlaceholders}
                  addLabel={copy.manifestation.addAnother}
                />
              )}

              {step === 1 && (
                <div className="space-y-5">
                  {cleanMoments.map((m, i) => {
                    const dot = GOAL_COLORS[i % GOAL_COLORS.length].dot;
                    return (
                      <div key={i}>
                        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: dot }}
                          />
                          {m}
                        </p>
                        <textarea
                          value={whys[i] ?? ""}
                          onChange={(e) =>
                            setWhys((p) => ({ ...p, [i]: e.target.value }))
                          }
                          rows={3}
                          placeholder="Because…"
                          className={cn("mt-2", writeBox)}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {step === 2 && (
                <div>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    {c.step3Intro}
                  </p>
                  <div className="mt-5 space-y-3">
                    {cleanMoments.map((m, i) => {
                      const color = GOAL_COLORS[i % GOAL_COLORS.length];
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.06, ease: EASE }}
                          className="rounded-2xl border-l-2 px-4 py-3 text-sm leading-relaxed"
                          style={{
                            borderColor: color.dot,
                            backgroundColor: night ? color.softDark : color.soft,
                          }}
                        >
                          <p className="font-medium text-foreground">{m}</p>
                          {whys[i]?.trim() && (
                            <p className="mt-1 text-muted-foreground">{whys[i]}</p>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 3 && (
                <textarea
                  value={differently}
                  onChange={(e) => setDifferently(e.target.value)}
                  rows={6}
                  placeholder="Next time, I will… (speak to yourself kindly)"
                  className={writeBox}
                  autoFocus
                />
              )}
            </div>

            {step === 0 && !canContinue && (
              <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
                {c.gentleGate}
              </p>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="mt-7 flex items-center justify-between gap-3">
          {step > 0 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          ) : (
            <span />
          )}

          {step < 3 ? (
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              disabled={step === 0 && !canContinue}
              onClick={() => setStep((s) => s + 1)}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {c.continueLabel}
              <ArrowRight className="h-4 w-4" />
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={save}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Check className="h-4 w-4" /> {c.saveLabel}
            </motion.button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function Completion({
  night,
  onNavigate,
}: {
  night: boolean;
  onNavigate: (v: "daily-plan" | "dashboard") => void;
}) {
  return (
    <div className="relative isolate flex min-h-[62vh] flex-col items-center justify-center px-6 text-center">
      <RosyGlow night={night} className="top-1/4 left-1/2 h-72 w-[30rem] -translate-x-1/2" />

      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="grid h-14 w-14 place-items-center rounded-full"
        style={{ backgroundColor: night ? "#3a2a30" : "#fbe0ea" }}
      >
        <Heart
          className="h-6 w-6"
          style={{ color: night ? "#e8a9bf" : "#d6608a" }}
          fill="currentColor"
        />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.5, ease: EASE }}
        className="mt-6 max-w-md text-2xl font-normal leading-snug tracking-tight text-heading"
      >
        {c.completionTitle}
      </motion.h2>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.24, duration: 0.5, ease: EASE }}
        className="mt-8 flex w-full max-w-xs flex-col gap-3"
      >
        <button
          onClick={() => onNavigate("daily-plan")}
          className="rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          {c.completionContinue}
        </button>
        <button
          onClick={() => onNavigate("dashboard")}
          className="rounded-full px-5 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {c.completionBack}
        </button>
      </motion.div>
    </div>
  );
}
