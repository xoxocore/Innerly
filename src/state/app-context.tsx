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
import { KEYS, storage, usePersistentState } from "@/lib/storage";
import type { Profile } from "@/lib/types";

export type View =
  | "dashboard"
  | "reflect"
  | "daily-plan"
  | "manifestation"
  | "vision-board"
  | "blog"
  | "tutorials"
  | "history"
  | "settings";

type Route = { view: View; slug?: string };

type AppState = {
  profile: Profile | null;
  setProfile: (p: Profile) => void;
  signedIn: boolean;
  completeOnboarding: (firstName: string) => void;
  signOut: () => void;

  route: Route;
  navigate: (view: View, slug?: string) => void;

  night: boolean;
  toggleNight: () => void;

  streak: number;
  hydrated: boolean;
};

const AppContext = createContext<AppState | null>(null);

function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState, profileHydrated] =
    usePersistentState<Profile | null>(KEYS.profile, null);
  const [night, setNight, nightHydrated] = usePersistentState<boolean>(
    KEYS.night,
    false
  );
  const [route, setRoute] = useState<Route>({ view: "dashboard" });
  const [streak, setStreak] = useState(1);

  const hydrated = profileHydrated && nightHydrated;

  // Apply / remove the `.dark` class for night mode.
  useEffect(() => {
    const root = document.documentElement;
    if (night) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [night]);

  // Track usage days -> streak (consecutive calendar days the app was opened).
  useEffect(() => {
    if (!profile) return;
    const days = storage.read<string[]>(KEYS.usageDays, []);
    const today = todayKey();
    if (!days.includes(today)) days.push(today);
    days.sort();
    storage.write(KEYS.usageDays, days);

    let count = 0;
    const cursor = new Date();
    // Count back from today while each day exists in the set.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (days.includes(todayKey(cursor))) {
        count += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else break;
    }
    setStreak(Math.max(1, count));
  }, [profile]);

  const setProfile = useCallback(
    (p: Profile) => setProfileState(p),
    [setProfileState]
  );

  const completeOnboarding = useCallback(
    (firstName: string) => {
      setProfileState({
        firstName: firstName.trim() || "friend",
        createdAt: new Date().toISOString(),
        dayStreak: 1,
      });
      setRoute({ view: "dashboard" });
    },
    [setProfileState]
  );

  const signOut = useCallback(() => {
    setProfileState(null);
    setRoute({ view: "dashboard" });
  }, [setProfileState]);

  const navigate = useCallback((view: View, slug?: string) => {
    setRoute({ view, slug });
    if (typeof window !== "undefined")
      window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const toggleNight = useCallback(
    () => setNight((n) => !n),
    [setNight]
  );

  const value = useMemo<AppState>(
    () => ({
      profile,
      setProfile,
      signedIn: !!profile,
      completeOnboarding,
      signOut,
      route,
      navigate,
      night,
      toggleNight,
      streak,
      hydrated,
    }),
    [
      profile,
      setProfile,
      completeOnboarding,
      signOut,
      route,
      navigate,
      night,
      toggleNight,
      streak,
      hydrated,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
