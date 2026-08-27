"use client";

import { Plus, X } from "lucide-react";
import { AutoTextarea } from "@/components/innerly/auto-textarea";

// Repeating list of free-text inputs with "add another" — used across Manifestation
// and the nightly check-in. Always renders at least one row.
export function MultiAdd({
  values,
  onChange,
  placeholders,
  addLabel,
  numbered = true,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholders?: readonly string[];
  addLabel: string;
  numbered?: boolean;
}) {
  const rows = values.length > 0 ? values : [""];

  const update = (i: number, v: string) => {
    const next = [...rows];
    next[i] = v;
    onChange(next);
  };
  const remove = (i: number) => {
    const next = rows.filter((_, idx) => idx !== i);
    onChange(next.length ? next : [""]);
  };
  const add = () => onChange([...rows, ""]);

  return (
    <div className="space-y-2.5">
      {rows.map((value, i) => (
        <div key={i} className="flex items-start gap-2.5">
          {numbered && (
            <span className="mt-2.5 w-4 shrink-0 text-[11px] tabular-nums text-muted-foreground/80">
              {String(i + 1).padStart(2, "0")}
            </span>
          )}
          <AutoTextarea
            value={value}
            onChange={(e) => update(i, e.target.value)}
            placeholder={placeholders?.[i % placeholders.length]}
            className="min-h-10 flex-1 rounded-2xl border border-border/60 bg-card/70 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-foreground outline-none backdrop-blur-sm transition-colors placeholder:text-muted-foreground/60 focus:border-ring focus:bg-card/90"
          />
          {rows.length > 1 && (
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Remove"
              className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
        {addLabel}
      </button>
    </div>
  );
}
