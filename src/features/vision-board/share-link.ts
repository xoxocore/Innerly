"use client";

import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import type { VisionItem } from "@/lib/types";

/**
 * Sending one vision card to somebody.
 *
 * A share is a copy taken at the moment it is made, not a window onto the
 * board. Editing the vision afterwards does not quietly change what was sent,
 * and nothing a reader can reach touches the private board it came from — the
 * only way to update a shared card is to share it again.
 *
 * The same card always gets the same link, so re-sharing after an edit does
 * not scatter a second URL while the first one is still in somebody's chat.
 */

export type Share = { itemId: string; token: string; hearts: number };

export function sharingAvailable(): boolean {
  return isSupabaseConfigured;
}

/** The link to hand somebody. Absolute, because it is going into a message. */
export function shareUrl(token: string): string {
  const base = typeof window === "undefined" ? "" : window.location.origin;
  return `${base}/v/${token}`;
}

export async function shareVisionLink(item: VisionItem): Promise<string | null> {
  if (!sharingAvailable()) return null;
  const { data, error } = await supabase().rpc("vision_share_put", {
    p_item_id: item.id,
    p_title: item.title,
    p_description: item.description ?? null,
    p_image_path: item.imagePath ?? null,
    // A signed URL expires within the hour, so it is never what gets stored —
    // only a link somebody actually pasted is worth keeping.
    p_image_url: item.imagePath ? null : (item.imageUrl ?? null),
  });
  if (error) throw new Error(error.message);
  return typeof data === "string" ? data : null;
}

export async function stopSharing(token: string): Promise<void> {
  if (!sharingAvailable()) return;
  const { error } = await supabase()
    .from("vision_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token", token);
  if (error) throw new Error(error.message);
}

/** Every card of mine that is currently shared, and what came back. */
export async function fetchShares(): Promise<Map<string, Share>> {
  const out = new Map<string, Share>();
  if (!sharingAvailable()) return out;
  const { data, error } = await supabase().rpc("vision_share_mine");
  if (error || !Array.isArray(data)) return out;
  for (const row of data as { item_id: string; token: string; hearts: number }[]) {
    out.set(row.item_id, {
      itemId: row.item_id,
      token: row.token,
      hearts: row.hearts ?? 0,
    });
  }
  return out;
}

/**
 * Copying the old way, for browsers that refuse the new one.
 *
 * `document.execCommand` is deprecated and still the only thing that works in
 * a few places the modern clipboard does not — inside a frame, or on an older
 * phone browser. It needs a real selection in a real field, which is why it
 * takes the input rather than a string.
 */
export function copyBySelection(field: HTMLInputElement): boolean {
  try {
    field.focus();
    field.select();
    field.setSelectionRange(0, field.value.length);
    return document.execCommand("copy");
  } catch {
    return false;
  }
}
