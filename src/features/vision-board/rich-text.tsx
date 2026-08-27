"use client";

import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Underline, List, ListOrdered, Smile } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmojiPicker } from "@/components/innerly/emoji-picker";

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
      className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );

  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm">
      <div className="flex items-center gap-0.5 border-b border-border/60 px-1.5 py-1">
        <ToolBtn onClick={() => exec("bold")} label="Bold">
          <Bold className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn onClick={() => exec("italic")} label="Italic">
          <Italic className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn onClick={() => exec("underline")} label="Underline">
          <Underline className="h-3.5 w-3.5" />
        </ToolBtn>
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolBtn onClick={() => exec("insertUnorderedList")} label="Bulleted list">
          <List className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn onClick={() => exec("insertOrderedList")} label="Numbered list">
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolBtn>
        <span className="mx-1 h-4 w-px bg-border" />
        <div className="relative">
          <ToolBtn onClick={() => setShowEmoji((s) => !s)} label="Emoji">
            <Smile className="h-3.5 w-3.5" />
          </ToolBtn>
          {showEmoji && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowEmoji(false)}
              />
              <div className="absolute left-0 top-9 z-20">
                <EmojiPicker onPick={insertEmoji} />
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
          "rich-content min-h-24 w-full px-3.5 py-2.5 text-[13.5px] leading-relaxed text-foreground outline-none"
        )}
      />
    </div>
  );
}
