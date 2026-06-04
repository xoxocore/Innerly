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
    <div className="space-y-3">
      {rows.map((value, i) => (
        <div key={i} className="flex items-start gap-3">
          {numbered && (
            <span className="mt-3.5 w-5 shrink-0 text-sm tabular-nums text-muted-foreground">
              {String(i + 1).padStart(2, "0")}
            </span>
          )}
          <AutoTextarea
            value={value}
            onChange={(e) => update(i, e.target.value)}
            placeholder={placeholders?.[i % placeholders.length]}
            className="min-h-12 flex-1 rounded-2xl border border-input bg-card px-4 py-3 text-[15px] leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-ring"
          />
          {rows.length > 1 && (
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Remove"
              className="mt-2 grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Plus className="h-4 w-4" />
        {addLabel}
      </button>
    </div>
  );
}
