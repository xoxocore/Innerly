"use client";

import { useApp } from "@/state/app-context";
import { ErrorBoundary } from "@/components/error-boundary";
import { AppShell } from "@/features/app-shell/app-shell";
import { Dashboard } from "@/features/dashboard/dashboard";
import { Reflect } from "@/features/reflect/reflect";
import { DailyPlan } from "@/features/daily-plan/daily-plan";
import { Manifestation } from "@/features/manifestation/manifestation";
import { VisionBoard } from "@/features/vision-board/vision-board";
import { Blog } from "@/features/blog/blog";
import { Tutorials } from "@/features/tutorials/tutorials";
import { History } from "@/features/history/history";
import { Settings } from "@/features/settings/settings";

export function AppRouter() {
  const { route } = useApp();

  return (
    <AppShell>
      {/* keyed per view so navigating to another screen always recovers */}
      <ErrorBoundary key={route.view}>
        {route.view === "dashboard" && <Dashboard />}
        {route.view === "reflect" && <Reflect />}
        {route.view === "daily-plan" && <DailyPlan />}
        {route.view === "manifestation" && <Manifestation />}
        {route.view === "vision-board" && <VisionBoard />}
        {route.view === "blog" && <Blog />}
        {route.view === "tutorials" && <Tutorials />}
        {route.view === "history" && <History />}
        {route.view === "settings" && <Settings />}
      </ErrorBoundary>
    </AppShell>
  );
}
