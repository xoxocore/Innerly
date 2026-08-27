"use client";

import { useState } from "react";
import { EMOJI_GROUPS } from "@/lib/emoji";
import { cn } from "@/lib/utils";

// One glyph per tab, standing in for its group the way a phone keyboard does.
const TAB_ICON: Record<string, string> = {
  Smileys: "😀",
  People: "👋",
  Nature: "🌿",
  Food: "🍎",
  Activity: "⚽",
  Travel: "✈️",
  Objects: "💡",
  Symbols: "❤️",
  Flags: "🏳️",
  More: "🔣",
};

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [group, setGroup] = useState(0);
  const active = EMOJI_GROUPS[group];

  return (
    <div className="w-[292px] overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
      <div className="flex items-center gap-0.5 overflow-x-auto border-b border-border/60 px-1.5 py-1">
        {EMOJI_GROUPS.map((g, i) => (
          <button
            key={g.name}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setGroup(i)}
            aria-label={g.name}
            aria-pressed={i === group}
            className={cn(
              "grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[15px] leading-none transition-colors",
              i === group ? "bg-accent" : "opacity-55 hover:opacity-100"
            )}
          >
            {TAB_ICON[g.name] ?? "•"}
          </button>
        ))}
      </div>

      <p className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {active.name}
      </p>

      <div className="grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto px-2 pb-2">
        {active.list.map((e, i) => (
          <button
            key={active.name + i}
            type="button"
            // Keep the caret where it is: losing the selection would drop the
            // emoji at the start of the field instead of where you were typing.
            onMouseDown={(ev) => ev.preventDefault()}
            onClick={() => onPick(e)}
            className="grid h-8 w-8 place-items-center rounded-lg text-[19px] leading-none transition-colors hover:bg-accent"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
