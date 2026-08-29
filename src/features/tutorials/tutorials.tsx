"use client";

import { ArrowLeft, Clock, Heart, Loader2 } from "lucide-react";
import { ScreenHeader } from "@/components/innerly/screen-header";
import { cn } from "@/lib/utils";
import { copy } from "@/lib/copy";
import { useApp } from "@/state/app-context";
import { usePosts, useReadingTime } from "@/features/reading/use-reading";
import { Cover } from "@/features/blog/blog";

const c = copy.tutorials;

export function Tutorials() {
  const { route, navigate } = useApp();
  const { posts, counts, hearted, toggleHeart } = usePosts("tutorial");
  const tut = route.slug ? posts?.find((t) => t.slug === route.slug) : null;

  useReadingTime(tut?.id);

  if (posts === null) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tut) {
    const liked = hearted.has(tut.id);
    return (
      <article className="mx-auto max-w-[680px]">
        <button
          onClick={() => navigate("tutorials")}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {c.title}
        </button>

        <Cover post={tut} className="h-44 w-full rounded-3xl" />

        {tut.duration && (
          <p className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> {tut.duration}
          </p>
        )}
        <h1 className="mt-3 text-[2rem] font-normal leading-tight tracking-tight text-heading">
          {tut.title}
        </h1>

        <div
          className="post-body mt-7 text-[17px] leading-relaxed text-foreground/90"
          dangerouslySetInnerHTML={{ __html: tut.content }}
        />

        <div className="mt-10 flex items-center gap-3 border-t border-border/60 pt-6">
          <button
            onClick={() => toggleHeart(tut.id)}
            aria-pressed={liked}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-medium transition-colors",
              liked
                ? "border-transparent bg-[var(--brand-green-strong)] text-white"
                : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Heart className={cn("h-4 w-4", liked && "fill-current")} />
            {liked ? "Helped me" : "This helped"}
          </button>
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
          {posts.map((t) => (
            <button
              key={t.id}
              onClick={() => navigate("tutorials", t.slug)}
              className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card text-left transition-transform hover:-translate-y-0.5"
            >
              <Cover post={t} className="h-32 w-full shrink-0" />
              <span className="flex flex-1 flex-col p-5">
                {t.duration && (
                  <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    <Clock className="h-3 w-3" /> {t.duration}
                  </span>
                )}
                <span className="title-strong mt-2 text-[15px] leading-snug text-heading">
                  {t.title}
                </span>
                <span className="mt-2 line-clamp-3 flex-1 text-[13px] leading-relaxed text-muted-foreground">
                  {t.excerpt}
                </span>
                {(counts.get(t.id)?.hearts ?? 0) > 0 && (
                  <span className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] tabular-nums text-muted-foreground">
                    <Heart
                      className={cn("h-3.5 w-3.5", hearted.has(t.id) && "fill-current text-[var(--brand-green-ink)]")}
                    />
                    {counts.get(t.id)?.hearts}
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
