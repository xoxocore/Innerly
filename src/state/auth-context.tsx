"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { detach, pull } from "@/lib/sync";

type AuthState = {
  user: User | null;
  session: Session | null;
  /** False until we know whether someone is signed in — not the same as signed out. */
  ready: boolean;
  /** When Supabase has no keys, the app runs on local storage exactly as before. */
  enabled: boolean;
  /**
   * False while this browser is still being brought in line with the account.
   * Screens must not render before it is true: they read localStorage on
   * mount, and mounting mid-pull would show the previous occupant's writing.
   */
  synced: boolean;
  signUp: (email: string, password: string, firstName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  /**
   * True between clicking a reset link and choosing a new password. The link
   * signs you in, so without this the app would let you straight through and
   * the password you came to change would still be the old one.
   */
  recovery: boolean;
  updatePassword: (password: string) => Promise<void>;
  /**
   * Changing it from Settings, which asks for the current one first.
   * A session on its own is not proof of identity — an unlocked laptop is a
   * session — and a password changed by a passer-by locks the owner out.
   */
  changePassword: (current: string, next: string) => Promise<void>;
  /** Ends every session everywhere, for a device that was lost or shared. */
  signOutEverywhere: () => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
  /** Why a link from an email did not work — expired, already used, malformed. */
  linkError: string | null;
  dismissLinkError: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

// Supabase returns technically accurate messages that read badly to a person
// halfway through signing up. Rewrite the ones people actually hit.
function readable(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "That email and password don't match. Check both, or reset your password.";
  if (m.includes("email not confirmed"))
    return "Check your inbox and confirm your email first — the link is in there.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "There's already an account with this email. Try signing in instead.";
  if (m.includes("password should be at least"))
    return "Passwords need to be at least 6 characters.";
  if (m.includes("unable to validate email") || m.includes("invalid email"))
    return "That doesn't look like a complete email address.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Too many tries just now. Wait a minute and try again.";
  if (m.includes("failed to fetch") || m.includes("network"))
    return "Couldn't reach the server. Check your connection and try again.";
  if (m.includes("expired"))
    return "That link has expired. Ask for a new one and it'll work.";
  if (m.includes("same password") || m.includes("should be different"))
    return "That's the password you already have. Pick a different one.";
  return message;
}

/**
 * Supabase reports a bad link by sending you back with the reason in the URL —
 * in the query for the PKCE flow, in the fragment for the older one. Read both.
 *
 * Pure: clearing the URL is a side effect and belongs in an effect, not in the
 * middle of a render.
 */
function readLinkError(): string | null {
  if (typeof window === "undefined") return null;
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const raw =
    query.get("error_description") ??
    query.get("error") ??
    hash.get("error_description") ??
    hash.get("error");
  return raw ? readable(raw.replace(/\+/g, " ")) : null;
}

/**
 * Strip a failed link's parameters out of the address bar.
 *
 * Only the error ones: a `?code=` is the library's to consume, and removing it
 * would break every confirmation link. Called before the Supabase client is
 * built, because a client that still sees the error treats the page load as a
 * failed callback and rejects getSession().
 */
function clearLinkParams() {
  if (typeof window === "undefined") return;
  const { search, hash, pathname } = window.location;
  if (!/[?#&]error/.test(search + hash)) return;
  window.history.replaceState(window.history.state, "", pathname);
}

export class AuthError extends Error {}

export function AuthProvider({
  children,
  /**
   * Whether to pull this account's writing onto the device. True in the app,
   * where the screens read it. False in the admin panel, which has no business
   * touching anyone's journal — its own owner's included.
   */
  sync = true,
}: {
  children: ReactNode;
  sync?: boolean;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!isSupabaseConfigured);
  // Which account this browser currently holds the data of. Compared by id so
  // a silent token refresh — which fires the same event as a sign-in — does
  // not re-pull and does not blank the screen mid-sentence.
  const [syncedFor, setSyncedFor] = useState<string | null>(null);
  const [recovery, setRecovery] = useState(false);
  // Read once as the state is created, so the message survives the URL being
  // tidied up in the effect below.
  const [linkError, setLinkError] = useState<string | null>(readLinkError);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    // Before the client exists, not after: it inspects the URL as it is built.
    clearLinkParams();

    const client = supabase();

    // getSession resolves from the stored token; onAuthStateChange then keeps
    // us in step with sign-ins, sign-outs and silent token refreshes — including
    // ones that happen in another tab.
    let cancelled = false;
    client.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        setSession(data.session);
      })
      .catch(() => {
        // A rejected getSession must still let the app render. It rejects on a
        // dead network and on a link that has already been used, and leaving
        // `ready` false would leave a blank page with nothing to act on.
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    const { data: sub } = client.auth.onAuthStateChange((event, next) => {
      // Fired when a reset link is opened. The session it hands over is real,
      // which is exactly why the app must stop and ask for a new password
      // rather than treating this as an ordinary sign-in.
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(next);
      setReady(true);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Bring the device in line whenever the signed-in account changes. Runs
  // before anything reads localStorage, which is what stops one person's
  // reflections being handed to the next person on the same computer.
  const userId = session?.user.id ?? null;
  useEffect(() => {
    // No reset when the session ends: `synced` below reads true whenever there
    // is no session, and an explicit sign-out clears this itself. Doing it here
    // as well would be a setState in an effect for no gain.
    if (!isSupabaseConfigured || !userId || syncedFor === userId) return;
    // The admin panel pulls nothing, so there is nothing to wait for. The
    // `synced` value below reads true in that case rather than being set here.
    if (!sync) return;

    let cancelled = false;
    pull(userId).finally(() => {
      if (!cancelled) setSyncedFor(userId);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, syncedFor, sync]);

  const guard = useCallback(() => {
    if (!isSupabaseConfigured) {
      throw new AuthError(
        "Accounts aren't switched on yet. Ask whoever set this up to add the Supabase keys."
      );
    }
    return supabase();
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, firstName: string) => {
      const { error } = await guard().auth.signUp({
        email: email.trim(),
        password,
        options: {
          // Picked up by the database trigger that creates the profile row.
          data: { full_name: firstName.trim(), name: firstName.trim() },
          emailRedirectTo:
            typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      if (error) throw new AuthError(readable(error.message));
    },
    [guard]
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await guard().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw new AuthError(readable(error.message));
    },
    [guard]
  );

  const signInWithGoogle = useCallback(async () => {
    const { error } = await guard().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo:
          typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    if (error) throw new AuthError(readable(error.message));
  }, [guard]);

  const sendReset = useCallback(
    async (email: string) => {
      const { error } = await guard().auth.resetPasswordForEmail(email.trim(), {
        redirectTo:
          typeof window !== "undefined" ? window.location.origin : undefined,
      });
      if (error) throw new AuthError(readable(error.message));
    },
    [guard]
  );

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await guard().auth.updateUser({ password });
    if (error) throw new AuthError(readable(error.message));
    setRecovery(false);
  }, [guard]);

  const changePassword = useCallback(
    async (current: string, next: string) => {
      const email = session?.user.email;
      if (!email) throw new AuthError("You are not signed in.");

      // Proved by signing in again with it. Supabase would take the new
      // password on the session alone, which is exactly the hole this closes.
      const { error: wrong } = await guard().auth.signInWithPassword({
        email,
        password: current,
      });
      if (wrong) throw new AuthError("That current password doesn't match.");

      const { error } = await guard().auth.updateUser({ password: next });
      if (error) throw new AuthError(readable(error.message));
    },
    [guard, session]
  );

  const resendConfirmation = useCallback(
    async (email: string) => {
      const { error } = await guard().auth.resend({
        type: "signup",
        email: email.trim(),
        options: {
          emailRedirectTo:
            typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      if (error) throw new AuthError(readable(error.message));
    },
    [guard]
  );

  const dismissLinkError = useCallback(() => setLinkError(null), []);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    // Save anything still waiting on its debounce, THEN wipe the device. In
    // that order: signing out must not cost someone the sentence they just
    // typed, and must not leave it behind for whoever sits down next.
    await detach();
    setSyncedFor(null);
    setRecovery(false);
    await supabase().auth.signOut();
  }, []);

  const signOutEverywhere = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    await detach();
    setSyncedFor(null);
    setRecovery(false);
    // "global" ends every session on every device, not only this browser's.
    await supabase().auth.signOut({ scope: "global" });
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user: session?.user ?? null,
      session,
      ready,
      enabled: isSupabaseConfigured,
      synced:
        !isSupabaseConfigured || !session || !sync || syncedFor === session.user.id,
      signUp,
      signIn,
      signInWithGoogle,
      sendReset,
      signOut,
      signOutEverywhere,
      changePassword,
      recovery,
      updatePassword,
      resendConfirmation,
      linkError,
      dismissLinkError,
    }),
    [
      session,
      ready,
      syncedFor,
      sync,
      recovery,
      linkError,
      signUp,
      signIn,
      signInWithGoogle,
      sendReset,
      signOut,
      signOutEverywhere,
      changePassword,
      updatePassword,
      resendConfirmation,
      dismissLinkError,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
