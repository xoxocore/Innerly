"use client";

import { useState } from "react";
import { Loader2, PauseCircle, Trash2 } from "lucide-react";
import { deleteAccount, pauseAccount } from "@/lib/account";
import { useApp } from "@/state/app-context";
import { useAuth } from "@/state/auth-context";
import { FIELD, FieldLabel, Note, QuietButton, Section } from "./parts";

/**
 * The two endings.
 *
 * Kept apart from everything else and from each other, because the difference
 * between them is the whole point: pausing is a door you can walk back through,
 * deleting is not. Both say plainly which one they are before you commit.
 */
export function DangerZone() {
  const { signOut } = useApp();
  const { signOut: endSession, user } = useAuth();
  const [mode, setMode] = useState<null | "pause" | "delete">(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const leave = async () => {
    // Local state first, then the session — the same order as signing out
    // normally, so nothing written in the last second is stranded.
    signOut();
    await endSession();
  };

  const pause = async () => {
    setBusy(true);
    setError(null);
    try {
      await pauseAccount();
      await leave();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(password);
      await leave();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
      setBusy(false);
    }
  };

  return (
    <Section
      title="Closing your account"
      desc="Two different things, and only one of them can be undone."
      className="border border-red-500/15"
    >
      {/* ------------------------------------------------------------ pause */}
      <div className="mt-4 border-t border-border/50 pt-4">
        <p className="text-[13px] font-medium text-foreground">
          Pause my account
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          Signs you out and stops every email and notification. Your writing is
          kept exactly as it is. Signing back in brings all of it back — you
          don&rsquo;t need to ask anyone.
        </p>

        {mode === "pause" ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <QuietButton onClick={pause} disabled={busy}>
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Yes, pause it
            </QuietButton>
            <QuietButton onClick={() => setMode(null)} disabled={busy}>
              Not now
            </QuietButton>
          </div>
        ) : (
          <QuietButton className="mt-3" onClick={() => setMode("pause")}>
            <PauseCircle className="h-3.5 w-3.5" /> Pause my account
          </QuietButton>
        )}
      </div>

      {/* ----------------------------------------------------------- delete */}
      <div className="mt-5 border-t border-border/50 pt-4">
        <p className="text-[13px] font-medium text-foreground">
          Delete my account
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          Your account, every reflection, plan, manifestation and photo, gone
          for good. There is no copy kept and no way for anyone — including us
          — to bring it back.
        </p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
          If you want to keep your writing, use{" "}
          <span className="text-foreground">Download everything</span> above
          first.
        </p>

        {mode === "delete" ? (
          <div className="mt-3">
            <FieldLabel>Type your password to confirm</FieldLabel>
            <input
              type="password"
              autoComplete="current-password"
              aria-label="Password to confirm deletion"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={FIELD}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <QuietButton
                tone="danger"
                onClick={remove}
                disabled={busy || password.length === 0}
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Delete it permanently
              </QuietButton>
              <QuietButton
                onClick={() => {
                  setMode(null);
                  setPassword("");
                  setError(null);
                }}
                disabled={busy}
              >
                Keep my account
              </QuietButton>
            </div>
          </div>
        ) : (
          <QuietButton
            tone="danger"
            className="mt-3"
            onClick={() => setMode("delete")}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete my account
          </QuietButton>
        )}
      </div>

      <Note text={error} bad />
    </Section>
  );
}
