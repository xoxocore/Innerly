"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  NotebookPen,
  CalendarDays,
  Sparkles,
  Image as ImageIcon,
  ArrowRight,
  Check,
  Plus,
  ListChecks,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MultiAdd } from "@/components/innerly/multi-add";
import { copy, fill } from "@/lib/copy";
import { BLOG_POSTS, gradient } from "@/lib/content";
import { cn } from "@/lib/utils";
import { useApp } from "@/state/app-context";
import {
  useReflections,
  useTodayPlan,
  useRemindersChecked,
  type TodayItem,
} from "@/state/use-data";

const c = copy.dashboard;
const DONE_GREEN = "#34d399"; // soft, powdery green for completed items

const FEATURES = [
  { view: "reflect" as const, icon: NotebookPen, title: c.featureReflectTitle, desc: c.featureReflectDesc },
  { view: "daily-plan" as const, icon: CalendarDays, title: c.featureDailyPlanTitle, desc: c.featureDailyPlanDesc },
  { view: "manifestation" as const, icon: Sparkles, title: c.featureManifestationTitle, desc: c.featureManifestationDesc },
  { view: "vision-board" as const, icon: ImageIcon, title: c.featureVisionTitle, desc: c.featureVisionDesc },
];

// Soft, breathing powdery-turquoise glow (ambient motion behind the hero).
function TurquoiseGlow({ className }: { className?: string }) {
  return (
    <motion.div
      aria-hidden
      className={cn("pointer-events-none absolute -z-10 rounded-full blur-3xl", className)}
      style={{
        background:
          "radial-gradient(circle, rgba(45,212,191,0.30), rgba(94,234,212,0.12) 45%, rgba(45,212,191,0) 72%)",
      }}
      animate={{ opacity: [0.45, 0.8, 0.45], scale: [1, 1.12, 1] }}
      transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

export function Dashboard() {
  const { profile, navigate } = useApp();
  const [reflections] = useReflections();
  const [checked, setChecked] = useRemindersChecked();

  const name = profile?.firstName ?? "friend";
  const dateLabel = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const reminders = reflections
    .map((r) => r.differently?.trim())
    .filter(Boolean)
    .slice(-5) as string[];
  const actingOn = reminders.filter((r) => checked[r]).length;
  const latestPost = BLOG_POSTS[0];

  return (
    <div className="relative isolate space-y-10">
      <TurquoiseGlow className="-top-28 left-1/2 h-72 w-[42rem] -translate-x-1/2" />

      {/* Hero */}
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {c.breadcrumb}
        </p>
        <h1 className="mt-3 max-w-3xl text-[2.75rem] font-light leading-[1.08] tracking-tight text-heading">
          {fill(c.greeting, { name })}
        </h1>
        <p className="mt-3 inline-flex items-center gap-2 text-[15px] text-muted-foreground">
          <CalendarDays className="h-4 w-4" /> {dateLabel}
        </p>
      </header>

      {/* Feature cards — one row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {FEATURES.map(({ view, icon: Icon, title, desc }) => (
          <motion.button
            key={view}
            onClick={() => navigate(view)}
            whileHover={{ y: -4 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="group rounded-3xl border border-border bg-card p-5 text-left transition-shadow hover:shadow-[0_12px_40px_-12px_rgba(45,212,191,0.5)]"
          >
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-secondary text-foreground transition-colors group-hover:bg-[#ccfbf1] group-hover:text-[#0f766e]">
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-[17px] font-semibold leading-snug text-heading">
              {title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {desc}
            </p>
          </motion.button>
        ))}
      </div>

      {/* Today + Reminders */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TodoList dateLabel={dateLabel} onOpenPlan={() => navigate("daily-plan")} />

        {/* Reminders to yourself */}
        <Card className="p-6">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {c.remindersEyebrow}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-heading">{c.remindersTitle}</h2>
          <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
            {c.remindersDesc}
          </p>

          {reminders.length === 0 ? (
            <Button variant="secondary" className="mt-5" onClick={() => navigate("reflect")}>
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
                        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors"
                        style={{
                          borderColor: checked[r] ? DONE_GREEN : "var(--border)",
                          backgroundColor: checked[r] ? DONE_GREEN : "transparent",
                        }}
                      >
                        {checked[r] && <Check className="h-3 w-3 text-white" />}
                      </span>
                      <span className={cn(checked[r] && "text-muted-foreground line-through")}>
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
      </div>

      {/* Secondary: nightly check-in + blog */}
      <div className="grid gap-6 lg:grid-cols-2">
        <NightCheckIn />
        <button onClick={() => navigate("blog")} className="block w-full text-left">
          <Card className="h-full overflow-hidden transition-colors hover:bg-accent">
            <div
              className="h-24 w-full"
              style={{ backgroundImage: gradient(latestPost.gradient) }}
            />
            <div className="p-6">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {c.blogEyebrow}
              </p>
              <h3 className="mt-2 text-lg font-semibold text-heading">{latestPost.title}</h3>
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
    </div>
  );
}

// Today's plan — checklist styled after the "My Everyday" reference.
function TodoList({
  dateLabel,
  onOpenPlan,
}: {
  dateLabel: string;
  onOpenPlan: () => void;
}) {
  const today = useTodayPlan();
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");

  const submit = () => {
    today.addTask(value);
    setValue("");
  };

  return (
    <Card className="flex flex-col p-6">
      {/* header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-heading">
            {c.todayTitle}
          </h2>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" /> {dateLabel}
          </p>
        </div>
        <button
          onClick={onOpenPlan}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ListChecks className="h-4 w-4" /> All Tasks
        </button>
      </div>

      {/* rows */}
      <div className="mt-5 flex-1">
        {today.total === 0 ? (
          <p className="py-6 text-[15px] leading-relaxed text-muted-foreground">
            {c.todayEmpty}
          </p>
        ) : (
          <ul className="-mx-2">
            <AnimatePresence initial={false}>
              {today.items.map((item) => (
                <TodoRow key={`${item.source}-${item.id}`} item={item} onToggle={() => today.toggle(item)} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {/* add */}
      <div className="mt-4 border-t border-border pt-4">
        {adding ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => !value && setAdding(false)}
              placeholder="What's on for today?"
              className="flex-1 rounded-2xl border border-input bg-card px-4 py-2.5 text-[15px] outline-none focus:border-ring"
            />
            <Button type="submit" size="icon" aria-label="Add">
              <Plus className="h-5 w-5" />
            </Button>
          </form>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mx-auto flex items-center gap-2 text-[15px] font-medium text-foreground transition-colors hover:text-[#0f766e]"
          >
            <Plus className="h-5 w-5" /> Add Task
          </button>
        )}
      </div>
    </Card>
  );
}

function TodoRow({ item, onToggle }: { item: TodayItem; onToggle: () => void }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 rounded-2xl border-b border-border px-2 py-3.5 text-left last:border-b-0 hover:bg-accent/60"
      >
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate text-[15px] font-medium leading-snug text-foreground",
              item.done && "text-muted-foreground line-through"
            )}
          >
            {item.title}
          </p>
          {item.source === "goal" && item.goalTitle && (
            <p
              className={cn(
                "mt-0.5 truncate text-xs text-muted-foreground",
                item.done && "line-through"
              )}
            >
              {item.goalTitle}
            </p>
          )}
        </div>
        <motion.span
          whileTap={{ scale: 0.85 }}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-colors"
          style={{
            borderColor: item.done ? DONE_GREEN : "var(--border)",
            backgroundColor: item.done ? DONE_GREEN : "transparent",
          }}
        >
          {item.done && <Check className="h-4 w-4 text-white" />}
        </motion.span>
      </button>
    </motion.li>
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
          <p className="mt-4 text-[15px] font-medium text-foreground">{c.nightWritePrompt}</p>
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
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{c.nightSaved}</p>
      )}
      {phase === "skipped" && (
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{c.nightSkipped}</p>
      )}
    </Card>
  );
}
