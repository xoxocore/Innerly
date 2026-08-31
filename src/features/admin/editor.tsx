"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bold, Italic, Heading2, Heading3, Link2, List, ListOrdered,
  Quote, ImagePlus, Loader2, Minus, Undo2, Redo2, MousePointerClick,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadPostImage } from "@/lib/posts";

/**
 * The writing surface.
 *
 * A blog post is a column of text with the occasional picture, so this is a
 * writing tool rather than a page builder: the shape of a post is not something
 * anyone should have to lay out by hand, and a drag-and-drop canvas mostly
 * gives you new ways to make a post look wrong.
 *
 * contentEditable with execCommand — deprecated, and still the only rich-text
 * primitive that works everywhere without pulling in a large editor library
 * for six posts a year.
 */
export function Editor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cta, setCta] = useState<{ label: string; href: string } | null>(null);

  // Set once. Writing back on every keystroke would move the caret to the end
  // of the document mid-sentence.
  useEffect(() => {
    if (ref.current && value) ref.current.innerHTML = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => onChange(ref.current?.innerHTML ?? "");

  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    emit();
  };

  const block = (tag: string) => exec("formatBlock", `<${tag}>`);

  const addLink = () => {
    const url = window.prompt("Link to where?", "https://");
    if (!url || url === "https://") return;
    // A link that leaves the site should not take the reader's tab with it.
    exec("createLink", url);
    ref.current?.querySelectorAll('a[href^="http"]').forEach((a) => {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    });
    emit();
  };

  /**
   * A button, not a link.
   *
   * Marked with data-cta so the email template can rebuild it as a table cell
   * — Outlook paints neither padding nor a background on an inline element, so
   * a styled <a> arrives there as plain underlined text.
   *
   * Pointing it at Innerly's front door is the useful default: somebody signed
   * in lands on their dashboard, somebody who is not lands on sign-up. One
   * link does both, so nobody has to guess which to use.
   */
  const insertCta = () => {
    if (!cta) return;
    const label = cta.label.trim() || "Try Innerly";
    const href = cta.href.trim() || homeUrl();
    ref.current?.focus();
    document.execCommand(
      "insertHTML",
      false,
      `<p><a data-cta="1" href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${escapeText(label)}</a></p><p><br></p>`
    );
    setCta(null);
    emit();
  };

  const addImage = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const url = await uploadPostImage(file);
      ref.current?.focus();
      // A figure rather than a bare img, so a caption has somewhere to live.
      document.execCommand(
        "insertHTML",
        false,
        `<figure><img src="${url}" alt="" /><figcaption>Add a caption, or delete this line</figcaption></figure><p><br></p>`
      );
      emit();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That image would not upload.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <div className="sticky top-[57px] z-10 -mx-1 mb-3 flex flex-wrap items-center gap-0.5 rounded-2xl border border-border bg-card/95 px-1.5 py-1.5 backdrop-blur">
        <Tool onClick={() => block("h2")} label="Heading"><Heading2 className="h-4 w-4" /></Tool>
        <Tool onClick={() => block("h3")} label="Smaller heading"><Heading3 className="h-4 w-4" /></Tool>
        <Rule />
        <Tool onClick={() => exec("bold")} label="Bold"><Bold className="h-4 w-4" /></Tool>
        <Tool onClick={() => exec("italic")} label="Italic"><Italic className="h-4 w-4" /></Tool>
        <Rule />
        <Tool onClick={() => exec("insertUnorderedList")} label="Bullet list"><List className="h-4 w-4" /></Tool>
        <Tool onClick={() => exec("insertOrderedList")} label="Numbered list"><ListOrdered className="h-4 w-4" /></Tool>
        <Tool onClick={() => block("blockquote")} label="Quote"><Quote className="h-4 w-4" /></Tool>
        <Tool onClick={() => exec("insertHorizontalRule")} label="Divider"><Minus className="h-4 w-4" /></Tool>
        <Rule />
        <Tool onClick={addLink} label="Add a link"><Link2 className="h-4 w-4" /></Tool>
        <Tool
          onClick={() => setCta((c) => (c ? null : { label: "Try Innerly", href: homeUrl() }))}
          label="Add a button"
        >
          <MousePointerClick className="h-4 w-4" />
        </Tool>
        <Tool onClick={() => fileRef.current?.click()} label="Add a picture" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        </Tool>
        <Rule />
        <Tool onClick={() => exec("undo")} label="Undo"><Undo2 className="h-4 w-4" /></Tool>
        <Tool onClick={() => exec("redo")} label="Redo"><Redo2 className="h-4 w-4" /></Tool>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => addImage(e.target.files?.[0])}
      />

      {cta && (
        <div className="mb-3 rounded-2xl border border-border bg-card p-3.5">
          <p className="mb-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            The button
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              value={cta.label}
              aria-label="Button text"
              placeholder="Try Innerly"
              onChange={(e) => setCta({ ...cta, label: e.target.value })}
              className="min-w-[9rem] flex-1 rounded-xl border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-[var(--brand-green)]"
            />
            <input
              value={cta.href}
              aria-label="Button link"
              placeholder="https://"
              onChange={(e) => setCta({ ...cta, href: e.target.value })}
              className="min-w-[12rem] flex-[2] rounded-xl border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-[var(--brand-green)]"
            />
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={insertCta}
              style={{ backgroundColor: "var(--brand-green-strong)" }}
              className="rounded-xl px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
            >
              Insert
            </button>
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
            Left as it is, this opens Innerly: whoever is signed in lands on
            their dashboard, and anybody who is not lands on sign-up.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="mb-3 rounded-2xl bg-destructive/10 px-3.5 py-2.5 text-[12.5px] text-destructive">
          {error}
        </p>
      )}

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        // Pasting from a word processor otherwise brings its fonts and colours
        // with it, and the post stops looking like the rest of the site.
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
          emit();
        }}
        data-placeholder="Start writing…"
        className="post-body min-h-[420px] rounded-2xl border border-border bg-card px-5 py-4 text-[15px] leading-relaxed outline-none focus:border-[var(--brand-green)]"
      />
    </div>
  );
}

/** Innerly's front door, which is wherever this is running. */
function homeUrl(): string {
  if (typeof window === "undefined") return "https://innerly-sooty.vercel.app";
  return window.location.origin;
}

function escapeAttr(s: string) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeText(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function Rule() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />;
}

function Tool({
  onClick,
  label,
  disabled,
  children,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      // Mousedown would steal the selection before the command runs on it.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors",
        "hover:bg-accent hover:text-foreground disabled:opacity-40"
      )}
    >
      {children}
    </button>
  );
}
