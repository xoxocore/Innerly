"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check, Loader2, Mail } from "lucide-react";
import { RosyGlow } from "@/components/innerly/rosy-glow";
import { Wordmark } from "@/components/innerly/wordmark";
import { cn } from "@/lib/utils";
import { useApp } from "@/state/app-context";
import { useAuth } from "@/state/auth-context";

type Mode = "signIn" | "signUp" | "reset";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const field =
  "h-11 w-full rounded-2xl border border-border/60 bg-card/70 px-4 text-[14px] text-foreground outline-none backdrop-blur-sm transition-colors placeholder:text-muted-foreground/60 focus:border-[var(--brand-green)]";

const COPY: Record<Mode, { title: string; sub: string; action: string }> = {
  signIn: {
    title: "Welcome back",
    sub: "Pick up where you left off.",
    action: "Sign in",
  },
  signUp: {
    title: "Make yourself an account",
    sub: "So your reflections follow you between your phone and your laptop.",
    action: "Create account",
  },
  reset: {
    title: "Reset your password",
    sub: "We'll email you a link to set a new one.",
    action: "Send the link",
  },
};

export function AuthScreen() {
  const { night } = useApp();
  const { signIn, signUp, sendReset, signInWithGoogle, enabled } = useAuth();

  const [mode, setMode] = useState<Mode>("signIn");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<"reset" | "confirm" | null>(null);

  const c = COPY[mode];

  const go = (next: Mode) => {
    setMode(next);
    setError(null);
    setSent(null);
    setPassword("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signIn") await signIn(email, password);
      else if (mode === "signUp") {
        await signUp(email, password, firstName);
        // Whether a confirmation email is needed depends on the project's
        // settings, so say what happened without promising either way.
        setSent("confirm");
      } else {
        await sendReset(email);
        setSent("reset");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const canSubmit =
    email.trim().length > 3 &&
    (mode === "reset" || password.length > 0) &&
    (mode !== "signUp" || firstName.trim().length > 0);

  if (sent) {
    return (
      <Shell night={night}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ease: EASE }}
          className="glass-card p-7 text-center"
        >
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[var(--brand-green-strong)]">
            <Mail className="h-5 w-5 text-white" />
          </span>
          <h1 className="title-regular mt-4 text-[1.25rem] tracking-tight text-heading">
            Check your email
          </h1>
          <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
            {sent === "reset"
              ? `If there's an account for ${email.trim()}, a reset link is on its way.`
              : `We've sent a confirmation link to ${email.trim()}. Open it and you're in.`}
          </p>
          <button
            onClick={() => go("signIn")}
            className="mt-6 text-[13px] font-medium text-[var(--brand-green-ink)] hover:underline"
          >
            Back to sign in
          </button>
        </motion.div>
      </Shell>
    );
  }

  return (
    <Shell night={night}>
      <motion.div
        layout
        transition={{ duration: 0.32, ease: EASE }}
        className="glass-card p-6 sm:p-7"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.24, ease: EASE }}
          >
            <h1 className="title-regular text-[1.3rem] leading-tight tracking-tight text-heading">
              {c.title}
            </h1>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
              {c.sub}
            </p>

            <form onSubmit={submit} className="mt-5 flex flex-col gap-2.5">
              {mode === "signUp" && (
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Your first name"
                  aria-label="Your first name"
                  autoComplete="given-name"
                  className={field}
                />
              )}

              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                inputMode="email"
                placeholder="Email"
                aria-label="Email"
                autoComplete="email"
                className={field}
              />

              {mode !== "reset" && (
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder={mode === "signUp" ? "Password (6+ characters)" : "Password"}
                  aria-label="Password"
                  autoComplete={mode === "signUp" ? "new-password" : "current-password"}
                  className={field}
                />
              )}

              {error && (
                <p
                  role="alert"
                  className="rounded-2xl bg-destructive/10 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-destructive"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={!canSubmit || busy}
                style={{ backgroundColor: "var(--brand-green-strong)" }}
                className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-full text-[13.5px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-35"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    {c.action}
                    {mode === "signUp" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                  </>
                )}
              </button>
            </form>

            {mode !== "reset" && enabled && (
              <>
                <div className="my-4 flex items-center gap-3">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    or
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <button
                  onClick={() => signInWithGoogle().catch((e) => setError(e.message))}
                  className="flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-border/70 bg-card/70 text-[13.5px] font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-accent"
                >
                  <GoogleMark />
                  Continue with Google
                </button>
              </>
            )}

            <div className="mt-5 flex flex-col items-center gap-2 text-[12.5px]">
              {mode === "signIn" && (
                <>
                  <p className="text-muted-foreground">
                    New here?{" "}
                    <button
                      onClick={() => go("signUp")}
                      className="font-medium text-[var(--brand-green-ink)] hover:underline"
                    >
                      Make an account
                    </button>
                  </p>
                  <button
                    onClick={() => go("reset")}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Forgotten your password?
                  </button>
                </>
              )}
              {mode !== "signIn" && (
                <p className="text-muted-foreground">
                  Already have an account?{" "}
                  <button
                    onClick={() => go("signIn")}
                    className="font-medium text-[var(--brand-green-ink)] hover:underline"
                  >
                    Sign in
                  </button>
                </p>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <p className="mt-5 text-center text-[11.5px] leading-relaxed text-muted-foreground">
        What you write in Innerly is yours. Only you can read it.
      </p>
    </Shell>
  );
}

function Shell({ night, children }: { night: boolean; children: React.ReactNode }) {
  return (
    <main className="app-bg relative isolate flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <RosyGlow night={night} className="-top-10 left-1/2 h-72 w-[32rem] -translate-x-1/2" />
      <div className={cn("w-full max-w-[380px]")}>
        <div className="mb-6 flex justify-center">
          <Wordmark height={38} />
        </div>
        {children}
      </div>
    </main>
  );
}

// Google requires their own mark on the button, so it is drawn rather than
// swapped for a generic icon.
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="h-[17px] w-[17px]" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.96 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}
