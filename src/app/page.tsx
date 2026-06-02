"use client";

import { AppProvider, useApp } from "@/state/app-context";
import { Onboarding } from "@/features/onboarding/onboarding";
import { AppRouter } from "@/features/app-router";

function Gate() {
  const { signedIn, hydrated } = useApp();
  // Avoid a flash of the wrong screen before localStorage is read.
  if (!hydrated) return <div className="min-h-dvh bg-background" />;
  return signedIn ? <AppRouter /> : <Onboarding />;
}

export default function Page() {
  return (
    <AppProvider>
      <Gate />
    </AppProvider>
  );
}
