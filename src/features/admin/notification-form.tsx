"use client";

import { useState } from "react";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  deleteNotification, saveNotification,
  type Audience, type Notification, type NotificationKind, type Trigger,
} from "@/lib/notifications";
import { NotificationCard, KIND } from "@/features/notifications/card";

const AUDIENCES: { id: Audience; label: string; hint: string }[] = [
  { id: "everyone", label: "Everyone", hint: "Every account." },
  { id: "new", label: "Just joined", hint: "Signed up in the last week." },
  { id: "returning", label: "Been here a while", hint: "Signed up over a week ago." },
];

const TRIGGERS: { id: Trigger; label: string; hint: string }[] = [
  { id: "now", label: "Straight away", hint: "Appears as soon as you publish it." },
  { id: "scheduled", label: "At a time", hint: "Waits until the moment you pick." },
  { id: "on_signin", label: "When they arrive", hint: "Greets them as they open Innerly." },
];

const LINKS = [
  { id: "", label: "Nowhere" },
  { id: "reflect", label: "Reflect" },
  { id: "daily-plan", label: "Daily Plan" },
  { id: "vision-board", label: "Vision Board" },
  { id: "blog", label: "Blog" },
  { id: "tutorials", label: "Tutorials" },
];

export function NotificationForm({
  item,
  onClose,
}: {
  item: Notification | null;
  onClose: (changed: boolean) => void;
}) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [body, setBody] = useState(item?.body ?? "");
  const [kind, setKind] = useState<NotificationKind>(item?.kind ?? "news");
  const [audience, setAudience] = useState<Audience>(item?.audience ?? "everyone");
  const [trigger, setTrigger] = useState<Trigger>(item?.trigger ?? "now");
  const [when, setWhen] = useState(
    item?.scheduled_for ? item.scheduled_for.slice(0, 16) : ""
  );
  const [link, setLink] = useState(item?.link_view ?? "");
  const [previewName, setPreviewName] = useState("Divya");
  const [busy, setBusy] = useState<false | "draft" | "send">(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async (publish: boolean) => {
    setBusy(publish ? "send" : "draft");
    setError(null);
    try {
      await saveNotification({
        ...(item?.id ? { id: item.id } : {}),
        title: title.trim(),
        body: body.trim(),
        kind,
        audience,
        trigger,
        scheduled_for: trigger === "scheduled" && when ? new Date(when).toISOString() : null,
        link_view: link || null,
        published: publish,
      });
      onClose(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't save.");
      setBusy(false);
    }
  };

  const ready =
    title.trim().length > 0 && (trigger !== "scheduled" || when.length > 0);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button
          onClick={() => onClose(false)}
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All notifications
        </button>
        <span className="text-[13px] text-muted-foreground">
          {item ? (item.published ? "Live" : "Draft") : "New"}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => save(false)}
            disabled={!ready || !!busy}
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border px-3.5 text-[13px] font-medium transition-colors hover:bg-accent disabled:opacity-40"
          >
            {busy === "draft" && <Loader2 className="h-4 w-4 animate-spin" />}
            Save draft
          </button>
          <button
            onClick={() => save(true)}
            disabled={!ready || !!busy}
            style={{ backgroundColor: "var(--brand-green-strong)" }}
            className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy === "send" && <Loader2 className="h-4 w-4 animate-spin" />}
            {item?.published
              ? "Update"
              : trigger === "now"
                ? "Send it"
                : trigger === "scheduled"
                  ? "Schedule it"
                  : // Nothing is sent or queued for an arrival greeting — it
                    // starts applying to everyone who signs in from now on.
                    "Turn it on"}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-2xl bg-destructive/10 px-3.5 py-2.5 text-[12.5px] text-destructive">
          {error}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <Box label="Message">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Welcome back to Innerly, {name}"
              aria-label="Title"
              className={field}
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="A sentence or two. Optional."
              aria-label="Body"
              className="mt-2 w-full resize-none rounded-2xl border border-border bg-card px-4 py-3 text-[13.5px] leading-relaxed outline-none focus:border-[var(--brand-green)]"
            />
            <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
              Write <code className="rounded bg-secondary px-1 py-0.5 font-mono">{"{name}"}</code>{" "}
              anywhere and it becomes their first name. Somebody with no name
              set sees &ldquo;there&rdquo;.
            </p>
          </Box>

          <Box label="Style">
            <div className="flex gap-2">
              {(Object.keys(KIND) as NotificationKind[]).map((k) => {
                const Icon = KIND[k].icon;
                return (
                  <button
                    key={k}
                    onClick={() => setKind(k)}
                    className={cn(
                      "inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[12.5px] transition-colors",
                      kind === k
                        ? "border-[var(--brand-green)] bg-[var(--brand-green)]/8 font-medium text-foreground"
                        : "border-border text-muted-foreground hover:bg-accent"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {KIND[k].label}
                  </button>
                );
              })}
            </div>
          </Box>

          <Box label="Who gets it">
            <Choices options={AUDIENCES} value={audience} onChange={setAudience} />
          </Box>

          <Box label="When">
            <Choices options={TRIGGERS} value={trigger} onChange={setTrigger} />
            {trigger === "scheduled" && (
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                aria-label="When to send it"
                className={cn(field, "mt-2")}
              />
            )}
          </Box>

          <Box label="Tapping it opens">
            <select
              value={link}
              onChange={(e) => setLink(e.target.value)}
              aria-label="Tapping it opens"
              className={cn(field, "appearance-none")}
            >
              {LINKS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </Box>

          {item && (
            <div className="rounded-2xl border border-destructive/25 p-3.5">
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-[12.5px] text-muted-foreground">Delete this?</p>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="h-8 rounded-full px-3 text-[12.5px] text-muted-foreground hover:text-foreground"
                  >
                    Keep
                  </button>
                  <button
                    onClick={async () => {
                      await deleteNotification(item.id);
                      onClose(true);
                    }}
                    className="h-8 rounded-full bg-destructive px-3 text-[12.5px] font-medium text-white hover:opacity-90"
                  >
                    Delete
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete this
                </button>
              )}
            </div>
          )}
        </div>

        {/* The preview. Uses the same component the app renders, so this is the
            notification itself rather than a picture of one. */}
        <aside className="lg:sticky lg:top-[57px] lg:self-start">
          <div className="rounded-3xl border border-border bg-secondary/40 p-4">
            <p className="mb-3 text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Exactly what they&apos;ll see
            </p>

            <div className="rounded-2xl bg-card/60 p-2.5">
              <NotificationCard
                title={title || "Your title goes here"}
                body={body}
                kind={kind}
                name={previewName}
                unseen
                onDismiss={() => {}}
              />
            </div>

            <label className="mt-4 block text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Preview as
            </label>
            <input
              value={previewName}
              onChange={(e) => setPreviewName(e.target.value)}
              placeholder="A first name"
              aria-label="Preview as"
              className="mt-1.5 h-9 w-full rounded-xl border border-border bg-card px-3 text-[13px] outline-none focus:border-[var(--brand-green)]"
            />
            <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
              Try an empty name to see what somebody who never set one gets.
            </p>

            <div className="mt-4 border-t border-border/70 pt-3 text-[11.5px] leading-relaxed text-muted-foreground">
              <p>
                Goes to <strong className="text-foreground">
                  {AUDIENCES.find((a) => a.id === audience)?.label.toLowerCase()}
                </strong>
                ,{" "}
                {trigger === "scheduled"
                  ? when
                    ? `on ${new Date(when).toLocaleString()}`
                    : "at a time you have not picked yet"
                  : trigger === "on_signin"
                    ? "as they open Innerly"
                    : "as soon as you publish"}
                .
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

const field =
  "h-11 w-full rounded-2xl border border-border bg-card px-4 text-[13.5px] outline-none transition-colors focus:border-[var(--brand-green)]";

function Choices<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string; hint: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "rounded-xl border px-3.5 py-2.5 text-left transition-colors",
            value === o.id
              ? "border-[var(--brand-green)] bg-[var(--brand-green)]/8"
              : "border-border hover:bg-accent"
          )}
        >
          <span className="block text-[13px] font-medium text-foreground">{o.label}</span>
          <span className="mt-0.5 block text-[11.5px] text-muted-foreground">{o.hint}</span>
        </button>
      ))}
    </div>
  );
}

function Box({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="mb-2.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}
