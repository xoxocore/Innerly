"use client";

import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScreenHeader } from "@/components/innerly/screen-header";
import { copy } from "@/lib/copy";
import { BLOG_POSTS, gradient } from "@/lib/content";
import { useApp } from "@/state/app-context";

const c = copy.blog;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function Blog() {
  const { route, navigate } = useApp();
  const post = route.slug
    ? BLOG_POSTS.find((p) => p.slug === route.slug)
    : null;

  if (post) {
    return (
      <article>
        <button
          onClick={() => navigate("blog")}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {c.title}
        </button>
        <div
          className="h-44 w-full rounded-3xl"
          style={{ backgroundImage: gradient(post.gradient) }}
        />
        <p className="mt-6 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {post.category} · {formatDate(post.date)}
        </p>
        <h1 className="mt-3 text-[2rem] font-bold leading-tight tracking-tight text-heading">
          {post.title}
        </h1>
        <div
          className="prose-innerly mt-6 space-y-4 text-[17px] leading-relaxed text-foreground/90"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      </article>
    );
  }

  return (
    <div>
      <ScreenHeader breadcrumb={c.breadcrumb} title={c.title} subtitle={c.subtitle} />
      <div className="grid gap-5 sm:grid-cols-2">
        {BLOG_POSTS.map((p) => (
          <button
            key={p.slug}
            onClick={() => navigate("blog", p.slug)}
            className="text-left"
          >
            <Card className="h-full overflow-hidden transition-colors hover:bg-accent">
              <div
                className="h-32 w-full"
                style={{ backgroundImage: gradient(p.gradient) }}
              />
              <div className="p-5">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  {p.category}
                </p>
                <h3 className="mt-2 text-lg font-semibold leading-snug text-heading">
                  {p.title}
                </h3>
                <p className="mt-2 line-clamp-3 text-[15px] leading-relaxed text-muted-foreground">
                  {p.excerpt}
                </p>
              </div>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}
