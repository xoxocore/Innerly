"use client";

import { ArrowLeft, Heart, Loader2 } from "lucide-react";
import { ScreenHeader } from "@/components/innerly/screen-header";
import { cn } from "@/lib/utils";
import { copy } from "@/lib/copy";
import { gradient } from "@/lib/content";
import { useApp } from "@/state/app-context";
import { usePosts, useReadingTime } from "@/features/reading/use-reading";
import type { Post } from "@/lib/posts";

const c = copy.blog;

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function Blog() {
  const { route, navigate } = useApp();
  const { posts, counts, hearted, toggleHeart } = usePosts("blog");
  const post = route.slug ? posts?.find((p) => p.slug === route.slug) : null;

  // Counted only while this post is on screen and the tab is in front.
  useReadingTime(post?.id);

  if (posts === null) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (post) {
    const liked = hearted.has(post.id);
    const hearts = counts.get(post.id)?.hearts ?? 0;
    return (
      <article className="mx-auto max-w-[680px]">
        <button
          onClick={() => navigate("blog")}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {c.title}
        </button>

        <Cover post={post} className="h-44 w-full rounded-3xl" />

        <p className="mt-6 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {[post.category, formatDate(post.published_at)].filter(Boolean).join(" · ")}
        </p>
        <h1 className="mt-3 text-[2rem] font-normal leading-tight tracking-tight text-heading">
          {post.title}
        </h1>

        <div
          className="post-body mt-7 text-[17px] leading-relaxed text-foreground/90"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        <div className="mt-10 flex items-center gap-3 border-t border-border/60 pt-6">
          <button
            onClick={() => toggleHeart(post.id)}
            aria-pressed={liked}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-medium transition-colors",
              liked
                ? "border-transparent bg-[var(--brand-green-strong)] text-white"
                : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Heart className={cn("h-4 w-4", liked && "fill-current")} />
            {liked ? "Loved this" : "Love this"}
          </button>
          {hearts > 0 && (
            <span className="text-[12.5px] tabular-nums text-muted-foreground">
              {hearts} {hearts === 1 ? "person found this useful" : "people found this useful"}
            </span>
          )}
        </div>
      </article>
    );
  }

  return (
    <div>
      <ScreenHeader breadcrumb={c.breadcrumb} title={c.title} subtitle={c.subtitle} />

      {posts.length === 0 ? (
        <p className="rounded-3xl border border-border bg-card px-5 py-14 text-center text-[13.5px] text-muted-foreground">
          Nothing published yet. Check back soon.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {posts.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate("blog", p.slug)}
              className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card text-left transition-transform hover:-translate-y-0.5"
            >
              <Cover post={p} className="h-32 w-full shrink-0" />
              <span className="flex flex-1 flex-col p-5">
                <span className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {[p.category, formatDate(p.published_at)].filter(Boolean).join(" · ")}
                </span>
                <span className="title-strong mt-2 text-[15px] leading-snug text-heading">
                  {p.title}
                </span>
                <span className="mt-2 line-clamp-3 flex-1 text-[13px] leading-relaxed text-muted-foreground">
                  {p.excerpt}
                </span>
                {(counts.get(p.id)?.hearts ?? 0) > 0 && (
                  <span className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] tabular-nums text-muted-foreground">
                    <Heart
                      className={cn("h-3.5 w-3.5", hearted.has(p.id) && "fill-current text-[var(--brand-green-ink)]")}
                    />
                    {counts.get(p.id)?.hearts}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** A cover picture where there is one, the post's own gradient where there isn't. */
export function Cover({ post, className }: { post: Post; className?: string }) {
  if (post.cover_path) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={post.cover_path} alt="" className={cn("object-cover", className)} />
    );
  }
  return (
    <div
      className={className}
      style={{
        backgroundImage: gradient(post.gradient ?? ["#e8f7ef", "#d6ece0"]),
      }}
    />
  );
}
