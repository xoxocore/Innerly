"use client";

import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { useAuth } from "@/state/auth-context";
import { FIELD, FieldLabel, Note, PrimaryButton, QuietButton } from "./parts";

/** Supabase's own floor. Saying it up front beats being refused after typing. */
const MIN = 6;

export function PasswordField() {
  const { changePassword, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const reset = () => {
    setCurrent("");
    setNext("");
    setAgain("");
    setError(null);
  };

  const mismatch = again.length > 0 && next !== again;
  const ready = current.length > 0 && next.length >= MIN && next === again;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await changePassword(current, next);
      setDone(true);
      setOpen(false);
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
        You are using Innerly on this device without an account, so there is no
        password to change.
      </p>
    );
  }

  if (!open) {
    return (
      <div className="mt-4">
        <QuietButton
          onClick={() => {
            setDone(false);
            setOpen(true);
          }}
        >
          <KeyRound className="h-3.5 w-3.5" /> Change password
        </QuietButton>
        {done && <Note text="Your password has been changed." />}
      </div>
    );
  }

  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready && !busy) void submit();
      }}
    >
      <div>
        <FieldLabel>Current password</FieldLabel>
        <input
          type="password"
          autoComplete="current-password"
          aria-label="Current password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className={FIELD}
        />
      </div>
      <div>
        <FieldLabel>New password</FieldLabel>
        <input
          type="password"
          autoComplete="new-password"
          aria-label="New password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className={FIELD}
        />
        <p className="mt-1.5 text-[11.5px] text-muted-foreground">
          At least {MIN} characters. A phrase you would remember beats a word
          with symbols in it.
        </p>
      </div>
      <div>
        <FieldLabel>New password again</FieldLabel>
        <input
          type="password"
          autoComplete="new-password"
          aria-label="New password again"
          value={again}
          onChange={(e) => setAgain(e.target.value)}
          className={FIELD}
        />
        {mismatch && (
          <p className="mt-1.5 text-[11.5px] text-red-600 dark:text-red-400">
            These two don&rsquo;t match yet.
          </p>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <PrimaryButton type="submit" disabled={!ready || busy}>
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Change password
        </PrimaryButton>
        <QuietButton
          onClick={() => {
            setOpen(false);
            reset();
          }}
        >
          Cancel
        </QuietButton>
      </div>
      <Note text={error} bad />
    </form>
  );
}
