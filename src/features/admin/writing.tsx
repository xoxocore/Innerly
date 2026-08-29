"use client";

import { useCallback, useEffect, useState } from "react";
import { Heart, Loader2, Plus, BookOpen, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchAll, fetchCounts, type Post, type PostCounts, type PostKind } from "@/lib/posts";
import { PostForm } from "./post-form";

/**
 * Everything written, published or not, with how it has been received.
 *
 * Hearts and readers are counts. Who hearted or read what stays fenced to the
 * person who did it — the panel is here to tell you whether a post landed, not
 * who was reading at eleven on a Tuesday.
 */
export function Writing() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [counts, setCounts] = useState<Map<string, PostCounts>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ post: Post | null; kind: PostKind } | null>(null);
  const [tab, setTab] = useState<PostKind>("blog");

  const load = useCallback(() => {
    Promise.all([fetchAll(), fetchCounts()])
      .then(([p, c]) => {
        setPosts(p);
        setCounts(c);
        setError(null);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Could not load your writing.")
      );
  }, []);

  useEffect(load, [load]);

  if (editing) {
    return (
      <PostForm
        post={editing.post}
        kind={editing.kind}
        onClose={(changed) => {
          setEditing(null);
          if (changed) load();
        }}
      />
    );
  }

  if (error)
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <p className="text-[13px] text-destructive">{error}</p>
      </div>
    );
  if (!posts)
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );

  const shown = posts.filter((p) => p.kind === tab);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-full border border-border p-1">
          {(["blog", "tutorial"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[13px] transition-colors",
                tab === k
                  ? "bg-secondary font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {k === "blog" ? "Blog" : "Tutorials"}
            </button>
          ))}
        </div>

        <button
          onClick={() => setEditing({ post: null, kind: tab })}
          style={{ backgroundColor: "var(--brand-green-strong)" }}
          className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          {tab === "blog" ? "Write a post" : "Write a tutorial"}
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card px-5 py-16 text-center">
          <BookOpen className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-[13.5px] text-heading">Nothing here yet</p>
          <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">
            Whatever you write appears in the app as soon as you publish it. No
            deploy, no waiting.
          </p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-3xl border border-border bg-card">
          {shown.map((p, i) => {
            const c = counts.get(p.id);
            return (
              <li key={p.id} className={cn(i > 0 && "border-t border-border/70")}>
                <button
                  onClick={() => setEditing({ post: p, kind: p.kind })}
                  className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-accent/40 sm:px-5"
                >
                  <span
                    className="hidden h-11 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary sm:block"
                    style={
                      !p.cover_path && p.gradient
                        ? { backgroundImage: `linear-gradient(135deg, ${p.gradient[0]}, ${p.gradient[1]})` }
                        : undefined
                    }
                  >
                    {p.cover_path && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.cover_path} alt="" className="h-full w-full object-cover" />
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[13.5px] font-medium text-heading">
                        {p.title || "Untitled"}
                      </span>
                      {!p.published && (
                        <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Draft
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                      {p.excerpt || "No summary yet"}
                    </span>
                  </span>

                  {p.published && (
                    <span className="flex shrink-0 gap-4 text-[12px] tabular-nums text-muted-foreground">
                      <span className="inline-flex items-center gap-1" title="Hearts">
                        <Heart className="h-3.5 w-3.5" /> {c?.hearts ?? 0}
                      </span>
                      <span className="inline-flex items-center gap-1" title="People who read it">
                        <Eye className="h-3.5 w-3.5" /> {c?.readers ?? 0}
                      </span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
