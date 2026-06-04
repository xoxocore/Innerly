"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Heart,
  Bold,
  Underline,
  Highlighter,
} from "lucide-react";
import { MultiAdd } from "@/components/innerly/multi-add";
import { AutoTextarea } from "@/components/innerly/auto-textarea";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { useApp } from "@/state/app-context";
import { useReflections, uid } from "@/state/use-data";
import type { Reflection } from "@/lib/types";

const c = copy.reflect;

// soft, calm ease (cubic-bezier)
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// Warm, calm accent palette — intentionally no corporate blue.
const SOFT = [
  { dot: "#f4a6c0", soft: "#fde4ee", softDark: "#3a2630" }, // rose
  { dot: "#f6b89c", soft: "#fdeae0", softDark: "#3a2c24" }, // peach
  { dot: "#cda9ec", soft: "#efe6fb", softDark: "#2e2740" }, // lavender
  { dot: "#f3cd86", soft: "#fdf1d8", softDark: "#3a3120" }, // honey
  { dot: "#a9dcc9", soft: "#e4f5ef", softDark: "#1f3a33" }, // sage
];

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function RosyGlow({ night, className }: { night: boolean; className?: string }) {
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

// Liquid-glass writing card that lifts off the glassy background.
const glassCard =
  "relative overflow-hidden rounded-3xl bg-card/55 p-6 ring-1 ring-white/60 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.32),inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-2xl sm:p-8 dark:ring-white/10 dark:shadow-[0_24px_60px_-28px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)]";

const writeBox =
  "w-full resize-none rounded-2xl border border-border/60 bg-card/60 px-4 py-3 text-sm leading-relaxed text-foreground outline-none backdrop-blur-sm transition-colors placeholder:text-muted-foreground/60 focus:border-[#f4c4d6] focus:bg-card/80 dark:focus:border-[#3a2a30]";

export function Reflect() {
  const { navigate, night } = useApp();
  const [, setReflections] = useReflections();

  const [step, setStep] = useState(0); // 0..3
  const [done, setDone] = useState(false);
  const [moments, setMoments] = useState<string[]>([""]);
  const [whys, setWhys] = useState<Record<number, string>>({});
  const [reviewParts, setReviewParts] = useState<Record<number, string>>({});
  const [nexts, setNexts] = useState<Record<number, string[]>>({});

  const cleanMoments = moments.map((m) => m.trim()).filter(Boolean);
  const canContinue = cleanMoments.length > 0;

  // Starting HTML for a Pause & Review card (the user then marks it up).
  const partBase = (m: string, why?: string) =>
    `<p>${esc(m)}</p>` +
    (why ? `<p style="color:var(--muted-foreground)">${esc(why)}</p>` : "");

  const save = () => {
    const review = cleanMoments
      .map(
        (m, i) =>
          `<section>${reviewParts[i] ?? partBase(m, whys[i]?.trim())}</section>`
      )
      .join("");
    const reflection: Reflection = {
      id: uid(),
      date: new Date().toISOString(),
      moments: cleanMoments.map((text, i) => {
        const points = (nexts[i] ?? []).map((s) => s.trim()).filter(Boolean);
        return { text, why: whys[i] ?? "", next: points.length ? points : undefined };
      }),
      // keep a combined string for the dashboard "reminders" + history
      differently: cleanMoments
        .flatMap((_, i) => (nexts[i] ?? []).map((s) => s.trim()).filter(Boolean))
        .join(" · "),
      review: review || undefined,
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
            <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/10">
              <motion.div
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, #f7b8ce, var(--foreground))" }}
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
      <motion.div layout transition={{ duration: 0.4, ease: EASE }} className={glassCard}>
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <h2 className="text-[17px] leading-snug text-heading">{cur.title}</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{cur.hint}</p>

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
                    const dot = SOFT[i % SOFT.length].dot;
                    return (
                      <div key={i}>
                        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: dot }}
                          />
                          {m}
                        </p>
                        <AutoTextarea
                          value={whys[i] ?? ""}
                          onChange={(e) => setWhys((p) => ({ ...p, [i]: e.target.value }))}
                          placeholder="Because…"
                          className={cn("mt-2 min-h-[4.5rem]", writeBox)}
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
                  <ReviewToolbar night={night} />
                  <div className="mt-4 space-y-3">
                    {cleanMoments.map((m, i) => (
                      <ReviewCard
                        key={i}
                        color={SOFT[i % SOFT.length]}
                        night={night}
                        initialHtml={reviewParts[i] ?? partBase(m, whys[i]?.trim())}
                        onChange={(html) =>
                          setReviewParts((p) => ({ ...p, [i]: html }))
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  {cleanMoments.map((m, i) => {
                    const color = SOFT[i % SOFT.length];
                    const recap = reviewParts[i] ?? partBase(m, whys[i]?.trim());
                    return (
                      <div
                        key={i}
                        className="rounded-2xl border border-border/50 bg-card/40 p-4 backdrop-blur-sm"
                      >
                        {/* recap of steps 1–3 for this entry */}
                        <div className="flex items-start gap-2">
                          <span
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: color.dot }}
                          />
                          <div
                            className="rich-content min-w-0 flex-1 text-[13px] leading-relaxed text-foreground/90"
                            dangerouslySetInnerHTML={{ __html: recap }}
                          />
                        </div>

                        {/* per-entry next steps — add as many points as you like */}
                        <p className="mb-2 mt-4 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                          What I&apos;ll do next
                        </p>
                        <MultiAdd
                          values={nexts[i] ?? [""]}
                          onChange={(next) => setNexts((p) => ({ ...p, [i]: next }))}
                          placeholders={["Next time, I will… (speak to yourself kindly)"]}
                          addLabel="Add a point"
                        />
                      </div>
                    );
                  })}
                </div>
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

// Shared toolbar — applies formatting to whichever review card is focused.
// document.execCommand acts on the current selection in any contentEditable,
// and fires an `input` event so the focused card persists its change.
function ReviewToolbar({ night }: { night: boolean }) {
  const cmd = (command: string, value?: string) =>
    document.execCommand(command, false, value);

  const highlight = () => {
    try {
      document.execCommand("styleWithCSS", false, "true");
    } catch {
      /* ignore */
    }
    document.execCommand("hiliteColor", false, night ? "#5a3340" : "#ffd9e6");
  };

  const ToolBtn = ({
    onClick,
    label,
    children,
  }: {
    onClick: () => void;
    label: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()} // keep the text selection
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );

  return (
    <div className="mt-4 flex items-center gap-0.5 rounded-2xl border border-border/60 bg-card/60 px-2 py-1.5 backdrop-blur-sm">
      <ToolBtn onClick={() => cmd("bold")} label="Bold">
        <Bold className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn onClick={() => cmd("underline")} label="Underline">
        <Underline className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn onClick={highlight} label="Highlight">
        <Highlighter className="h-4 w-4" />
      </ToolBtn>
      <span className="ml-1.5 truncate text-[11px] text-muted-foreground">
        Select text in a card, then mark what stands out
      </span>
    </div>
  );
}

// One reviewable moment, in its own soft card — editable for highlights.
function ReviewCard({
  color,
  night,
  initialHtml,
  onChange,
}: {
  color: { dot: string; soft: string; softDark: string };
  night: boolean;
  initialHtml: string;
  onChange: (html: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialHtml || "<p></p>";
    // initialise once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ease: EASE }}
      className="rounded-2xl border-l-2 py-3 pl-4 pr-3"
      style={{
        borderColor: color.dot,
        backgroundColor: night ? color.softDark : color.soft,
      }}
    >
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerHTML ?? "")}
        className="rich-content min-h-[2rem] text-sm leading-relaxed text-foreground outline-none"
      />
    </motion.div>
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
