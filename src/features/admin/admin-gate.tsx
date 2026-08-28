"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Loader2, ShieldAlert } from "lucide-react";
import { Mark } from "@/components/innerly/mark";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/state/auth-context";

/**
 * The door.
 *
 * Deliberately its own screen rather than a link from the app: nothing in
 * Innerly points here, and signing in as an ordinary person gets you a polite
 * refusal rather than a hint that a panel exists.
 *
 * Being signed in is not enough — the allowlist is asked separately, and it is
 * the database that answers. Getting past this screen without being on it
 * would still leave every query and every action refusing you.
 */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const { user, ready, signIn, signOut, enabled } = useAuth();
  // Keyed by account, so signing in as somebody else cannot briefly inherit
  // the previous answer — and so nothing has to be reset on the way out.
  const [checked, setChecked] = useState<{ id: string; ok: boolean } | null>(null);
  const allowed = user && checked?.id === user.id ? checked.ok : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase()
      .rpc("is_admin")
      .then(({ data, error: failed }) => {
        if (!cancelled) setChecked({ id: userId, ok: !failed && data === true });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!enabled) {
    return (
      <Shell>
        <p className="text-[13.5px] leading-relaxed text-muted-foreground">
          Accounts are not switched on for this deployment, so there is nothing
          to administer yet.
        </p>
      </Shell>
    );
  }

  if (!ready || (user && allowed === null)) {
    return (
      <Shell>
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
      </Shell>
    );
  }

  if (user && allowed === false) {
    return (
      <Shell>
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-secondary">
          <ShieldAlert className="h-5 w-5 text-muted-foreground" />
        </span>
        <h1 className="title-regular mt-4 text-[1.2rem] tracking-tight text-heading">
          Not an admin account
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
          You&apos;re signed in as {user.email}, which isn&apos;t on the admin
          list. Sign in with an account that is.
        </p>
        <button
          onClick={() => signOut()}
          className="mt-5 text-[13px] font-medium text-[var(--brand-green-ink)] hover:underline"
        >
          Sign out
        </button>
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell>
        <h1 className="title-regular text-[1.3rem] leading-tight tracking-tight text-heading">
          Innerly admin
        </h1>
        <p className="mt-1.5 text-[12.5px] text-muted-foreground">
          For the people who run Innerly.
        </p>
        <form
          className="mt-5 flex flex-col gap-2.5 text-left"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await signIn(email, password);
            } catch (err) {
              setError(err instanceof Error ? err.message : "That didn't work.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Email"
            aria-label="Email"
            autoComplete="email"
            className={field}
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Password"
            aria-label="Password"
            autoComplete="current-password"
            className={field}
          />
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
            disabled={busy || email.trim().length < 4 || !password}
            style={{ backgroundColor: "var(--brand-green-strong)" }}
            className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-full text-[13.5px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-35"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Sign in <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </Shell>
    );
  }

  return <>{children}</>;
}

const field =
  "h-11 w-full rounded-2xl border border-border/60 bg-card/70 px-4 text-[14px] text-foreground outline-none backdrop-blur-sm transition-colors placeholder:text-muted-foreground/60 focus:border-[var(--brand-green)]";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-[360px] text-center">
        <div className="mb-7 flex justify-center">
          <Mark size={44} label="Innerly" />
        </div>
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-7">
          {children}
        </div>
      </div>
    </main>
  );
}
