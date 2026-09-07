"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { FileDown, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Mark } from "@/components/innerly/mark";
import { Wordmark } from "@/components/innerly/wordmark";
import { copy } from "@/lib/copy";
import { goalColor } from "@/lib/types";
import { useApp } from "@/state/app-context";
import { ReportBlock, Why } from "./report-body";
import { dayLabel, dayStamp, timeOf, type HistoryEntry } from "./use-history";

const c = copy.history;

function MicroLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </p>
  );
}

function ReflectionReport({ entry }: { entry: Extract<HistoryEntry, { kind: "reflection" }> }) {
  const { moments, differently, review } = entry.reflection;

  // Older entries kept only one joined string of next steps for the whole
  // reflection, before each moment carried its own. Split it back apart so
  // they still read as points rather than as one run-on line.
  const legacy =
    moments.every((m) => !m.next?.filter(Boolean).length) && differently
      ? differently.split(" · ").filter(Boolean)
      : [];

  return (
    <div className="space-y-6">
      {moments.map((m, i) => {
        const next = m.next?.filter(Boolean) ?? [];
        const steps = next.length ? next : i === 0 ? legacy : [];
        return (
          <article key={i} className="space-y-2.5">
            {moments.length > 1 && (
              <MicroLabel>Moment {i + 1}</MicroLabel>
            )}

            <ReportBlock tone="heavy">
              <p>{m.text}</p>
            </ReportBlock>

            {(m.why || review) && (
              <ReportBlock tone="why">
                <Why review={review} moment={m} index={i} />
              </ReportBlock>
            )}

            {steps.length > 0 && (
              <ReportBlock tone="next">
                <ol className="space-y-2">
                  {steps.map((n, j) => (
                    <li key={j} className="flex gap-2.5">
                      <span
                        aria-hidden
                        className="mt-[3px] grid h-[16px] w-[16px] shrink-0 place-items-center rounded-full text-[9.5px] font-bold tabular-nums"
                        style={{
                          backgroundColor: "var(--report-next-bar)",
                          color: "var(--report-next-ink)",
                        }}
                      >
                        {j + 1}
                      </span>
                      <span className="min-w-0 flex-1">{n}</span>
                    </li>
                  ))}
                </ol>
              </ReportBlock>
            )}
          </article>
        );
      })}
    </div>
  );
}

function ManifestationReport({
  entry,
}: {
  entry: Extract<HistoryEntry, { kind: "manifestation" }>;
}) {
  const m = entry.manifestation;
  const groups: [string, string[]][] = [
    ["Goals", m.goals],
    ["Affirmations", m.affirmations],
    ["Gratitude", m.gratitude],
    ["Released", m.releases],
  ];
  return (
    <div className="space-y-7">
      {groups
        .filter(([, list]) => list.filter(Boolean).length > 0)
        .map(([label, list]) => (
          <section key={label} className="space-y-2">
            <MicroLabel>{label}</MicroLabel>
            <ul className="space-y-1.5">
              {list.filter(Boolean).map((item, i) => (
                <li key={i} className="text-[17px] leading-relaxed text-foreground">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}

function ActivityReport({ entry }: { entry: Extract<HistoryEntry, { kind: "activity" }> }) {
  const { navigate } = useApp();
  const a = entry.activity;
  const accent = a.accent ? goalColor(a.accent) : null;

  return (
    <div className="space-y-6">
      <p className="text-[17px] leading-relaxed text-foreground">{a.text}</p>

      {a.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={a.image}
          alt={a.detail ?? ""}
          className="max-h-64 w-full rounded-2xl object-cover"
        />
      )}

      {a.detail && (
        <div className="flex items-center gap-2.5">
          {accent && (
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: accent.dot }}
            />
          )}
          <p className="text-[17px] leading-relaxed text-heading">{a.detail}</p>
        </div>
      )}

      {a.items && a.items.length > 0 && (
        <ul className="space-y-1.5">
          {a.items.map((it, i) => (
            <li key={i} className="text-[15px] leading-relaxed text-foreground">
              {it}
            </li>
          ))}
        </ul>
      )}

      <Button variant="secondary" onClick={() => navigate(a.target)}>
        {c.openIn.replace("{target}", a.targetLabel)}
      </Button>
    </div>
  );
}

const TITLES = {
  reflection: "Reflection",
  manifestation: "Manifestation",
  activity: "Activity",
} as const;

export function EntryReport({
  entry,
  onClose,
  onDelete,
}: {
  entry: HistoryEntry;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  // Escape closes, and the page behind must not scroll under the sheet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // An activity is a pointer to data living elsewhere, so it is dismissed
  // rather than deleted, and that needs no confirmation.
  const destructive = entry.kind !== "activity";

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="print-root fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-label={c.close}
        className="print-hide absolute inset-0 cursor-default bg-black/25 backdrop-blur-sm"
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={TITLES[entry.kind]}
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className="print-shell relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-border bg-card shadow-2xl sm:max-h-[86dvh] sm:max-w-2xl sm:rounded-3xl"
      >
        <div className="print-sheet flex min-h-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-4 border-b border-border/60 px-6 py-4">
            <span className="flex items-center gap-2">
              <Mark size={26} blink={false} />
              <Wordmark height={17} className="text-heading" />
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => window.print()}
                className="print-hide inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[12.5px] font-medium text-foreground transition-colors hover:bg-accent"
              >
                <FileDown className="h-3.5 w-3.5" />
                {c.exportPdf}
              </button>
              <button
                onClick={onClose}
                aria-label={c.close}
                className="print-hide grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-[18px] w-[18px]" />
              </button>
            </div>
          </header>

          <div className="print-body min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <p className="mb-4 text-[13.5px] text-muted-foreground">
              <span className="font-semibold text-heading">
                {TITLES[entry.kind]} entry
              </span>
              <span aria-hidden className="px-2 text-border">
                |
              </span>
              {dayLabel(entry.day)} &middot; {dayStamp(entry.day)}
              {entry.kind !== "activity" && " · " + timeOf(entry.at)}
            </p>
            {entry.kind === "reflection" && <ReflectionReport entry={entry} />}
            {entry.kind === "manifestation" && <ManifestationReport entry={entry} />}
            {entry.kind === "activity" && <ActivityReport entry={entry} />}
          </div>
        </div>

        <footer className="print-hide flex items-center justify-between gap-3 border-t border-border/60 px-6 py-4">
          <AnimatePresence mode="wait" initial={false}>
            {confirming ? (
              <motion.div
                key="confirm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2"
              >
                <Button size="sm" variant="destructive" onClick={onDelete}>
                  {c.deleteConfirm}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                  {c.cancel}
                </Button>
              </motion.div>
            ) : (
              <motion.button
                key="delete"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => (destructive ? setConfirming(true) : onDelete())}
                className="inline-flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                {destructive ? c.delete : c.dismiss}
              </motion.button>
            )}
          </AnimatePresence>

          <Button size="sm" variant="secondary" onClick={onClose}>
            {c.close}
          </Button>
        </footer>
      </motion.div>
    </div>,
    document.body
  );
}
