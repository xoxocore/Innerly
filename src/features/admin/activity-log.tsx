"use client";

import { Ban, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useActionLog, type AdminAction } from "./use-admin";

const SHAPE = {
  suspend: { icon: Ban, verb: "suspended", danger: false },
  unsuspend: { icon: RotateCcw, verb: "restored", danger: false },
  delete: { icon: Trash2, verb: "deleted", danger: true },
} as const;

/**
 * What has been done to whom, and why.
 *
 * Written by the server with the service key, so nothing in this panel can
 * edit or remove an entry — including the person who caused it. A log its
 * subject can rewrite is decoration.
 */
export function ActivityLog() {
  const { data, error, loading } = useActionLog();

  if (loading)
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  if (error)
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <p className="text-[13px] text-destructive">{error}</p>
      </div>
    );

  if (!data || data.length === 0) {
    return (
      <div className="rounded-3xl border border-border bg-card px-5 py-14 text-center">
        <p className="text-[13.5px] text-heading">Nothing has happened yet</p>
        <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">
          Suspending, restoring or deleting an account is recorded here, with
          who did it and why. Entries cannot be edited or removed.
        </p>
      </div>
    );
  }

  return (
    <ul className="overflow-hidden rounded-3xl border border-border bg-card">
      {data.map((a, i) => (
        <Row key={a.id} action={a} first={i === 0} />
      ))}
    </ul>
  );
}

function Row({ action, first }: { action: AdminAction; first: boolean }) {
  const shape = SHAPE[action.action];
  const Icon = shape.icon;
  return (
    <li
      className={
        "flex items-start gap-3.5 px-4 py-3.5 sm:px-5" +
        (first ? "" : " border-t border-border/70")
      }
    >
      <span
        className={
          "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full " +
          (shape.danger
            ? "bg-destructive/10 text-destructive"
            : "bg-secondary text-muted-foreground")
        }
      >
        <Icon className="h-[15px] w-[15px]" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-snug text-foreground">
          <span className="font-medium text-heading">{action.actor_email}</span>{" "}
          {shape.verb}{" "}
          <span className="font-medium text-heading">{action.target_email}</span>
        </p>
        {action.reason && (
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            &ldquo;{action.reason}&rdquo;
          </p>
        )}
      </div>

      <time
        dateTime={action.created_at}
        className="shrink-0 text-[11.5px] tabular-nums text-muted-foreground"
      >
        {new Date(action.created_at).toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
        })}
      </time>
    </li>
  );
}
