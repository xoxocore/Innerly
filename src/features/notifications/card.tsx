"use client";

import { Megaphone, Lightbulb, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { render, type NotificationKind } from "@/lib/notifications";

export const KIND = {
  news: { icon: Megaphone, label: "News", tint: "text-[var(--brand-green-ink)] bg-[var(--brand-green)]/12" },
  tip: { icon: Lightbulb, label: "Tip", tint: "text-amber-700 bg-amber-500/12 dark:text-amber-300" },
  feature: { icon: Sparkles, label: "New", tint: "text-violet-700 bg-violet-500/12 dark:text-violet-300" },
} as const;

/**
 * One notification, exactly as somebody sees it.
 *
 * Shared with the composer's preview on purpose: a preview drawn separately is
 * a drawing of a notification, and drifts from the real one the first time
 * either is touched.
 */
export function NotificationCard({
  title,
  body,
  kind,
  name,
  unseen,
  onDismiss,
  onClick,
  className,
}: {
  title: string;
  body: string;
  kind: NotificationKind;
  /** Substituted into {name}. */
  name?: string;
  unseen?: boolean;
  onDismiss?: () => void;
  onClick?: () => void;
  className?: string;
}) {
  const shape = KIND[kind] ?? KIND.news;
  const Icon = shape.icon;

  return (
    <div
      className={cn(
        "relative flex gap-3 rounded-2xl border border-border bg-card p-3.5 text-left",
        onClick && "cursor-pointer transition-colors hover:bg-accent/40",
        className
      )}
      onClick={onClick}
    >
      {unseen && (
        <span
          aria-label="Not seen yet"
          className="absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--brand-green)]"
        />
      )}

      <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full", shape.tint)}>
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium leading-snug text-heading">
          {render(title, name) || "Untitled"}
        </p>
        {body && (
          <p className="mt-1 whitespace-pre-line text-[12.5px] leading-relaxed text-muted-foreground">
            {render(body, name)}
          </p>
        )}
      </div>

      {onDismiss && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          aria-label="Dismiss"
          className="grid h-7 w-7 shrink-0 place-items-center self-start rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
