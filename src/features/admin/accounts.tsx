"use client";

import { useMemo, useState } from "react";
import { Loader2, Search, Ban, RotateCcw, Trash2, X } from "lucide-react";
import { Avatar } from "@/components/innerly/avatar";
import { useAuth } from "@/state/auth-context";
import { cn } from "@/lib/utils";
import {
  actOnAccount,
  agoLabel,
  isOnline,
  useAccounts,
  type Account,
} from "./use-admin";

type Pending = { account: Account; action: "suspend" | "unsuspend" | "delete" };

export function Accounts() {
  const { user } = useAuth();
  const { data, error, loading, refresh } = useAccounts();
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data ?? [];
    return (data ?? []).filter(
      (a) =>
        a.email.toLowerCase().includes(q) ||
        a.first_name.toLowerCase().includes(q)
    );
  }, [data, query]);

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-card px-3.5">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by email or name"
          aria-label="Search accounts"
          className="w-full bg-transparent py-2.5 text-[13.5px] outline-none placeholder:text-muted-foreground"
        />
        <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
          {shown.length}
        </span>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        {shown.length === 0 ? (
          <p className="px-5 py-14 text-center text-[13px] text-muted-foreground">
            {query ? "Nobody matches that." : "No accounts yet."}
          </p>
        ) : (
          <ul>
            {shown.map((a, i) => (
              <li
                key={a.id}
                className={cn(
                  "flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 sm:px-5",
                  i > 0 && "border-t border-border/70",
                  a.suspended && "bg-destructive/[0.04]"
                )}
              >
                <Avatar name={a.first_name || a.email} className="h-9 w-9 shrink-0 text-[13px]" />

                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-[13.5px] font-medium text-heading">
                    {isOnline(a.last_active_at) && (
                      <span
                        title="Using Innerly right now"
                        aria-label="Using Innerly right now"
                        className="h-2 w-2 shrink-0 rounded-full bg-[var(--brand-green)]"
                      />
                    )}
                    {a.first_name || "—"}
                    {a.suspended && (
                      <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-destructive">
                        Suspended
                      </span>
                    )}
                    {!a.confirmed && (
                      <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Unconfirmed
                      </span>
                    )}
                  </p>
                  <p className="truncate text-[12px] text-muted-foreground">{a.email}</p>
                </div>

                <div className="flex shrink-0 gap-6 text-[11.5px] text-muted-foreground">
                  <Field label="Joined" value={shortDate(a.signed_up_at)} />
                  <Field
                    label="Last seen"
                    value={agoLabel(a.last_active_at ?? a.last_seen)}
                  />
                  <Field label="Days used" value={String(a.days_active)} />
                </div>

                <div className="flex shrink-0 gap-1.5">
                  {a.id === user?.id ? (
                    // The server refuses either action on your own account.
                    // Offering a button that can only fail is worse than not
                    // offering one.
                    <span className="rounded-full border border-border/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                      You
                    </span>
                  ) : a.suspended ? (
                    <IconBtn
                      label="Restore access"
                      onClick={() => setPending({ account: a, action: "unsuspend" })}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </IconBtn>
                  ) : (
                    <IconBtn
                      label="Suspend"
                      onClick={() => setPending({ account: a, action: "suspend" })}
                    >
                      <Ban className="h-4 w-4" />
                    </IconBtn>
                  )}
                  <IconBtn
                    label="Delete"
                    danger
                    onClick={() => setPending({ account: a, action: "delete" })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconBtn>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pending && (
        <Confirm
          pending={pending}
          onClose={() => setPending(null)}
          onDone={() => {
            setPending(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="hidden sm:block">
      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
        {label}
      </p>
      <p className="mt-0.5 tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function IconBtn({
  label,
  danger,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-full border border-border/70 text-muted-foreground transition-colors",
        danger
          ? "hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
          : "hover:bg-accent hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

const COPY = {
  suspend: {
    title: "Suspend this account?",
    body: "They won't be able to sign in. Everything they've written is kept, and you can restore access at any time.",
    verb: "Suspend",
    danger: false,
  },
  unsuspend: {
    title: "Restore access?",
    body: "They'll be able to sign in again, and will find everything where they left it.",
    verb: "Restore",
    danger: false,
  },
  delete: {
    title: "Delete this account for good?",
    body: "Their account, everything they wrote and every photo they added will be erased. This cannot be undone — not by you, not by me, not by Supabase.",
    verb: "Delete permanently",
    danger: true,
  },
} as const;

function Confirm({
  pending,
  onClose,
  onDone,
}: {
  pending: Pending;
  onClose: () => void;
  onDone: () => void;
}) {
  const { account, action } = pending;
  const c = COPY[action];
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Deleting asks for the email to be typed out. Not bureaucracy: it is the
  // one action here with no way back, and the pause is the point.
  const confirmed = action !== "delete" || typed.trim() === account.email;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-[400px] rounded-3xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[1.05rem] font-medium leading-snug text-heading">
            {c.title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Cancel"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{c.body}</p>

        <p className="mt-3 rounded-2xl bg-secondary px-3.5 py-2.5 text-[12.5px]">
          <span className="text-muted-foreground">Account: </span>
          <span className="font-medium text-heading">{account.email}</span>
        </p>

        <label className="mt-4 block text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Why (kept in the log)
        </label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. reported for abuse"
          className="mt-1.5 h-10 w-full rounded-2xl border border-border/60 bg-card px-3.5 text-[13px] outline-none focus:border-[var(--brand-green)]"
        />

        {action === "delete" && (
          <>
            <label className="mt-3.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Type their email to confirm
            </label>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={account.email}
              autoComplete="off"
              spellCheck={false}
              className="mt-1.5 h-10 w-full rounded-2xl border border-border/60 bg-card px-3.5 text-[13px] outline-none focus:border-destructive"
            />
          </>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-2xl bg-destructive/10 px-3.5 py-2.5 text-[12.5px] text-destructive">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="h-10 rounded-full px-4 text-[13px] font-medium text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            disabled={!confirmed || busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await actOnAccount(action, account.id, reason);
                onDone();
              } catch (e) {
                setError(e instanceof Error ? e.message : "That didn't work.");
                setBusy(false);
              }
            }}
            style={
              c.danger ? undefined : { backgroundColor: "var(--brand-green-strong)" }
            }
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-35",
              c.danger && "bg-destructive"
            )}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {c.verb}
          </button>
        </div>
      </div>
    </div>
  );
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}
