"use client";

import { type ReactNode } from "react";
import {
  Home,
  NotebookPen,
  Calendar,
  Sparkles,
  Image as ImageIcon,
  BookOpen,
  GraduationCap,
  Clock,
  Settings,
  Moon,
  Sun,
} from "lucide-react";
import { RippleMark } from "@/components/innerly/ripple-mark";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { useApp, type View } from "@/state/app-context";

const NAV: { view: View; label: string; icon: typeof Home }[] = [
  { view: "dashboard", label: copy.nav.dashboard, icon: Home },
  { view: "reflect", label: copy.nav.reflect, icon: NotebookPen },
  { view: "daily-plan", label: copy.nav.dailyPlan, icon: Calendar },
  { view: "manifestation", label: copy.nav.manifestation, icon: Sparkles },
  { view: "vision-board", label: copy.nav.visionBoard, icon: ImageIcon },
  { view: "blog", label: copy.nav.blog, icon: BookOpen },
  { view: "tutorials", label: copy.nav.tutorials, icon: GraduationCap },
  { view: "history", label: copy.nav.history, icon: Clock },
  { view: "settings", label: copy.nav.settings, icon: Settings },
];

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <RippleMark className="h-10 w-10" />
      <div className="leading-tight">
        <p className="text-lg font-medium tracking-tight text-heading">
          {copy.brand.appName}
        </p>
        <p className="text-xs text-muted-foreground">{copy.brand.tagline}</p>
      </div>
    </div>
  );
}

function NavItems({ orientation }: { orientation: "v" | "h" }) {
  const { route, navigate } = useApp();
  return (
    <nav
      className={cn(
        orientation === "v"
          ? "flex flex-col gap-1"
          : "flex gap-1 overflow-x-auto pb-1"
      )}
    >
      {NAV.map(({ view, label, icon: Icon }) => {
        const active = route.view === view;
        return (
          <button
            key={view}
            onClick={() => navigate(view)}
            className={cn(
              "flex items-center gap-3 whitespace-nowrap rounded-2xl px-3.5 py-2.5 text-[15px] font-medium transition-colors",
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
            {label}
          </button>
        );
      })}
    </nav>
  );
}

function StreakNightRow() {
  const { night, toggleNight, streak } = useApp();
  const label = streak === 1 ? copy.brand.streakSingular : copy.brand.streakPlural;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-sm font-medium tabular-nums text-foreground">
          {streak}
        </span>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <button
        onClick={toggleNight}
        aria-label="Toggle night mode"
        className="grid h-10 w-10 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        {night ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-72 lg:shrink-0 lg:flex-col lg:gap-8 lg:border-r lg:border-border lg:p-6">
        <Brand />
        <div className="flex-1">
          <NavItems orientation="v" />
        </div>
        <StreakNightRow />
      </aside>

      {/* Mobile top bar */}
      <header className="border-b border-border p-4 lg:hidden">
        <div className="flex items-center justify-between">
          <Brand />
          <StreakNightRow />
        </div>
        <div className="mt-3">
          <NavItems orientation="h" />
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 lg:py-12">
          {children}
        </div>
      </main>
    </div>
  );
}
