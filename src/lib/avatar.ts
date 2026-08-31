"use client";

import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { currentUserId } from "@/lib/sync";

/**
 * The profile picture.
 *
 * Same arrangement as vision images: a private bucket, a path that starts with
 * the owner's id, and a signed link to render it. Nobody else in Innerly ever
 * sees your face — there is no feed and the admin panel shows no pictures — so
 * a public bucket would be publishing something the product never asks for.
 */

const BUCKET = "avatars";
const TTL_SECONDS = 3600;
const REFRESH_BEFORE_MS = 5 * 60 * 1000;

/**
 * Small on purpose. It is shown at 56 pixels and nowhere larger, so a 256px
 * square is already generous, and it means a 12MP phone photo becomes a ~20KB
 * upload instead of a slow one that fails on bad hotel wifi.
 */
const SIZE = 256;

/** Anything past this is a mistake or an attack, not a profile picture. */
export const MAX_BYTES = 8 * 1024 * 1024;

let signed: { url: string; expires: number; path: string } | null = null;

export function avatarsEnabled(): boolean {
  return isSupabaseConfigured && currentUserId() !== null;
}

/**
 * Square, downscaled, and re-encoded as JPEG.
 *
 * Re-encoding is not only about size: it drops the EXIF block, and with it the
 * GPS coordinates most phones write into a photo. Uploading a picture of
 * yourself should not also upload where you were standing.
 */
export async function prepare(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that image.");
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();

  const blob = await new Promise<Blob | null>((done) =>
    canvas.toBlob(done, "image/jpeg", 0.9)
  );
  if (!blob) throw new Error("Could not read that image.");
  return blob;
}

/** Upload and return the stored path, or null if there is nowhere to put it. */
export async function uploadAvatar(file: File): Promise<string | null> {
  const owner = currentUserId();
  if (!owner || !isSupabaseConfigured) return null;

  const blob = await prepare(file);
  // A changing filename, so a replaced picture is never served from a cache
  // that still holds the old one.
  const path = `${owner}/${Date.now()}.jpg`;

  const { error } = await supabase()
    .storage.from(BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });

  if (error) {
    // The one error worth naming specifically: it means migration 0009 has
    // not been run yet, and "Bucket not found" on its own sends somebody
    // hunting for a bug rather than a missing setup step.
    if (/bucket not found/i.test(error.message)) {
      throw new Error(
        "Photo storage isn't set up yet — run migration 0009 in Supabase, then try again."
      );
    }
    throw new Error(error.message);
  }
  signed = null;
  return path;
}

/** A link that works for an hour, cached until shortly before it stops. */
export async function signAvatar(path: string | null): Promise<string | null> {
  if (!path || !isSupabaseConfigured) return null;

  const now = Date.now();
  if (signed && signed.path === path && signed.expires - now > REFRESH_BEFORE_MS) {
    return signed.url;
  }

  const { data, error } = await supabase()
    .storage.from(BUCKET)
    .createSignedUrl(path, TTL_SECONDS);

  if (error || !data?.signedUrl) return null;
  signed = { url: data.signedUrl, expires: now + TTL_SECONDS * 1000, path };
  return data.signedUrl;
}

/**
 * Take the picture away, and everything before it.
 *
 * Each upload gets a fresh name, so removing only the current one would leave
 * every previous picture sitting in the bucket after somebody asked for it to
 * be gone. "Remove my photo" has to mean all of them.
 */
export async function removeAvatar(): Promise<void> {
  const owner = currentUserId();
  if (!owner || !isSupabaseConfigured) return;

  const { data } = await supabase().storage.from(BUCKET).list(owner);
  const paths = (data ?? []).map((f) => `${owner}/${f.name}`);
  if (paths.length) await supabase().storage.from(BUCKET).remove(paths);
  signed = null;
}
