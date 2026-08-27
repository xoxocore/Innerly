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
import { RosyGlow } from "@/components/innerly/rosy-glow";
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

// One narrow column, so the writing card reads as a compact panel rather than
// a page-wide sheet — the shape a focused, one-question-at-a-time form wants.
const column = "mx-auto w-full max-w-[560px]";

const glassCard = "glass-card p-5 sm:p-6";

const writeBox =
  "w-full resize-none rounded-2xl border border-border/60 bg-card/60 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-foreground outline-none backdrop-blur-sm transition-colors placeholder:text-muted-foreground/60 focus:border-[var(--brand-green)] focus:bg-card/80";

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
    <div className={cn("relative isolate", column)}>
      <RosyGlow night={night} className="-top-16 left-1/2 h-64 w-[34rem] -translate-x-1/2" />

      {/* Calm header */}
      <header className="mb-5">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {c.breadcrumb}
        </p>
        <h1 className="title-regular mt-2 text-[1.35rem] leading-[1.15] tracking-tight text-heading sm:text-[1.5rem]">
          {c.title}
        </h1>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
          {c.subtitle}
        </p>
      </header>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex gap-1">
          {steps.map((_, i) => (
            <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/10">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: "var(--brand-green)" }}
                initial={false}
                animate={{ width: i <= step ? "100%" : "0%" }}
                transition={{ duration: 0.5, ease: EASE }}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
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
            <h2 className="text-[15px] leading-snug text-heading">{cur.title}</h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{cur.hint}</p>

            <div className="mt-5">
              {step === 0 && (
                <MultiAdd
                  values={moments}
                  onChange={setMoments}
                  placeholders={c.momentPlaceholders}
                  addLabel={copy.manifestation.addAnother}
                />
              )}

              {step === 1 && (
                <div className="space-y-4">
                  {cleanMoments.map((m, i) => {
                    const dot = SOFT[i % SOFT.length].dot;
                    return (
                      <div key={i}>
                        <p className="flex items-center gap-2 text-[13px] font-medium text-foreground">
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
                          className={cn("mt-1.5 min-h-[3.75rem]", writeBox)}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {step === 2 && (
                <div>
                  <p className="text-[12.5px] leading-relaxed text-muted-foreground">
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
                <div className="space-y-4">
                  {cleanMoments.map((m, i) => {
                    const color = SOFT[i % SOFT.length];
                    const recap = reviewParts[i] ?? partBase(m, whys[i]?.trim());
                    return (
                      <div
                        key={i}
                        className="rounded-2xl border border-border/50 bg-card/40 p-3.5 backdrop-blur-sm"
                      >
                        {/* recap of steps 1–3 for this entry */}
                        <div className="flex items-start gap-2">
                          <span
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: color.dot }}
                          />
                          <div
                            className="rich-content min-w-0 flex-1 text-[12.5px] leading-relaxed text-foreground/90"
                            dangerouslySetInnerHTML={{ __html: recap }}
                          />
                        </div>

                        {/* per-entry next steps — add as many points as you like */}
                        <p className="mb-2 mt-3.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
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
              <p className="mt-3.5 text-[12.5px] leading-relaxed text-muted-foreground">
                {c.gentleGate}
              </p>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between gap-3">
          {step > 0 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
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
              style={{ backgroundColor: "var(--brand-green)" }}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {c.continueLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={save}
              style={{ backgroundColor: "var(--brand-green)" }}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90"
            >
              <Check className="h-3.5 w-3.5" /> {c.saveLabel}
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
      className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );

  return (
    <div className="mt-3.5 flex items-center gap-0.5 rounded-2xl border border-border/60 bg-card/60 px-1.5 py-1 backdrop-blur-sm">
      <ToolBtn onClick={() => cmd("bold")} label="Bold">
        <Bold className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn onClick={() => cmd("underline")} label="Underline">
        <Underline className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn onClick={highlight} label="Highlight">
        <Highlighter className="h-4 w-4" />
      </ToolBtn>
      <span className="ml-1.5 truncate text-[10.5px] text-muted-foreground">
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
      className="rounded-2xl border-l-2 py-2.5 pl-3.5 pr-3"
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
        className="rich-content min-h-[1.75rem] text-[13px] leading-relaxed text-foreground outline-none"
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
        className="mt-5 max-w-sm text-[1.35rem] font-normal leading-snug tracking-tight text-heading"
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
          style={{ backgroundColor: "var(--brand-green)" }}
          className="rounded-full px-5 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
        >
          {c.completionContinue}
        </button>
        <button
          onClick={() => onNavigate("dashboard")}
          className="rounded-full px-5 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {c.completionBack}
        </button>
      </motion.div>
    </div>
  );
}
