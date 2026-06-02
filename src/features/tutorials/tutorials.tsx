"use client";

import { ArrowLeft, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScreenHeader } from "@/components/innerly/screen-header";
import { copy } from "@/lib/copy";
import { TUTORIALS, gradient } from "@/lib/content";
import { useApp } from "@/state/app-context";

const c = copy.tutorials;

export function Tutorials() {
  const { route, navigate } = useApp();
  const tut = route.slug ? TUTORIALS.find((t) => t.slug === route.slug) : null;

  if (tut) {
    return (
      <article>
        <button
          onClick={() => navigate("tutorials")}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {c.title}
        </button>
        <div
          className="h-44 w-full rounded-3xl"
          style={{ backgroundImage: gradient(tut.gradient) }}
        />
        <p className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> {tut.duration}
        </p>
        <h1 className="mt-3 text-[2rem] font-bold leading-tight tracking-tight text-heading">
          {tut.title}
        </h1>
        <div
          className="mt-6 space-y-4 text-[17px] leading-relaxed text-foreground/90"
          dangerouslySetInnerHTML={{ __html: tut.content }}
        />
      </article>
    );
  }

  return (
    <div>
      <ScreenHeader breadcrumb={c.breadcrumb} title={c.title} subtitle={c.subtitle} />
      <div className="space-y-4">
        {TUTORIALS.map((t) => (
          <button
            key={t.slug}
            onClick={() => navigate("tutorials", t.slug)}
            className="block w-full text-left"
          >
            <Card className="flex items-center gap-4 overflow-hidden p-4 transition-colors hover:bg-accent">
              <div
                className="h-16 w-16 shrink-0 rounded-2xl"
                style={{ backgroundImage: gradient(t.gradient) }}
              />
              <div className="min-w-0">
                <h3 className="text-[17px] font-semibold text-heading">{t.title}</h3>
                <p className="mt-1 line-clamp-2 text-[15px] leading-relaxed text-muted-foreground">
                  {t.excerpt}
                </p>
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> {t.duration}
                </p>
              </div>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}
