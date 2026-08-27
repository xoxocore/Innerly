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

type AuthState = {
  user: User | null;
  session: Session | null;
  /** False until we know whether someone is signed in — not the same as signed out. */
  ready: boolean;
  /** When Supabase has no keys, the app runs on local storage exactly as before. */
  enabled: boolean;
  signUp: (email: string, password: string, firstName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
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
  return message;
}

export class AuthError extends Error {}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const client = supabase();

    // getSession resolves from the stored token; onAuthStateChange then keeps
    // us in step with sign-ins, sign-outs and silent token refreshes — including
    // ones that happen in another tab.
    let cancelled = false;
    client.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setReady(true);
    });

    const { data: sub } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

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

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    await supabase().auth.signOut();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user: session?.user ?? null,
      session,
      ready,
      enabled: isSupabaseConfigured,
      signUp,
      signIn,
      signInWithGoogle,
      sendReset,
      signOut,
    }),
    [session, ready, signUp, signIn, signInWithGoogle, sendReset, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
