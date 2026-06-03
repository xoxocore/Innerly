"use client";

import { useState } from "react";
import {
  NotebookPen,
  Calendar,
  Sparkles,
  Image as ImageIcon,
  ChevronRight,
  ArrowRight,
  Check,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MultiAdd } from "@/components/innerly/multi-add";
import { copy, fill } from "@/lib/copy";
import { BLOG_POSTS, gradient } from "@/lib/content";
import { goalColor } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/state/app-context";
import {
  useReflections,
  useTodayPlan,
  useRemindersChecked,
} from "@/state/use-data";

const c = copy.dashboard;

const FEATURES = [
  {
    view: "reflect" as const,
    icon: NotebookPen,
    title: c.featureReflectTitle,
    desc: c.featureReflectDesc,
  },
  {
    view: "daily-plan" as const,
    icon: Calendar,
    title: c.featureDailyPlanTitle,
    desc: c.featureDailyPlanDesc,
  },
  {
    view: "manifestation" as const,
    icon: Sparkles,
    title: c.featureManifestationTitle,
    desc: c.featureManifestationDesc,
  },
  {
    view: "vision-board" as const,
    icon: ImageIcon,
    title: c.featureVisionTitle,
    desc: c.featureVisionDesc,
  },
];

export function Dashboard() {
  const { profile, navigate } = useApp();
  const [reflections] = useReflections();
  const today = useTodayPlan();
  const [checked, setChecked] = useRemindersChecked();

  const name = profile?.firstName ?? "friend";

  // Reminders are the "what to do differently" lines drawn from past reflections.
  const reminders = reflections
    .map((r) => r.differently?.trim())
    .filter(Boolean)
    .slice(-5) as string[];
  const actingOn = reminders.filter((r) => checked[r]).length;

  const latestPost = BLOG_POSTS[0];

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {c.breadcrumb}
        </p>
        <h1 className="mt-3 text-[2.5rem] font-bold leading-[1.1] tracking-tight text-heading">
          {fill(c.greeting, { name })}
        </h1>
      </header>

      {/* Feature cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map(({ view, icon: Icon, title, desc }) => (
          <button key={view} onClick={() => navigate(view)} className="text-left">
            <Card className="h-full p-6 transition-colors hover:bg-accent">
              <Icon className="h-6 w-6 text-foreground" />
              <h3 className="mt-4 text-lg font-semibold text-heading">{title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
                {desc}
              </p>
            </Card>
          </button>
        ))}
      </div>

      {/* Today's plan — synced with Daily Plan's Today list */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-heading">{c.todayTitle}</h2>
          <div className="flex items-center gap-3">
            {today.total > 0 && (
              <span className="text-sm tabular-nums text-muted-foreground">
                {today.done} of {today.total}
              </span>
            )}
            <button
              onClick={() => navigate("daily-plan")}
              className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {c.todayOpenLink}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {today.total === 0 ? (
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            {c.todayEmpty}
          </p>
        ) : (
          <ul className="mt-4 space-y-1">
            {today.items.map((item) => {
              const accent = item.color ? goalColor(item.color) : null;
              return (
                <li key={`${item.source}-${item.id}`}>
                  <button
                    onClick={() => today.toggle(item)}
                    className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-accent"
                  >
                    <span
                      className={cn(
                        "grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors",
                        !accent && item.done && "border-foreground bg-foreground text-background",
                        !accent && !item.done && "border-border"
                      )}
                      style={
                        accent
                          ? {
                              borderColor: accent.dot,
                              backgroundColor: item.done ? accent.dot : "transparent",
                            }
                          : undefined
                      }
                    >
                      {item.done && (
                        <Check className={cn("h-3 w-3", accent && "text-white")} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block text-[15px] leading-snug",
                          item.done && "text-muted-foreground line-through"
                        )}
                      >
                        {item.title}
                      </span>
                      {item.source === "goal" && (
                        <span className="block text-xs text-muted-foreground">
                          {item.goalTitle || "Untitled goal"}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Reminders to yourself */}
      <Card className="p-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {c.remindersEyebrow}
        </p>
        <h2 className="mt-2 text-lg font-semibold text-heading">
          {c.remindersTitle}
        </h2>
        <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
          {c.remindersDesc}
        </p>

        {reminders.length === 0 ? (
          <Button
            variant="secondary"
            className="mt-5"
            onClick={() => navigate("reflect")}
          >
            {c.remindersCta}
          </Button>
        ) : (
          <>
            <ul className="mt-5 space-y-2.5">
              {reminders.map((r) => (
                <li key={r}>
                  <button
                    onClick={() => setChecked((p) => ({ ...p, [r]: !p[r] }))}
                    className="flex w-full items-start gap-3 text-left text-[15px] leading-relaxed"
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors",
                        checked[r]
                          ? "border-foreground bg-foreground text-background"
                          : "border-border"
                      )}
                    >
                      {checked[r] && "✓"}
                    </span>
                    <span className={cn(checked[r] && "text-muted-foreground")}>
                      {r}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">
              {actingOn === reminders.length
                ? c.remindersAllClear
                : `${actingOn} of ${reminders.length} — ${c.remindersProgress}`}
            </p>
          </>
        )}
      </Card>

      <NightCheckIn />

      {/* Blog teaser */}
      <button onClick={() => navigate("blog")} className="block w-full text-left">
        <Card className="overflow-hidden transition-colors hover:bg-accent">
          <div
            className="h-28 w-full"
            style={{ backgroundImage: gradient(latestPost.gradient) }}
          />
          <div className="p-6">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {c.blogEyebrow}
            </p>
            <h3 className="mt-2 text-lg font-semibold text-heading">
              {latestPost.title}
            </h3>
            <p className="mt-1.5 line-clamp-2 text-[15px] leading-relaxed text-muted-foreground">
              {latestPost.excerpt}
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-foreground">
              {c.blogReadMore}
              <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </Card>
      </button>
    </div>
  );
}

function NightCheckIn() {
  const [reflections, setReflections] = useReflections();
  const [phase, setPhase] = useState<"ask" | "write" | "saved" | "skipped">("ask");
  const [notes, setNotes] = useState<string[]>([""]);

  const save = () => {
    const clean = notes.map((n) => n.trim()).filter(Boolean);
    if (clean.length) {
      setReflections((prev) => [
        ...prev,
        {
          id: Date.now().toString(36),
          date: new Date().toISOString(),
          moments: [],
          differently: clean.join(" · "),
        },
      ]);
    }
    setPhase("saved");
  };

  return (
    <Card className="p-6">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {c.nightEyebrow}
      </p>
      <h2 className="mt-2 text-lg font-semibold text-heading">{c.nightTitle}</h2>

      {phase === "ask" && (
        <>
          <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
            {c.nightAsk}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={() => setPhase("write")}>{c.nightYes}</Button>
            <Button variant="secondary" onClick={() => setPhase("skipped")}>
              {c.nightNo}
            </Button>
          </div>
        </>
      )}

      {phase === "write" && (
        <>
          <p className="mt-4 text-[15px] font-medium text-foreground">
            {c.nightWritePrompt}
          </p>
          <div className="mt-3">
            <MultiAdd
              values={notes}
              onChange={setNotes}
              placeholders={c.nightPlaceholders}
              addLabel={copy.manifestation.addAnother}
            />
          </div>
          <Button className="mt-5" onClick={save}>
            {c.nightSave}
          </Button>
        </>
      )}

      {phase === "saved" && (
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          {c.nightSaved}
        </p>
      )}
      {phase === "skipped" && (
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          {c.nightSkipped}
        </p>
      )}
    </Card>
  );
}
