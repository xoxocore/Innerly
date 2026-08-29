"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export type Account = {
  id: string;
  email: string;
  first_name: string;
  signed_up_at: string;
  confirmed: boolean;
  provider: string;
  last_seen: string | null;
  last_active_at: string | null;
  days_active: number;
  suspended: boolean;
};

export type DailyPoint = { day: string; signups: number; active: number };

export type Stats = {
  accounts: number;
  confirmed: number;
  suspended: number;
  new_7d: number;
  new_30d: number;
  online_now: number;
  active_today: number;
  active_7d: number;
  active_30d: number;
  returning: number;
  eligible: number;
  posts_published: number;
  posts_drafts: number;
  daily: DailyPoint[];
};

export type AdminAction = {
  id: string;
  actor_email: string;
  target_email: string;
  action: "suspend" | "unsuspend" | "delete";
  reason: string;
  created_at: string;
};

/**
 * Everything the panel reads comes from two database functions that check the
 * allowlist themselves and raise if the caller is not on it. The browser holds
 * no special key: an ordinary session that happens to belong to an admin.
 */
/**
 * @param everyMs re-read on a timer, for the figures that go stale while you
 *   are looking at them. Paused when the tab is in the background: nobody
 *   needs a panel polling from a window they cannot see.
 */
function useRemote<T>(load: () => Promise<T>, everyMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Bumped to ask for another read. Kept as a counter rather than calling the
  // loader directly so the effect stays the only thing that fetches, and
  // nothing sets state on the way into a render.
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load that.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  useEffect(() => {
    if (!everyMs) return;
    const tick = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const timer = setInterval(tick, everyMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [everyMs, refresh]);

  return { data, error, loading, refresh };
}

// Half a minute is often enough to watch somebody arrive, and slow enough
// that a panel left open all day is not a load on anything.
const LIVE = 30_000;

export function useAccounts() {
  return useRemote<Account[]>(async () => {
    const { data, error } = await supabase().rpc("admin_accounts");
    if (error) throw new Error(error.message);
    return (data ?? []) as Account[];
  }, LIVE);
}

export function useStats() {
  return useRemote<Stats>(async () => {
    const { data, error } = await supabase().rpc("admin_stats");
    if (error) throw new Error(error.message);
    return data as Stats;
  }, LIVE);
}

/**
 * "3 minutes ago" rather than a date. Precise where it matters (someone here
 * now) and vague where it does not (someone last here in March).
 */
export function agoLabel(iso: string | null): string {
  if (!iso) return "never";
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 90) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

/** Here in the last five minutes — the window the database counts as "now". */
export function isOnline(iso: string | null): boolean {
  return !!iso && Date.now() - new Date(iso).getTime() < 5 * 60 * 1000;
}

export function useActionLog() {
  return useRemote<AdminAction[]>(async () => {
    const { data, error } = await supabase()
      .from("admin_actions")
      .select("id, actor_email, target_email, action, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as AdminAction[];
  });
}

/**
 * Suspend, restore or delete. Goes through the server rather than the database
 * directly: only the server holds the key that can touch an account, and only
 * after checking the caller is an admin.
 */
export async function actOnAccount(
  action: "suspend" | "unsuspend" | "delete",
  userId: string,
  reason: string
): Promise<void> {
  const res = await fetch("/api/admin/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, userId, reason }),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? "That didn't work.");
}
