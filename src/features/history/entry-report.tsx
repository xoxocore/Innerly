"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { goalColor } from "@/lib/types";
import { useApp } from "@/state/app-context";
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
  return (
    <div className="space-y-7">
      {moments.map((m, i) => (
        <section key={i} className="space-y-2">
          <MicroLabel>
            {moments.length > 1 ? `Moment ${i + 1}` : "What felt heavy"}
          </MicroLabel>
          <p className="text-[17px] leading-relaxed text-foreground">{m.text}</p>
          {m.why && (
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              Because {m.why}
            </p>
          )}
          {m.next && m.next.filter(Boolean).length > 0 && (
            <ul className="space-y-1.5 pt-1">
              {m.next.filter(Boolean).map((n, j) => (
                <li
                  key={j}
                  className="flex gap-2.5 text-[15px] leading-relaxed text-foreground"
                >
                  <span aria-hidden className="text-muted-foreground">
                    &rarr;
                  </span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {differently && (
        <section className="space-y-2">
          <MicroLabel>Next time</MicroLabel>
          <p className="text-[15px] leading-relaxed text-foreground">{differently}</p>
        </section>
      )}

      {review && (
        <section className="space-y-2">
          <MicroLabel>Pause &amp; review</MicroLabel>
          <div
            className="prose-innerly text-[15px] leading-relaxed text-foreground/90"
            dangerouslySetInnerHTML={{ __html: review }}
          />
        </section>
      )}
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-label={c.close}
        className="absolute inset-0 cursor-default bg-black/25 backdrop-blur-sm"
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={TITLES[entry.kind]}
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className="relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-border bg-card shadow-2xl sm:max-h-[86dvh] sm:max-w-xl sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border/60 px-6 py-5">
          <div className="min-w-0">
            <h2 className="text-lg font-medium text-heading">{TITLES[entry.kind]}</h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {dayLabel(entry.day)} &middot; {dayStamp(entry.day)}
              {entry.kind !== "activity" && " · " + timeOf(entry.at)}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={c.close}
            className="-mr-1.5 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {entry.kind === "reflection" && <ReflectionReport entry={entry} />}
          {entry.kind === "manifestation" && <ManifestationReport entry={entry} />}
          {entry.kind === "activity" && <ActivityReport entry={entry} />}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-border/60 px-6 py-4">
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
    </div>
  );
}
