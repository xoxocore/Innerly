"use client";

import { useEffect, useState } from "react";
import { Heart as HeartIcon } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";

/**
 * The one thing a reader can do.
 *
 * There is no sign-in, so "who" is a random id this browser keeps to itself.
 * That is not an identity and is not claimed to be one — it exists so that one
 * person tapping twice is one heart rather than two, and so they can take it
 * back if they meant to.
 */

const VIEWER_KEY = "innerly:viewer";

function viewerId(): string {
  try {
    const kept = localStorage.getItem(VIEWER_KEY);
    if (kept && kept.length >= 8) return kept;
    const made = crypto.randomUUID();
    localStorage.setItem(VIEWER_KEY, made);
    return made;
  } catch {
    // A browser refusing storage still gets to leave a heart; it just cannot
    // be recognised as the same reader next time.
    return crypto.randomUUID();
  }
}

export function Heart({ token, hearts }: { token: string; hearts: number }) {
  const [count, setCount] = useState(hearts);
  const [loved, setLoved] = useState(false);
  const [ready, setReady] = useState(false);

  // Whether this reader has already hearted it can only be known in the
  // browser, so the card renders unhearted and corrects itself.
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    let alive = true;
    createClient(url, key, { auth: { persistSession: false } })
      .rpc("vision_share_get", { share_token: token, viewer_id: viewerId() })
      .then(({ data }) => {
        const row = Array.isArray(data) ? data[0] : null;
        if (!alive || !row) return;
        setCount(row.hearts ?? 0);
        setLoved(!!row.hearted);
        setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  const tap = async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;

    // Answered on screen straight away; the count is corrected from whatever
    // the database says, which is also how a second reader's heart shows up.
    const next = !loved;
    setLoved(next);
    setCount((n) => Math.max(0, n + (next ? 1 : -1)));

    const { data } = await createClient(url, key, {
      auth: { persistSession: false },
    }).rpc("vision_share_heart", {
      share_token: token,
      viewer_id: viewerId(),
      loved: next,
    });
    if (typeof data === "number") setCount(data);
  };

  return (
    <button
      onClick={tap}
      aria-pressed={loved}
      aria-label={loved ? "Take back your heart" : "Leave a heart"}
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[12.5px] tabular-nums text-muted-foreground transition-colors hover:bg-accent"
    >
      <HeartIcon
        className={cn(
          "h-4 w-4 transition-transform",
          loved && "scale-110 fill-current text-[#f2709c]"
        )}
      />
      {count > 0 && <span className={cn(loved && "text-foreground")}>{count}</span>}
      {!ready && count === 0 && <span className="sr-only">Loading</span>}
    </button>
  );
}
