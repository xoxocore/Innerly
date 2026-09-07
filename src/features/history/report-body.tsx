"use client";

import { useMemo } from "react";
import type { ReflectionMoment } from "@/lib/types";

/**
 * The three steps a reflection is made of.
 *
 * They are always in this order, and always labelled, because the point of
 * looking back at an entry weeks later is to follow the reasoning: this is
 * what was heavy, this is why, this is what I said I'd do. Read out of order
 * — or with the reason buried under the plan — it is just a page of text.
 */
const STEPS = {
  heavy: { n: 1, title: "What felt heavy" },
  why: { n: 2, title: "Why did it happen" },
  next: { n: 3, title: "Clear next steps to move forward" },
} as const;

type Tone = keyof typeof STEPS;

export function ReportBlock({
  tone,
  children,
}: {
  tone: Tone;
  children: React.ReactNode;
}) {
  const { n, title } = STEPS[tone];
  return (
    <section
      className="print-block overflow-hidden rounded-xl border"
      style={{ borderColor: `var(--report-${tone}-bar)` }}
    >
      <h3
        className="flex items-center gap-2.5 px-3.5 py-2 text-[11.5px] font-semibold uppercase tracking-[0.07em]"
        style={{
          backgroundColor: `var(--report-${tone}-bar)`,
          color: `var(--report-${tone}-ink)`,
        }}
      >
        <span
          aria-hidden
          className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-white/55 text-[10px] font-bold tabular-nums"
        >
          {n}
        </span>
        {title}
      </h3>
      <div
        className="px-3.5 py-3 text-[14px] leading-relaxed text-foreground"
        style={{ backgroundColor: `var(--report-${tone}-soft)` }}
      >
        {children}
      </div>
    </section>
  );
}

/* ------------------------------------------------------- the marked-up copy */

const ALLOWED = new Set([
  "P", "BR", "B", "STRONG", "I", "EM", "U", "SPAN", "DIV", "MARK", "SECTION",
]);

/**
 * Only what the marking toolbar can produce.
 *
 * Colour is deliberately not on the list. Step three seeds each card with the
 * reason in muted grey, which is unreadable on a tinted panel and wrong on
 * paper — the report decides how its own text is coloured.
 */
const KEEP_STYLE = ["font-weight", "font-style", "text-decoration"];

function clean(root: Element): string {
  for (const el of [...root.querySelectorAll("*")]) {
    if (!ALLOWED.has(el.tagName)) {
      el.replaceWith(...el.childNodes);
      continue;
    }
    const style = (el as HTMLElement).style;
    const kept: string[] = [];
    for (const prop of KEEP_STYLE) {
      const v = style.getPropertyValue(prop);
      if (v) kept.push(`${prop}:${v}`);
    }
    // Anything the marking toolbar gave a background to is a highlight. It is
    // re-rendered in the report's own colour whatever mode it was made in, so
    // a mark made at night is not a dark block on white paper.
    const bg = style.getPropertyValue("background-color");
    const highlighted =
      !!bg && bg !== "transparent" && !/rgba\(0, 0, 0, 0\)/.test(bg);

    for (const attr of [...el.attributes]) el.removeAttribute(attr.name);
    if (kept.length) el.setAttribute("style", kept.join(";"));
    if (highlighted) el.setAttribute("class", "report-mark");
  }
  return root.innerHTML.trim();
}

const norm = (s: string | null) => (s ?? "").replace(/\s+/g, " ").trim();

/**
 * The reason for one moment, carrying whatever the user marked on it.
 *
 * Step three hands back one `<section>` per moment, each seeded with the
 * moment restated above its reason and then marked up by hand. Only the reason
 * belongs here — the moment already has its own block above — so the opening
 * paragraph is dropped when it is that restatement. Matched on its text rather
 * than its position, because somebody typing in the card can add paragraphs.
 */
function markedWhy(
  review: string | undefined,
  moment: ReflectionMoment,
  index: number
): string | null {
  if (!review || typeof DOMParser === "undefined") return null;
  const sections = new DOMParser()
    .parseFromString(review, "text/html")
    .querySelectorAll("section");
  const section = sections[index];
  if (!section) return null;

  const first = section.firstElementChild;
  if (first && norm(first.textContent) === norm(moment.text)) first.remove();

  const html = clean(section);
  return html && norm(section.textContent) ? html : null;
}

export function Why({
  review,
  moment,
  index,
}: {
  review: string | undefined;
  moment: ReflectionMoment;
  index: number;
}) {
  const html = useMemo(
    () => markedWhy(review, moment, index),
    [review, moment, index]
  );

  if (html) {
    return (
      <div
        className="report-marked space-y-2"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return <p>{moment.why}</p>;
}
