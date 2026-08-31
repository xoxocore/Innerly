"use client";

import { ArrowLeft, Heart, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { copy } from "@/lib/copy";
import { gradient } from "@/lib/content";
import { useApp } from "@/state/app-context";
import { usePosts, useReadingTime } from "@/features/reading/use-reading";
import type { Post } from "@/lib/posts";

const c = copy.blog;

/**
 * How long something counts as new.
 *
 * A week, because that is how often writing appears and how long somebody is
 * likely to leave between visits. Anything published inside it leads the page;
 * everything else moves to the column on the right rather than disappearing.
 */
const FEATURED_DAYS = 7;

/** Shown up front when nothing is recent, so the page is never bare. */
const FALLBACK_FEATURED = 4;

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function shortDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * This week's writing, and everything before it.
 *
 * Sorted newest first either way, so a quiet week still leads with the most
 * recent thing rather than with whatever happens to be first in the table.
 */
function arrange(posts: Post[]): { featured: Post[]; rest: Post[] } {
  const newest = [...posts].sort(
    (a, b) =>
      new Date(b.published_at ?? 0).getTime() -
      new Date(a.published_at ?? 0).getTime()
  );
  const cutoff = Date.now() - FEATURED_DAYS * 864e5;
  const thisWeek = newest.filter(
    (p) => p.published_at && new Date(p.published_at).getTime() >= cutoff
  );

  const featured = thisWeek.length > 0 ? thisWeek : newest.slice(0, FALLBACK_FEATURED);
  const ids = new Set(featured.map((p) => p.id));
  return { featured, rest: newest.filter((p) => !ids.has(p.id)) };
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
          className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {c.title}
        </button>

        <Cover post={post} className="aspect-[16/9] w-full rounded-2xl" />

        <p className="mt-6 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {[post.category, formatDate(post.published_at)].filter(Boolean).join(" · ")}
        </p>
        <h1 className="title-regular mt-2.5 text-[1.75rem] leading-tight tracking-tight text-heading">
          {post.title}
        </h1>

        <div
          className="post-body mt-6 text-[15.5px] leading-relaxed text-foreground/90"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        <div className="mt-10 flex items-center gap-3 border-t border-border/60 pt-6">
          <button
            onClick={() => toggleHeart(post.id)}
            aria-pressed={liked}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[12.5px] font-medium transition-colors",
              liked
                ? "border-transparent bg-[var(--brand-green-strong)] text-white"
                : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Heart className={cn("h-4 w-4", liked && "fill-current")} />
            {liked ? "Loved this" : "Love this"}
          </button>
          {hearts > 0 && (
            <span className="text-[12px] tabular-nums text-muted-foreground">
              {hearts} {hearts === 1 ? "person found this useful" : "people found this useful"}
            </span>
          )}
        </div>
      </article>
    );
  }

  const { featured, rest } = arrange(posts);

  return (
    <div>
      <header className="mb-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {c.breadcrumb}
        </p>
        <h1 className="title-regular mt-2 text-[1.35rem] leading-[1.15] tracking-tight text-heading sm:text-[1.5rem]">
          {c.title}
        </h1>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
          {c.subtitle}
        </p>
      </header>

      {posts.length === 0 ? (
        <p className="rounded-3xl border border-border bg-card px-5 py-14 text-center text-[13px] text-muted-foreground">
          Nothing published yet. Check back soon.
        </p>
      ) : (
        <div className="grid gap-7 lg:grid-cols-[1fr_260px]">
          {/* --------------------------------------------------- the lead */}
          <section>
            <SectionLabel>
              {featured.length > 0 && isThisWeek(featured[0])
                ? "This week"
                : "Featured"}
            </SectionLabel>
            <div className="grid gap-5 sm:grid-cols-2">
              {featured.map((p) => (
                <FeatureCard
                  key={p.id}
                  post={p}
                  hearts={counts.get(p.id)?.hearts ?? 0}
                  liked={hearted.has(p.id)}
                  onOpen={() => navigate("blog", p.slug)}
                />
              ))}
            </div>
          </section>

          {/* ------------------------------------------------ what came before */}
          {rest.length > 0 && (
            <aside className="lg:sticky lg:top-6 lg:self-start">
              <SectionLabel>Earlier</SectionLabel>
              <ul className="flex flex-col gap-3">
                {rest.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => navigate("blog", p.slug)}
                      className="group flex w-full gap-3 text-left"
                    >
                      <Cover
                        post={p}
                        className="h-14 w-16 shrink-0 rounded-xl object-cover"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 block text-[12.5px] font-medium leading-snug text-heading transition-colors group-hover:text-[var(--brand-green-ink)]">
                          {p.title}
                        </span>
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {shortDate(p.published_at)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}

function isThisWeek(post: Post): boolean {
  if (!post.published_at) return false;
  return new Date(post.published_at).getTime() >= Date.now() - FEATURED_DAYS * 864e5;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
      {children}
    </p>
  );
}

function FeatureCard({
  post,
  hearts,
  liked,
  onOpen,
}: {
  post: Post;
  hearts: number;
  liked: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-left transition-transform hover:-translate-y-0.5"
    >
      <Cover post={post} className="aspect-[16/10] w-full shrink-0" />
      <span className="flex flex-1 flex-col p-4">
        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {[post.category, shortDate(post.published_at)].filter(Boolean).join(" · ")}
        </span>
        <span className="title-strong mt-1.5 text-[14px] leading-snug text-heading">
          {post.title}
        </span>
        <span className="mt-1.5 line-clamp-3 flex-1 text-[12px] leading-relaxed text-muted-foreground">
          {post.excerpt}
        </span>
        {hearts > 0 && (
          <span className="mt-3 inline-flex items-center gap-1.5 text-[11px] tabular-nums text-muted-foreground">
            <Heart
              className={cn(
                "h-3.5 w-3.5",
                liked && "fill-current text-[var(--brand-green-ink)]"
              )}
            />
            {hearts}
          </span>
        )}
      </span>
    </button>
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
