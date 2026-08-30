"use client";

import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { currentUserId } from "@/lib/sync";

export type NotificationKind = "news" | "tip" | "feature";
export type Audience = "everyone" | "new" | "returning";
export type Trigger = "now" | "scheduled" | "on_signin";

export type Notification = {
  id: string;
  title: string;
  body: string;
  kind: NotificationKind;
  audience: Audience;
  trigger: Trigger;
  scheduled_for: string | null;
  link_view: string | null;
  published: boolean;
  created_at: string;
  updated_at: string;
};

const COLUMNS =
  "id, title, body, kind, audience, trigger, scheduled_for, link_view, published, created_at, updated_at";

/**
 * Fills in the parts that change per person.
 *
 * Only {name} for now. Kept as a plain replace rather than a template language
 * because there is one variable, and because an unknown {token} left visible in
 * somebody's notification is a worse failure than a missing feature.
 */
export function render(text: string, name: string | undefined) {
  return text.replace(/\{name\}/g, (name ?? "").trim() || "there");
}

/** Would this reach that person? Worked out from when they signed up. */
export function matchesAudience(audience: Audience, signedUpAt: string | undefined) {
  if (audience === "everyone" || !signedUpAt) return true;
  const days = (Date.now() - new Date(signedUpAt).getTime()) / 86_400_000;
  return audience === "new" ? days < 7 : days >= 7;
}

export async function fetchAllNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase()
    .from("notifications")
    .select(COLUMNS)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Notification[];
}

export async function saveNotification(n: Partial<Notification>) {
  const { data, error } = await supabase()
    .from("notifications")
    .upsert(n)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as Notification;
}

export async function deleteNotification(id: string) {
  const { error } = await supabase().from("notifications").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchNotificationCounts() {
  const out = new Map<string, { seen: number; dismissed: number }>();
  const { data, error } = await supabase().rpc("notification_counts");
  if (error) return out;
  for (const r of (data ?? []) as { notification_id: string; seen: number; dismissed: number }[]) {
    out.set(r.notification_id, { seen: Number(r.seen), dismissed: Number(r.dismissed) });
  }
  return out;
}

/* ------------------------------------------------------ what people see --- */

export type Delivered = Notification & { seen: boolean };

/**
 * The notifications this person should be shown, in the order they should see
 * them. Filtering happens here rather than in the query because whether a
 * notification applies depends on when the READER signed up, which is on the
 * session rather than in the database's reach for a policy.
 */
export async function fetchForMe(signedUpAt: string | undefined): Promise<Delivered[]> {
  if (!isSupabaseConfigured) return [];
  const userId = currentUserId();
  if (!userId) return [];

  const now = new Date().toISOString();
  const { data, error } = await supabase()
    .from("notifications")
    .select(COLUMNS)
    .eq("published", true)
    .or(`trigger.neq.scheduled,scheduled_for.lte.${now}`)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return [];

  const { data: state } = await supabase()
    .from("notification_state")
    .select("notification_id, seen_at, dismissed_at")
    .eq("user_id", userId);

  const byId = new Map(
    ((state ?? []) as { notification_id: string; seen_at: string | null; dismissed_at: string | null }[])
      .map((s) => [s.notification_id, s])
  );

  return ((data ?? []) as Notification[])
    .filter((n) => matchesAudience(n.audience, signedUpAt))
    .filter((n) => !byId.get(n.id)?.dismissed_at)
    .map((n) => ({ ...n, seen: !!byId.get(n.id)?.seen_at }));
}

export async function markSeen(ids: string[]) {
  const userId = currentUserId();
  if (!userId || ids.length === 0) return;
  await supabase()
    .from("notification_state")
    .upsert(
      ids.map((id) => ({
        notification_id: id,
        user_id: userId,
        seen_at: new Date().toISOString(),
      }))
    );
}

export async function dismiss(id: string) {
  const userId = currentUserId();
  if (!userId) return;
  await supabase().from("notification_state").upsert({
    notification_id: id,
    user_id: userId,
    seen_at: new Date().toISOString(),
    dismissed_at: new Date().toISOString(),
  });
}
