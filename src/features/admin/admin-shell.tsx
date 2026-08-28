"use client";

import { useState } from "react";
import { BarChart3, LogOut, ScrollText, Users } from "lucide-react";
import { Mark } from "@/components/innerly/mark";
import { Wordmark } from "@/components/innerly/wordmark";
import { cn } from "@/lib/utils";
import { useAuth } from "@/state/auth-context";
import { Overview } from "./overview";
import { Accounts } from "./accounts";
import { ActivityLog } from "./activity-log";

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3, view: Overview },
  { id: "accounts", label: "Accounts", icon: Users, view: Accounts },
  { id: "log", label: "Activity", icon: ScrollText, view: ActivityLog },
] as const;

export function AdminShell() {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("overview");
  const View = TABS.find((t) => t.id === tab)!.view;

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-5 gap-y-3 px-5 py-3.5 sm:px-8">
          <div className="flex items-center gap-2">
            <Mark size={26} />
            <Wordmark height={18} />
            {/* Says plainly which side of the product you are looking at. */}
            <span className="ml-1 rounded-full border border-border/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Admin
            </span>
          </div>

          <nav className="order-3 flex w-full gap-1 sm:order-none sm:w-auto">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-1.5 text-[13px] transition-colors",
                    active
                      ? "bg-secondary font-medium text-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <Icon className="h-[15px] w-[15px]" />
                  {t.label}
                </button>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-[12px] text-muted-foreground sm:inline">
              {user?.email}
            </span>
            <button
              onClick={() => signOut()}
              aria-label="Sign out"
              title="Sign out"
              className="grid h-9 w-9 place-items-center rounded-full border border-border/70 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <LogOut className="h-[15px] w-[15px]" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 lg:py-10">
        <View />
      </main>

      <footer className="mx-auto w-full max-w-5xl px-5 pb-10 sm:px-8">
        <p className="border-t border-border/60 pt-5 text-[11.5px] leading-relaxed text-muted-foreground">
          This panel can see who signed up and how often they came back. It
          cannot see a word anyone wrote, and there is no way to make it —
          the database refuses, for admins too.
        </p>
      </footer>
    </div>
  );
}
