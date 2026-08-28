"use client";

import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { currentUserId } from "@/lib/sync";

/**
 * Vision-board photos, in Supabase Storage.
 *
 * They used to live in the browser as data URLs, which capped a whole board at
 * roughly 5MB — about three photos, after which saving stopped without saying
 * so. That ceiling is the browser's and cannot be raised, so the photos had to
 * move.
 *
 * The bucket is private: no photo is readable by URL alone. Rendering one means
 * asking Supabase to sign a link that lasts an hour and belongs to the person
 * who uploaded it. That is a little more work than a public bucket, and it is
 * the difference between "hard to guess" and "cannot be read".
 */

const BUCKET = "visions";

// An hour is Supabase's default; anything longer is a link that outlives the
// session it was made for. Re-signed well before expiry so a board left open
// does not start showing broken images.
const TTL_SECONDS = 3600;
const REFRESH_BEFORE_MS = 5 * 60 * 1000;

type Signed = { url: string; expires: number };
const cache = new Map<string, Signed>();

/** True when uploads have somewhere to go: keys configured and someone signed in. */
export function storageEnabled(): boolean {
  return isSupabaseConfigured && currentUserId() !== null;
}

export function isDataUrl(value: string | undefined): boolean {
  return !!value && value.startsWith("data:");
}

function extensionFor(dataUrl: string): string {
  const m = /^data:image\/([a-z0-9.+-]+)/i.exec(dataUrl);
  const type = (m?.[1] ?? "jpeg").toLowerCase();
  return type === "jpeg" ? "jpg" : type;
}

function toBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(head)?.[1] ?? "image/jpeg";
  const bytes = atob(body);
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

/**
 * Put one photo in the bucket and return its path.
 *
 * The path starts with the owner's id because that is what the storage policy
 * compares against — the first segment is the fence, not a tidy-up.
 */
export async function uploadVisionImage(
  dataUrl: string,
  itemId: string
): Promise<string | null> {
  const owner = currentUserId();
  if (!owner || !isSupabaseConfigured) return null;

  const path = `${owner}/${itemId}.${extensionFor(dataUrl)}`;
  const blob = toBlob(dataUrl);

  const { error } = await supabase()
    .storage.from(BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: true });

  if (error) {
    console.warn("[innerly] could not upload vision image:", error.message);
    return null;
  }
  cache.delete(path);
  return path;
}

/** Sign a batch of paths at once — a board is many photos, not one. */
export async function signVisionImages(
  paths: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!isSupabaseConfigured || paths.length === 0) return out;

  const now = Date.now();
  const stale: string[] = [];
  for (const path of paths) {
    const hit = cache.get(path);
    if (hit && hit.expires - now > REFRESH_BEFORE_MS) out.set(path, hit.url);
    else stale.push(path);
  }
  if (stale.length === 0) return out;

  const { data, error } = await supabase()
    .storage.from(BUCKET)
    .createSignedUrls(stale, TTL_SECONDS);

  if (error) {
    console.warn("[innerly] could not sign vision images:", error.message);
    return out;
  }

  const expires = now + TTL_SECONDS * 1000;
  for (const row of data ?? []) {
    if (!row.signedUrl || !row.path) continue;
    cache.set(row.path, { url: row.signedUrl, expires });
    out.set(row.path, row.signedUrl);
  }
  return out;
}

/**
 * Remove photos for items that have been deleted. Best effort: a photo left
 * behind costs a little space, whereas refusing to delete the vision because
 * its photo could not be reached would be the app arguing with the person.
 */
export async function deleteVisionImages(paths: string[]) {
  const owner = currentUserId();
  if (!owner || !isSupabaseConfigured || paths.length === 0) return;

  // Only ever delete under your own prefix. The policy enforces this too; this
  // is the cheaper of the two places to catch a mistake.
  const mine = paths.filter((p) => p.startsWith(`${owner}/`));
  if (mine.length === 0) return;

  for (const p of mine) cache.delete(p);
  const { error } = await supabase().storage.from(BUCKET).remove(mine);
  if (error) console.warn("[innerly] could not delete vision image:", error.message);
}
