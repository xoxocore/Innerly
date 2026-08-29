"use client";

import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { currentUserId } from "@/lib/sync";
import { KEYS, storage } from "@/lib/storage";

/**
 * Records that somebody opened Innerly, and when.
 *
 * Deliberately the narrowest thing that answers "is anyone using this": the
 * date, and a timestamp. Not what was written, not how much, not which screen.
 * Two rows, both of which the person could read about themselves.
 *
 * The day already lived in the browser; the admin panel's numbers were reading
 * a table nothing wrote to, so every activity figure showed zero.
 */

const FIVE_MINUTES = 5 * 60 * 1000;
let lastSent = 0;
let backfilled = false;

function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function recordVisit() {
  if (!isSupabaseConfigured) return;
  const userId = currentUserId();
  if (!userId) return;

  // Opening five screens in a minute is one visit, not five.
  const now = Date.now();
  if (now - lastSent < FIVE_MINUTES) return;
  lastSent = now;

  const client = supabase();

  // The days recorded before this account existed, or before the table was
  // being written to, are still theirs. Carried up once so the panel's "days
  // used" is right from the first visit rather than starting from zero.
  if (!backfilled) {
    backfilled = true;
    const local = storage.read<string[]>(KEYS.usageDays, []);
    const rows = local
      .filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d))
      .slice(-400)
      .map((day) => ({ user_id: userId, day }));
    if (rows.length) {
      await client.from("usage_days").upsert(rows, { onConflict: "user_id,day" });
    }
  }

  await client
    .from("usage_days")
    .upsert({ user_id: userId, day: today() }, { onConflict: "user_id,day" });

  await client
    .from("profiles")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", userId);
}

/**
 * Keeps the timestamp fresh while the app is open, so "last seen" means what
 * it says rather than "when they first loaded the page this morning".
 * Deliberately slow — this is presence, not tracking.
 */
export function startPresence(): () => void {
  void recordVisit();
  const timer = setInterval(() => void recordVisit(), FIVE_MINUTES);

  // Coming back to a tab left open overnight should count as being here.
  const onVisible = () => {
    if (document.visibilityState === "visible") void recordVisit();
  };
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
