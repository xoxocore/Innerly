"use client";

import { AppProvider, useApp } from "@/state/app-context";
import { AuthProvider, useAuth } from "@/state/auth-context";
import { Onboarding } from "@/features/onboarding/onboarding";
import { AuthScreen } from "@/features/auth/auth-screen";
import { AppRouter } from "@/features/app-router";

function Gate() {
  const { signedIn, hydrated } = useApp();
  const { user, ready, enabled, synced } = useAuth();

  // Avoid a flash of the wrong screen before localStorage and the stored
  // session have both been read.
  if (!hydrated || !ready) return <div className="min-h-dvh bg-background" />;

  // Without Supabase keys the app behaves exactly as it did before accounts
  // existed, so a missing environment variable never locks anyone out.
  if (enabled && !user) return <AuthScreen />;

  // Signed in, but this browser has not been brought in line with the account
  // yet. Holding here is not politeness: the screens read localStorage as they
  // mount, so rendering now would show whatever the last person left behind.
  if (!synced) return <div className="min-h-dvh bg-background" />;

  // Signed in but the welcome has not been seen yet. The name they gave when
  // signing up is carried through, so it is never asked for twice.
  if (!signedIn) {
    const meta = user?.user_metadata as Record<string, unknown> | undefined;
    const fromAuth =
      typeof meta?.full_name === "string"
        ? meta.full_name.split(" ")[0]
        : typeof meta?.name === "string"
          ? (meta.name as string).split(" ")[0]
          : "";
    return <Onboarding initialName={fromAuth} />;
  }

  return <AppRouter />;
}

export default function Page() {
  return (
    <AuthProvider>
      <AppProvider>
        <Gate />
      </AppProvider>
    </AuthProvider>
  );
}
