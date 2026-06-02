"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MultiAdd } from "@/components/innerly/multi-add";
import { ScreenHeader } from "@/components/innerly/screen-header";
import { copy } from "@/lib/copy";
import { useApp } from "@/state/app-context";
import { useReflections, uid } from "@/state/use-data";
import type { Reflection } from "@/lib/types";

const c = copy.reflect;

export function Reflect() {
  const { navigate } = useApp();
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

  if (done) return <Completion onNavigate={navigate} />;

  const steps = [
    { title: c.step1Title, hint: c.step1Hint },
    { title: c.step2Title, hint: c.step2Hint },
    { title: c.step3Title, hint: c.step3Hint },
    { title: c.step4Title, hint: c.step4Hint },
  ];
  const cur = steps[step];

  return (
    <div>
      <ScreenHeader breadcrumb={c.breadcrumb} title={c.title} subtitle={c.subtitle} />

      {/* Step progress */}
      <div className="mb-6 flex gap-2">
        {steps.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= step ? "bg-foreground" : "bg-foreground/15"
            }`}
          />
        ))}
      </div>

      <Card className="p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-heading">{cur.title}</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
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
              {cleanMoments.map((m, i) => (
                <div key={i}>
                  <p className="text-[15px] font-medium text-foreground">{m}</p>
                  <textarea
                    value={whys[i] ?? ""}
                    onChange={(e) =>
                      setWhys((p) => ({ ...p, [i]: e.target.value }))
                    }
                    rows={3}
                    placeholder="Because…"
                    className="mt-2 w-full resize-none rounded-2xl border border-input bg-card px-4 py-3 text-[15px] leading-relaxed outline-none focus:border-ring"
                  />
                </div>
              ))}
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                {c.step3Intro}
              </p>
              <div className="mt-5 space-y-4">
                {cleanMoments.map((m, i) => (
                  <div
                    key={i}
                    className="rounded-2xl bg-secondary px-4 py-3 text-[15px] leading-relaxed"
                  >
                    <p className="font-medium text-foreground">{m}</p>
                    {whys[i]?.trim() && (
                      <p className="mt-1 text-muted-foreground">{whys[i]}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <textarea
              value={differently}
              onChange={(e) => setDifferently(e.target.value)}
              rows={6}
              placeholder="Next time, I will…"
              className="w-full resize-none rounded-2xl border border-input bg-card px-4 py-3 text-[15px] leading-relaxed outline-none focus:border-ring"
            />
          )}
        </div>

        {step === 0 && !canContinue && (
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {c.gentleGate}
          </p>
        )}

        <div className="mt-7 flex items-center justify-between gap-3">
          {step > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          ) : (
            <span />
          )}
          {step < 3 ? (
            <Button
              disabled={step === 0 && !canContinue}
              onClick={() => setStep((s) => s + 1)}
            >
              {c.continueLabel}
            </Button>
          ) : (
            <Button onClick={save}>{c.saveLabel}</Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function Completion({
  onNavigate,
}: {
  onNavigate: (v: "daily-plan" | "dashboard") => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h2 className="max-w-md text-3xl font-bold leading-tight tracking-tight text-heading">
        {c.completionTitle}
      </h2>
      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <Button onClick={() => onNavigate("daily-plan")}>
          {c.completionContinue}
        </Button>
        <Button variant="ghost" onClick={() => onNavigate("dashboard")}>
          {c.completionBack}
        </Button>
      </div>
    </div>
  );
}
