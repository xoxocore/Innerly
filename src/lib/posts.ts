"use client";

import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { currentUserId } from "@/lib/sync";

export type PostKind = "blog" | "tutorial";

export type Post = {
  id: string;
  kind: PostKind;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string | null;
  duration: string | null;
  cover_path: string | null;
  gradient: [string, string] | null;
  published: boolean;
  published_at: string | null;
  updated_at: string;
};

export type PostCounts = { hearts: number; readers: number };

const COLUMNS =
  "id, kind, slug, title, excerpt, content, category, duration, cover_path, gradient, published, published_at, updated_at";

/** What the app shows: published only. Anyone may read these, signed in or not. */
export async function fetchPublished(kind: PostKind): Promise<Post[]> {
  const { data, error } = await supabase()
    .from("posts")
    .select(COLUMNS)
    .eq("kind", kind)
    .eq("published", true)
    .order("published_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Post[];
}

/** What the panel shows: drafts as well. The policy refuses this to everyone else. */
export async function fetchAll(): Promise<Post[]> {
  const { data, error } = await supabase()
    .from("posts")
    .select(COLUMNS)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Post[];
}

export async function savePost(post: Partial<Post> & { kind: PostKind; slug: string }) {
  const row = {
    ...post,
    published_at:
      post.published && !post.published_at ? new Date().toISOString() : post.published_at,
  };
  const { data, error } = await supabase()
    .from("posts")
    .upsert(row, { onConflict: "kind,slug" })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as Post;
}

export async function deletePost(id: string) {
  const { error } = await supabase().from("posts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* --------------------------------------------------------------- images --- */

/**
 * Pictures inside a post go in the public bucket: a blog post the world can
 * read is no use with images only its author can see. Named by a random id
 * rather than the filename, so uploading "IMG_2024.jpg" twice does not have
 * the second quietly replace the first.
 */
export async function uploadPostImage(file: File): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().slice(0, 5);
  const id = crypto.randomUUID();
  const path = `${id}.${ext}`;

  const { error } = await supabase()
    .storage.from("posts")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);

  const { data } = supabase().storage.from("posts").getPublicUrl(path);
  return data.publicUrl;
}

/* ---------------------------------------------------------- hearts/reads --- */

export async function fetchCounts(): Promise<Map<string, PostCounts>> {
  const out = new Map<string, PostCounts>();
  if (!isSupabaseConfigured) return out;
  const { data, error } = await supabase().rpc("post_counts");
  if (error) return out;
  for (const row of (data ?? []) as { post_id: string; hearts: number; readers: number }[]) {
    out.set(row.post_id, { hearts: Number(row.hearts), readers: Number(row.readers) });
  }
  return out;
}

export async function fetchMyHearts(): Promise<Set<string>> {
  const out = new Set<string>();
  const userId = currentUserId();
  if (!userId) return out;
  const { data } = await supabase().from("post_hearts").select("post_id").eq("user_id", userId);
  for (const row of (data ?? []) as { post_id: string }[]) out.add(row.post_id);
  return out;
}

export async function setHeart(postId: string, on: boolean) {
  const userId = currentUserId();
  if (!userId) return;
  const client = supabase();
  if (on) {
    await client.from("post_hearts").upsert({ post_id: postId, user_id: userId });
  } else {
    await client.from("post_hearts").delete().eq("post_id", postId).eq("user_id", userId);
  }
}

/**
 * Records that a post was read, and roughly for how long.
 *
 * Seconds are counted only while the tab is actually in front — a post left
 * open in a background tab for an hour is not an hour of reading, and counting
 * it that way would make the number a lie.
 */
export async function recordRead(postId: string, seconds: number) {
  const userId = currentUserId();
  if (!userId || !isSupabaseConfigured) return;
  const day = new Date().toISOString().slice(0, 10);

  const client = supabase();
  const { data: existing } = await client
    .from("post_reads")
    .select("seconds")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .eq("day", day)
    .maybeSingle();

  const total = Math.min(60 * 60, (existing?.seconds ?? 0) + Math.round(seconds));
  await client
    .from("post_reads")
    .upsert({ post_id: postId, user_id: userId, day, seconds: total });
}
