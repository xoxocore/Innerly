"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { MultiAdd } from "@/components/innerly/multi-add";
import { RosyGlow } from "@/components/innerly/rosy-glow";
import { copy } from "@/lib/copy";
import { useApp } from "@/state/app-context";
import { useManifestations } from "@/state/use-data";

const c = copy.manifestation;

// The same narrow column and glass surface the Reflect screen uses, so the two
// writing screens read as one place rather than two.
const column = "mx-auto w-full max-w-[560px]";

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section className="glass-card p-5 sm:p-6">
      <h2 className="text-[15px] leading-snug text-heading">{title}</h2>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
        {desc}
      </p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Manifestation() {
  const { navigate, night } = useApp();
  const [, setManifestations] = useManifestations();

  const [goals, setGoals] = useState<string[]>([""]);
  const [affirmations, setAffirmations] = useState<string[]>([""]);
  const [gratitude, setGratitude] = useState<string[]>([""]);
  const [releases, setReleases] = useState<string[]>([""]);
  const [saved, setSaved] = useState(false);

  const clean = (arr: string[]) => arr.map((s) => s.trim()).filter(Boolean);

  const save = () => {
    setManifestations((prev) => [
      ...prev,
      {
        goals: clean(goals),
        affirmations: clean(affirmations),
        gratitude: clean(gratitude),
        releases: clean(releases),
        savedAt: new Date().toISOString(),
      },
    ]);
    setSaved(true);
  };

  return (
    <div className={"relative isolate " + column}>
      <RosyGlow night={night} className="-top-16 left-1/2 h-64 w-[34rem] -translate-x-1/2" />

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

      <div className="space-y-4">
        <Section title={c.goalsTitle} desc={c.goalsDesc}>
          <MultiAdd
            values={goals}
            onChange={setGoals}
            placeholders={[c.goalPlaceholder]}
            addLabel={c.addAnother}
          />
        </Section>

        <Section title={c.affirmationsTitle} desc={c.affirmationsDesc}>
          <MultiAdd
            values={affirmations}
            onChange={setAffirmations}
            placeholders={c.affirmationPlaceholders}
            addLabel={c.affirmationsAddLabel}
          />
        </Section>

        <Section title={c.gratitudeTitle} desc={c.gratitudeDesc}>
          <MultiAdd
            values={gratitude}
            onChange={setGratitude}
            placeholders={c.gratitudePlaceholders}
            addLabel={c.gratitudeAddLabel}
          />
        </Section>

        <Section title={c.releaseTitle} desc={c.releaseDesc}>
          <MultiAdd
            values={releases}
            onChange={setReleases}
            placeholders={c.releasePlaceholders}
            addLabel={c.releaseAddLabel}
          />
        </Section>

        <div className="flex justify-end pt-1">
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            onClick={save}
            style={{ backgroundColor: "var(--brand-green-strong)" }}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90"
          >
            <Check className="h-3.5 w-3.5" /> {c.saveLabel}
          </motion.button>
        </div>
      </div>

      {saved && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-6 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="glass-card w-full max-w-sm p-6"
          >
            <h3 className="text-[15px] leading-snug text-heading">{c.savedTitle}</h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
              {c.savedText}
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={() => navigate("vision-board")}
                style={{ backgroundColor: "var(--brand-green-strong)" }}
                className="rounded-full px-4 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
              >
                {c.savedGoVision}
              </button>
              <button
                onClick={() => setSaved(false)}
                className="rounded-full px-4 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {c.savedLater}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
