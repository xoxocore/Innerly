"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MultiAdd } from "@/components/innerly/multi-add";
import { ScreenHeader } from "@/components/innerly/screen-header";
import { copy } from "@/lib/copy";
import { useApp } from "@/state/app-context";
import { useManifestations } from "@/state/use-data";

const c = copy.manifestation;

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
    <Card className="p-6 sm:p-8">
      <h2 className="text-xl font-medium text-heading">{title}</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{desc}</p>
      <div className="mt-5">{children}</div>
    </Card>
  );
}

export function Manifestation() {
  const { navigate } = useApp();
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
    <div>
      <ScreenHeader breadcrumb={c.breadcrumb} title={c.title} subtitle={c.subtitle} />

      <div className="space-y-6">
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

        <Button size="pill" onClick={save}>
          {c.saveLabel}
        </Button>
      </div>

      {saved && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-6">
          <Card className="w-full max-w-md p-7">
            <h3 className="text-xl font-medium text-heading">{c.savedTitle}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
              {c.savedText}
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Button onClick={() => navigate("vision-board")}>
                {c.savedGoVision}
              </Button>
              <Button variant="ghost" onClick={() => setSaved(false)}>
                {c.savedLater}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
