"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";
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

type NavItem = { view: View; label: string; icon: typeof Home };

const MAIN: NavItem[] = [
  { view: "dashboard", label: copy.nav.dashboard, icon: Home },
  { view: "reflect", label: copy.nav.reflect, icon: NotebookPen },
  { view: "daily-plan", label: copy.nav.dailyPlan, icon: Calendar },
  { view: "manifestation", label: copy.nav.manifestation, icon: Sparkles },
  { view: "vision-board", label: copy.nav.visionBoard, icon: ImageIcon },
];

const LIBRARY: NavItem[] = [
  { view: "blog", label: copy.nav.blog, icon: BookOpen },
  { view: "tutorials", label: copy.nav.tutorials, icon: GraduationCap },
  { view: "history", label: copy.nav.history, icon: Clock },
  { view: "settings", label: copy.nav.settings, icon: Settings },
];

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <RippleMark className="h-9 w-9" />
      <div className="leading-tight">
        <p className="text-base font-medium tracking-tight text-heading">
          {copy.brand.appName}
        </p>
        <p className="text-[11px] text-muted-foreground">{copy.brand.tagline}</p>
      </div>
    </div>
  );
}

function NavLink({ item, layoutId }: { item: NavItem; layoutId: string }) {
  const { route, navigate } = useApp();
  const active = route.view === item.view;
  const Icon = item.icon;
  return (
    <button
      onClick={() => navigate(item.view)}
      className={cn(
        "group relative flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2 text-[13px] transition-colors",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      )}
    >
      {active && (
        <motion.span
          layoutId={layoutId}
          className="absolute inset-0 rounded-xl bg-secondary"
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
        />
      )}
      <Icon className="relative h-[17px] w-[17px] transition-transform duration-200 group-hover:scale-110" />
      <span className={cn("relative", active && "font-medium")}>{item.label}</span>
    </button>
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
        <span className="text-[13px] text-muted-foreground">{label}</span>
      </div>
      <button
        onClick={toggleNight}
        aria-label="Toggle night mode"
        className="grid h-9 w-9 place-items-center rounded-full border border-border/70 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        {night ? <Sun className="h-[17px] w-[17px]" /> : <Moon className="h-[17px] w-[17px]" />}
      </button>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1 mt-5 px-3 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/80">
      {children}
    </p>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      {/* Desktop sidebar — translucent glass */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:gap-7 lg:border-r lg:border-border/60 lg:bg-card/50 lg:p-5 lg:backdrop-blur-xl">
        <Brand />
        <nav className="flex flex-1 flex-col gap-0.5">
          {MAIN.map((item) => (
            <NavLink key={item.view} item={item} layoutId="nav-active-v" />
          ))}
          <SectionLabel>{copy.brand.libraryLabel}</SectionLabel>
          {LIBRARY.map((item) => (
            <NavLink key={item.view} item={item} layoutId="nav-active-v" />
          ))}
        </nav>
        <StreakNightRow />
      </aside>

      {/* Mobile top bar — glass, sticky */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-card/60 p-4 backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-between">
          <Brand />
          <StreakNightRow />
        </div>
        <nav className="mt-3 flex gap-1 overflow-x-auto pb-1">
          {[...MAIN, ...LIBRARY].map((item) => (
            <NavLink key={item.view} item={item} layoutId="nav-active-h" />
          ))}
        </nav>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 lg:py-12">
          {children}
        </div>
      </main>
    </div>
  );
}
