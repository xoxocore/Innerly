"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Clock, Eye, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchAllNotifications, fetchNotificationCounts, type Notification,
} from "@/lib/notifications";
import { KIND } from "@/features/notifications/card";
import { NotificationForm } from "./notification-form";

const AUDIENCE_LABEL = {
  everyone: "everyone",
  new: "people who just joined",
  returning: "people who have been here a while",
} as const;

export function Notifications() {
  const [items, setItems] = useState<Notification[] | null>(null);
  const [counts, setCounts] = useState<Map<string, { seen: number; dismissed: number }>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ item: Notification | null } | null>(null);

  const load = useCallback(() => {
    Promise.all([fetchAllNotifications(), fetchNotificationCounts()])
      .then(([n, c]) => {
        setItems(n);
        setCounts(c);
        setError(null);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Could not load these.")
      );
  }, []);

  useEffect(load, [load]);

  if (editing) {
    return (
      <NotificationForm
        item={editing.item}
        onClose={(changed) => {
          setEditing(null);
          if (changed) load();
        }}
      />
    );
  }

  if (error)
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <p className="text-[13px] text-destructive">{error}</p>
      </div>
    );
  if (!items)
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-muted-foreground">
          Messages that appear on the bell inside Innerly.
        </p>
        <button
          onClick={() => setEditing({ item: null })}
          style={{ backgroundColor: "var(--brand-green-strong)" }}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Write one
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card px-5 py-16 text-center">
          <Bell className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-[13.5px] text-heading">Nothing sent yet</p>
          <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">
            Announce a feature, leave a tip, or greet people as they arrive. You
            see exactly what they will see before it goes anywhere.
          </p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-3xl border border-border bg-card">
          {items.map((n, i) => {
            const shape = KIND[n.kind] ?? KIND.news;
            const Icon = shape.icon;
            const c = counts.get(n.id);
            return (
              <li key={n.id} className={cn(i > 0 && "border-t border-border/70")}>
                <button
                  onClick={() => setEditing({ item: n })}
                  className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-accent/40 sm:px-5"
                >
                  <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full", shape.tint)}>
                    <Icon className="h-4 w-4" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[13.5px] font-medium text-heading">
                        {n.title || "Untitled"}
                      </span>
                      {!n.published && (
                        <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Draft
                        </span>
                      )}
                      {n.published && n.trigger === "scheduled" && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          <Clock className="h-2.5 w-2.5" /> Scheduled
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                      To {AUDIENCE_LABEL[n.audience]}
                      {n.trigger === "on_signin" && ", as they arrive"}
                      {n.trigger === "scheduled" && n.scheduled_for &&
                        `, ${new Date(n.scheduled_for).toLocaleString()}`}
                    </span>
                  </span>

                  {n.published && (
                    <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                      <span className="inline-flex items-center gap-1" title="People who saw it">
                        <Eye className="h-3.5 w-3.5" /> {c?.seen ?? 0}
                      </span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
