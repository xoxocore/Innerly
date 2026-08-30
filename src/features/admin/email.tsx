"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Mail, Plus, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchCampaigns, type Campaign } from "@/lib/campaigns";
import { EmailForm } from "./email-form";

const AUDIENCE_LABEL = {
  everyone: "everyone",
  new: "people who just joined",
  returning: "people who have been here a while",
} as const;

export function Email() {
  const [items, setItems] = useState<Campaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ campaign: Campaign | null } | null>(null);

  const load = useCallback(() => {
    fetchCampaigns()
      .then((c) => {
        setItems(c);
        setError(null);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Could not load these.")
      );
  }, []);

  useEffect(load, [load]);

  if (editing) {
    return (
      <EmailForm
        campaign={editing.campaign}
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
          Email to people who have opted in. Every one carries a way out.
        </p>
        <button
          onClick={() => setEditing({ campaign: null })}
          style={{ backgroundColor: "var(--brand-green-strong)" }}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Write one
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card px-5 py-16 text-center">
          <Mail className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-[13.5px] text-heading">Nothing sent yet</p>
          <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">
            Write it, see exactly what lands in an inbox, send yourself a test,
            and only then send it to anyone else.
          </p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-3xl border border-border bg-card">
          {items.map((c, i) => (
            <li key={c.id} className={cn(i > 0 && "border-t border-border/70")}>
              <button
                onClick={() => setEditing({ campaign: c })}
                className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-accent/40 sm:px-5"
              >
                <span
                  className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-full",
                    c.status === "sent"
                      ? "bg-[var(--brand-green)]/12 text-[var(--brand-green-ink)]"
                      : c.status === "failed"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-secondary text-muted-foreground"
                  )}
                >
                  {c.status === "sent" ? <Send className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[13.5px] font-medium text-heading">
                      {c.subject || "No subject"}
                    </span>
                    {c.status === "draft" && (
                      <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Draft
                      </span>
                    )}
                    {c.status === "failed" && (
                      <span className="shrink-0 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-destructive">
                        Failed
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                    {c.status === "sent" && c.sent_at
                      ? `Sent to ${c.delivered} of ${c.recipients} on ${new Date(c.sent_at).toLocaleDateString()}`
                      : `For ${AUDIENCE_LABEL[c.audience]}`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
