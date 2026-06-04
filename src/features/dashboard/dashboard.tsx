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
  X,
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

// Liquid-glass feature tile with a sunrise glow that blooms from behind on hover
// (silver moonlight in night mode).
function FeatureCard({
  feature,
  night,
  onClick,
}: {
  feature: (typeof FEATURES)[number];
  night: boolean;
  onClick: () => void;
}) {
  const Icon = feature.icon;
  // soft powder-pink bloom (silver moonlight in night mode)
  const bloom = night
    ? "radial-gradient(62% 60% at 50% 0%, rgba(214,222,245,0.7), transparent 72%), radial-gradient(62% 56% at 50% 100%, rgba(194,206,234,0.6), transparent 74%)"
    : "radial-gradient(60% 58% at 50% 0%, rgba(255,201,220,0.63), transparent 72%), radial-gradient(60% 52% at 50% 100%, rgba(255,189,212,0.49), transparent 74%)";

  return (
    <motion.button
      onClick={onClick}
      variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 280, damping: 24 }}
      className="group relative rounded-2xl text-left"
    >
      {/* sunrise bloom behind the glass */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-4 -z-10 rounded-[2.25rem] opacity-0 blur-2xl transition-opacity duration-500 ease-out group-hover:opacity-100"
        style={{ background: bloom }}
      />
      {/* liquid glass surface */}
      <span className="relative block overflow-hidden rounded-2xl border border-border/50 bg-card/45 p-4 shadow-[0_8px_30px_-16px_rgba(15,23,42,0.18)] backdrop-blur-2xl transition-shadow duration-500 group-hover:shadow-[0_18px_44px_-18px_rgba(15,23,42,0.22)]">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary/80 text-foreground transition-colors duration-300 group-hover:bg-[#fbe0ea] group-hover:text-[#be185d] dark:group-hover:bg-white/10 dark:group-hover:text-[#cbd5e1]">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <h3 className="title-strong mt-3 text-sm leading-snug text-heading">
          {feature.title}
        </h3>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          {feature.desc}
        </p>
      </span>
    </motion.button>
  );
}

export function Dashboard() {
  const { profile, navigate, night } = useApp();
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
    <div className="space-y-8">
      {/* Hero */}
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {c.breadcrumb}
        </p>
        <h1 className="title-regular mt-2.5 max-w-3xl text-[2rem] leading-[1.12] tracking-tight text-heading sm:text-[2.5rem]">
          {fill(c.greeting, { name })}
        </h1>
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" /> {dateLabel}
        </p>
      </header>

      {/* Feature cards — liquid glass with a sunrise bloom on hover */}
      <motion.div
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-5 pt-2 md:grid-cols-4"
      >
        {FEATURES.map((f) => (
          <FeatureCard
            key={f.view}
            feature={f}
            night={night}
            onClick={() => navigate(f.view)}
          />
        ))}
      </motion.div>

      {/* Today + Reminders */}
      <div className="grid gap-5 lg:grid-cols-2">
        <TodoList dateLabel={dateLabel} onOpenPlan={() => navigate("daily-plan")} />

        {/* Reminders to yourself */}
        <Card className="border-border/60 bg-card/45 p-5 backdrop-blur-2xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {c.remindersEyebrow}
          </p>
          <h2 className="title-medium mt-1.5 text-sm text-heading">{c.remindersTitle}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            {c.remindersDesc}
          </p>

          {reminders.length === 0 ? (
            <Button variant="secondary" size="sm" className="mt-4" onClick={() => navigate("reflect")}>
              {c.remindersCta}
            </Button>
          ) : (
            <>
              <ul className="mt-4 space-y-2">
                {reminders.map((r) => (
                  <li key={r}>
                    <button
                      onClick={() => setChecked((p) => ({ ...p, [r]: !p[r] }))}
                      className="flex w-full items-start gap-3 text-left text-sm leading-relaxed"
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
              <p className="mt-3 text-[13px] text-muted-foreground">
                {actingOn === reminders.length
                  ? c.remindersAllClear
                  : `${actingOn} of ${reminders.length} — ${c.remindersProgress}`}
              </p>
            </>
          )}
        </Card>
      </div>

      {/* Secondary: nightly check-in + blog */}
      <div className="grid gap-5 lg:grid-cols-2">
        <NightCheckIn />
        <button onClick={() => navigate("blog")} className="block w-full text-left">
          <Card className="h-full overflow-hidden border-border/50 bg-card/45 backdrop-blur-2xl transition-colors hover:bg-accent/60">
            <div
              className="h-20 w-full"
              style={{ backgroundImage: gradient(latestPost.gradient) }}
            />
            <div className="p-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {c.blogEyebrow}
              </p>
              <h3 className="title-medium mt-1.5 text-sm text-heading">{latestPost.title}</h3>
              <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
                {latestPost.excerpt}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-foreground">
                {c.blogReadMore}
                <ArrowRight className="h-3.5 w-3.5" />
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
    <Card className="flex flex-col border-border/60 bg-card/45 p-5 backdrop-blur-2xl">
      {/* header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="title-medium text-sm tracking-tight text-heading">{c.todayTitle}</h2>
          <p className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" /> {dateLabel}
          </p>
        </div>
        <button
          onClick={onOpenPlan}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ListChecks className="h-3.5 w-3.5" /> All Tasks
        </button>
      </div>

      {/* rows */}
      <div className="mt-4 flex-1">
        {today.total === 0 ? (
          <p className="py-5 text-[13px] leading-relaxed text-muted-foreground">
            {c.todayEmpty}
          </p>
        ) : (
          <ul className="-mx-2">
            <AnimatePresence initial={false}>
              {[...today.items]
                .sort((a, b) => Number(a.done) - Number(b.done))
                .map((item) => (
                  <TodoRow
                    key={`${item.source}-${item.id}`}
                    item={item}
                    onToggle={() => today.toggle(item)}
                    onRemove={() => today.remove(item)}
                  />
                ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {/* add */}
      <div className="mt-3 border-t border-border pt-3">
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
              className="flex-1 rounded-xl border border-input bg-card px-3.5 py-2 text-sm outline-none focus:border-ring"
            />
            <Button type="submit" size="icon" aria-label="Add" className="h-9 w-9">
              <Plus className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <motion.button
            onClick={() => setAdding(true)}
            whileHover="spin"
            initial="rest"
            animate="rest"
            className="mx-auto flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-[#be185d]"
          >
            <motion.span
              variants={{ rest: { rotate: 0 }, spin: { rotate: 360 } }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              className="inline-flex"
            >
              <Plus className="h-4 w-4" />
            </motion.span>
            Add Task
          </motion.button>
        )}
      </div>
    </Card>
  );
}

function TodoRow({
  item,
  onToggle,
  onRemove,
}: {
  item: TodayItem;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 42 }}
      className="group flex items-center gap-3 border-b border-border px-2 py-3 last:border-b-0"
    >
      <div
        onClick={onToggle}
        className="min-w-0 flex-1 cursor-pointer select-none"
      >
        <p
          className={cn(
            "truncate text-sm leading-snug text-foreground",
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

      <button
        onClick={onRemove}
        aria-label="Remove task"
        className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>

      <motion.button
        onClick={onToggle}
        whileTap={{ scale: 0.85 }}
        aria-label={item.done ? "Mark incomplete" : "Mark complete"}
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-colors"
        style={{
          borderColor: item.done ? DONE_GREEN : "var(--border)",
          backgroundColor: item.done ? DONE_GREEN : "transparent",
        }}
      >
        {item.done && <Check className="h-3.5 w-3.5 text-white" />}
      </motion.button>
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
    <Card className="border-border/60 bg-card/45 p-5 backdrop-blur-2xl">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {c.nightEyebrow}
      </p>
      <h2 className="title-medium mt-1.5 text-sm text-heading">{c.nightTitle}</h2>

      {phase === "ask" && (
        <>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            {c.nightAsk}
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Button size="sm" onClick={() => setPhase("write")}>{c.nightYes}</Button>
            <Button size="sm" variant="secondary" onClick={() => setPhase("skipped")}>
              {c.nightNo}
            </Button>
          </div>
        </>
      )}

      {phase === "write" && (
        <>
          <p className="mt-3 text-sm font-medium text-foreground">{c.nightWritePrompt}</p>
          <div className="mt-3">
            <MultiAdd
              values={notes}
              onChange={setNotes}
              placeholders={c.nightPlaceholders}
              addLabel={copy.manifestation.addAnother}
            />
          </div>
          <Button size="sm" className="mt-4" onClick={save}>
            {c.nightSave}
          </Button>
        </>
      )}

      {phase === "saved" && (
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{c.nightSaved}</p>
      )}
      {phase === "skipped" && (
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{c.nightSkipped}</p>
      )}
    </Card>
  );
}
