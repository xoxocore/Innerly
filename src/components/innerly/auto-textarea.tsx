"use client";

import { useEffect, useRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// A textarea that grows with its content (for longform points), never shrinks
// below its min-height, and never shows a scrollbar.
export function AutoTextarea({
  value,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(resize, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onInput={resize}
      rows={1}
      className={cn("resize-none overflow-hidden", className)}
      {...props}
    />
  );
}
