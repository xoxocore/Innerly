"use client";

import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { KEYS, setWriteHook, storage } from "@/lib/storage";

/**
 * Mirrors the local keyspace to Supabase, so an account is worth having:
 * write on your laptop, sign in on your phone, find your writing there.
 *
 * The shape is deliberately dull. localStorage stays the thing the screens
 * read — instantly, offline, exactly as before — and this pushes each change
 * up behind it. Nothing renders while waiting on a network call, and losing
 * the connection costs you a sync, not your work.
 *
 * What it is NOT: live multi-device sync. Two devices open at once will not
 * see each other until one reloads, and the later write wins. For a private
 * journal that one person keeps, that is the honest trade — the alternative
 * is a merge story with far more ways to lose a paragraph.
 */

// Derived from the key list rather than written out again, so the two cannot
// drift apart without the compiler noticing.
const PREFIX = KEYS.profile.slice(0, KEYS.profile.indexOf(":") + 1);

// Which account the local cache belongs to. Kept OUTSIDE the innerly: keyspace
// so that wiping the cache cannot also wipe the record of whose it was.
const OWNER_KEY = "innerly-owner";

// jsonb will take far more, but a multi-megabyte value means vision-board
// photos held as data URLs, which have to move to Storage rather than be
// pushed through here on every edit. Skipped loudly instead of silently.
const MAX_VALUE_BYTES = 4_000_000;

const DEBOUNCE_MS = 800;

let currentUser: string | null = null;
let pulling = false;

const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Every innerly: key currently in localStorage. */
function localKeys(): string[] {
  const out: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(PREFIX)) out.push(k);
  }
  return out;
}

function ownerOfCache(): string | null {
  try {
    return window.localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

/**
 * Wipes every trace of the signed-in person from this browser.
 *
 * This is the one that matters on a shared computer: without it the next
 * person to sign in inherits the last person's reflections, because the
 * screens read localStorage and localStorage does not know who is who.
 */
export function clearLocal() {
  if (typeof window === "undefined") return;
  for (const k of localKeys()) window.localStorage.removeItem(k);
  try {
    window.localStorage.removeItem(OWNER_KEY);
  } catch {
    /* private mode */
  }
}

/** Queue one key for upload. No-ops when signed out or mid-pull. */
export function push(key: string, value: unknown) {
  if (!currentUser || pulling || !isSupabaseConfigured) return;
  if (!key.startsWith(PREFIX)) return;

  const existing = timers.get(key);
  if (existing) clearTimeout(existing);

  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      void upload(key, value);
    }, DEBOUNCE_MS)
  );
}

async function upload(key: string, value: unknown) {
  const owner = currentUser;
  if (!owner) return;

  let json: string;
  try {
    json = JSON.stringify(value);
  } catch {
    return;
  }
  if (json.length > MAX_VALUE_BYTES) {
    console.warn(
      `[innerly] "${key}" is ${(json.length / 1e6).toFixed(1)}MB and was not ` +
        `backed up. Images belong in Storage, not in the state blob.`
    );
    return;
  }

  const { error } = await supabase()
    .from("user_state")
    .upsert(
      { user_id: owner, key, value, updated_at: new Date().toISOString() },
      { onConflict: "user_id,key" }
    );

  // A failed push is not worth interrupting someone mid-sentence over. The
  // local copy is intact and the next edit to this key retries.
  if (error) console.warn("[innerly] could not sync", key, error.message);
}

/** Flush anything still waiting on its debounce — before signing out. */
export async function flush() {
  const pending = [...timers.keys()];
  for (const key of pending) {
    const t = timers.get(key);
    if (t) clearTimeout(t);
    timers.delete(key);
    await upload(key, storage.read<unknown>(key, null));
  }
}

/**
 * Bring this browser in line with the account that just signed in. Returns
 * once local storage holds that account's writing and nobody else's.
 *
 * Three cases, in order:
 *   different person was here  -> wipe first, then take the server's copy
 *   server has nothing         -> this is their first sign-in; upload what
 *                                 they wrote before they had an account
 *   server has their writing   -> the server is the truth; take it
 */
export async function pull(userId: string) {
  if (!isSupabaseConfigured) return;

  currentUser = userId;
  const previous = ownerOfCache();

  // Anything left by someone else goes before a single row is read. Note this
  // also catches the pre-account case ONLY when someone else was here since;
  // a null owner with local data is treated as "yours" below.
  if (previous && previous !== userId) clearLocal();

  pulling = true;
  try {
    const { data, error } = await supabase()
      .from("user_state")
      .select("key, value")
      .eq("user_id", userId);

    if (error) {
      // Offline, or the table has not been created yet. Keep whatever is on
      // the device and carry on read-only rather than showing an empty app.
      console.warn("[innerly] could not load your account:", error.message);
      return;
    }

    const rows = data ?? [];

    if (rows.length === 0) {
      // First sign-in. Whatever they wrote before making an account is theirs
      // and comes with them; if the device is empty this uploads nothing.
      pulling = false;
      const keys = previous && previous !== userId ? [] : localKeys();
      for (const k of keys) await upload(k, storage.read<unknown>(k, null));
      return;
    }

    // Server wins. Drop local keys the server does not have, so a deletion
    // made on another device does not come back from the dead here.
    const incoming = new Set(rows.map((r) => r.key as string));
    for (const k of localKeys()) {
      if (!incoming.has(k)) window.localStorage.removeItem(k);
    }
    for (const row of rows) {
      storage.write(row.key as string, row.value);
    }
  } finally {
    pulling = false;
    try {
      window.localStorage.setItem(OWNER_KEY, userId);
    } catch {
      /* private mode */
    }
  }
}

/** Called on sign-out: flush, forget the account, wipe the device. */
export async function detach() {
  await flush();
  currentUser = null;
  clearLocal();
}

/** Exposed so a screen can tell whether edits are being backed up. */
export function isSyncing() {
  return currentUser !== null;
}

/**
 * Whose account this browser is currently holding, or null when signed out.
 * Storage paths are prefixed with it, because that first segment is what the
 * bucket policy fences on.
 */
export function currentUserId(): string | null {
  return currentUser;
}

// Installed at module load. Keeps storage.ts free of any knowledge of
// Supabase — it writes to the device and tells whoever is listening.
setWriteHook(push);
