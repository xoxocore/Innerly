"use client";

import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Underline, List, ListOrdered, Smile } from "lucide-react";
import { cn } from "@/lib/utils";

const EMOJIS = [
  "😊", "😍", "🥹", "😌", "🤩", "🥳", "😎", "🙏", "💪", "🔥",
  "✨", "🌟", "⭐", "💫", "❤️", "🧡", "💛", "💚", "💙", "💜",
  "🌱", "🌸", "🌿", "🍀", "🌈", "☀️", "🌙", "💭", "🎯", "🚀",
  "💡", "📈", "🏆", "💰", "🎉", "👏", "🙌", "✅", "📝", "☕",
];

export function RichText({
  defaultValue,
  onChange,
  placeholder,
}: {
  defaultValue?: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [showEmoji, setShowEmoji] = useState(false);

  useEffect(() => {
    if (ref.current && defaultValue) ref.current.innerHTML = defaultValue;
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => onChange(ref.current?.innerHTML ?? "");

  const exec = (cmd: string) => {
    ref.current?.focus();
    // execCommand is deprecated but remains the simplest cross-browser rich-text
    // primitive and works in all Chromium browsers (our target).
    document.execCommand(cmd, false);
    emit();
  };

  const insertEmoji = (e: string) => {
    ref.current?.focus();
    document.execCommand("insertText", false, e);
    emit();
    setShowEmoji(false);
  };

  const ToolBtn = ({
    onClick,
    label,
    children,
  }: {
    onClick: () => void;
    label: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()} // keep selection
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );

  return (
    <div className="rounded-2xl border border-input bg-card">
      <div className="flex items-center gap-0.5 border-b border-border px-2 py-1.5">
        <ToolBtn onClick={() => exec("bold")} label="Bold">
          <Bold className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={() => exec("italic")} label="Italic">
          <Italic className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={() => exec("underline")} label="Underline">
          <Underline className="h-4 w-4" />
        </ToolBtn>
        <span className="mx-1 h-5 w-px bg-border" />
        <ToolBtn onClick={() => exec("insertUnorderedList")} label="Bulleted list">
          <List className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={() => exec("insertOrderedList")} label="Numbered list">
          <ListOrdered className="h-4 w-4" />
        </ToolBtn>
        <span className="mx-1 h-5 w-px bg-border" />
        <div className="relative">
          <ToolBtn onClick={() => setShowEmoji((s) => !s)} label="Emoji">
            <Smile className="h-4 w-4" />
          </ToolBtn>
          {showEmoji && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowEmoji(false)}
              />
              <div className="absolute left-0 top-10 z-20 grid w-64 grid-cols-8 gap-1 rounded-2xl border border-border bg-popover p-2 shadow-xl">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => insertEmoji(e)}
                    className="grid h-7 w-7 place-items-center rounded-lg text-lg hover:bg-accent"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        data-placeholder={placeholder}
        className={cn(
          "rich-content min-h-28 w-full px-4 py-3 text-[15px] leading-relaxed text-foreground outline-none"
        )}
      />
    </div>
  );
}
