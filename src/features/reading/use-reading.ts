"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchCounts, fetchMyHearts, fetchPublished, recordRead, setHeart,
  type Post, type PostCounts, type PostKind,
} from "@/lib/posts";
import { isSupabaseConfigured } from "@/lib/supabase/client";

/** Published writing, with its hearts and how many people have read it. */
export function usePosts(kind: PostKind) {
  // Empty rather than "still loading" when there is no backend to ask, so the
  // screens show their "nothing published" state instead of a spinner forever.
  const [posts, setPosts] = useState<Post[] | null>(isSupabaseConfigured ? null : []);
  const [counts, setCounts] = useState<Map<string, PostCounts>>(new Map());
  const [hearted, setHearted] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    Promise.all([fetchPublished(kind), fetchCounts(), fetchMyHearts()])
      .then(([p, c, h]) => {
        if (cancelled) return;
        setPosts(p);
        setCounts(c);
        setHearted(h);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setPosts([]);
          setError(e instanceof Error ? e.message : "Could not load these.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  // The count moves the moment it is tapped; the server catches up. A heart
  // that waits on a round trip feels broken even when it is working.
  const toggleHeart = useCallback(
    (postId: string) => {
      const on = !hearted.has(postId);
      setHearted((prev) => {
        const next = new Set(prev);
        if (on) next.add(postId);
        else next.delete(postId);
        return next;
      });
      setCounts((prev) => {
        const next = new Map(prev);
        const cur = next.get(postId) ?? { hearts: 0, readers: 0 };
        next.set(postId, { ...cur, hearts: Math.max(0, cur.hearts + (on ? 1 : -1)) });
        return next;
      });
      void setHeart(postId, on);
    },
    [hearted]
  );

  return { posts, counts, hearted, toggleHeart, error };
}

/**
 * Counts how long a post was actually in front of somebody.
 *
 * Only while the tab is visible: a post left open in a background tab
 * overnight is not eight hours of reading, and counting it that way would make
 * the number worse than useless.
 */
export function useReadingTime(postId: string | undefined) {
  const since = useRef<number | null>(null);
  const banked = useRef(0);

  useEffect(() => {
    if (!postId) return;
    since.current = document.visibilityState === "visible" ? Date.now() : null;
    banked.current = 0;

    const bank = () => {
      if (since.current !== null) {
        banked.current += (Date.now() - since.current) / 1000;
        since.current = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") since.current = Date.now();
      else bank();
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      bank();
      // Under three seconds is a glance or a mis-tap, not a read.
      if (banked.current >= 3) void recordRead(postId, banked.current);
    };
  }, [postId]);
}
