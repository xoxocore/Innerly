"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RippleMark } from "@/components/innerly/ripple-mark";
import { cn } from "@/lib/utils";
import { ONBOARDING_SLIDES } from "@/lib/content";
import { useApp } from "@/state/app-context";

export function Onboarding() {
  const { completeOnboarding } = useApp();
  const [step, setStep] = useState(0); // 0..slides-1, then name step
  const [name, setName] = useState("");

  const total = ONBOARDING_SLIDES.length;
  const onNameStep = step === total;
  const slide = ONBOARDING_SLIDES[step];

  return (
    <main className="flex min-h-dvh flex-col bg-background px-6 py-6">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col">
        {/* Progress + skip */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {ONBOARDING_SLIDES.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === step ? "w-7 bg-foreground" : "w-1.5 bg-foreground/15"
                )}
              />
            ))}
          </div>
          {!onNameStep && (
            <button
              onClick={() => setStep(total)}
              className="text-[15px] font-medium text-muted-foreground hover:text-foreground"
            >
              Skip
            </button>
          )}
        </div>

        {onNameStep ? (
          <div className="flex flex-1 flex-col justify-center">
            <div className="flex justify-center pb-10">
              <RippleMark className="aspect-square w-40" />
            </div>
            <h1 className="text-[2.25rem] font-normal leading-[1.1] tracking-tight text-heading">
              What should we call you?
            </h1>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
              Just a first name — this stays on your device.
            </p>
            <form
              className="mt-8"
              onSubmit={(e) => {
                e.preventDefault();
                completeOnboarding(name);
              }}
            >
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your first name"
                className="w-full rounded-3xl border border-input bg-card px-5 py-4 text-lg outline-none focus:border-ring"
              />
              <Button size="pill" type="submit" className="mt-4">
                Begin
              </Button>
            </form>
          </div>
        ) : (
          <>
            <div className="flex flex-1 flex-col">
              <div className="pt-10">
                <h1 className="max-w-md text-[2.75rem] font-normal leading-[1.1] tracking-tight text-heading">
                  {slide.title}
                </h1>
                <p className="mt-5 max-w-sm text-lg leading-relaxed text-muted-foreground">
                  {slide.body}
                </p>
              </div>
              <div className="flex flex-1 items-center justify-center py-10">
                <RippleMark className="aspect-square w-64" />
              </div>
            </div>
            <Button size="pill" onClick={() => setStep((s) => s + 1)}>
              {step === total - 1 ? "Get started" : "Continue"}
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
