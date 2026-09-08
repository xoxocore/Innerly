"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, Heart, ImageDown, Link2, Loader2, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VisionItem } from "@/lib/types";
import { shareVision, type ShareOutcome } from "./share-card";
import {
  copyBySelection,
  fetchShares,
  shareUrl,
  shareVisionLink,
  sharingAvailable,
  stopSharing,
} from "./share-link";

/**
 * The two ways to send a vision, and the one thing that comes back.
 *
 * Opening this publishes nothing. A link only exists once it is asked for,
 * because this is the first thing in Innerly that leaves the private circle
 * and pressing a button called Share should not be the same as deciding to.
 *
 * Once there is a link the panel stops being about sending and starts being
 * about what happened: how many people have loved it, and the way to take it
 * back. Taking it back closes the photo too, not only the words.
 */
export function ShareSheet({
  item,
  onClose,
}: {
  item: VisionItem;
  onClose: () => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [hearts, setHearts] = useState(0);
  const [looking, setLooking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState<ShareOutcome | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const canSend = typeof navigator !== "undefined" && typeof navigator.share === "function";

  // Reading only: a card already being shared shows its link and its hearts,
  // and one that is not shows neither.
  useEffect(() => {
    let alive = true;
    fetchShares()
      .then((shares) => {
        if (!alive) return;
        const mine = shares.get(item.id);
        if (mine) {
          setToken(mine.token);
          setHearts(mine.hearts);
        }
      })
      .finally(() => alive && setLooking(false));
    return () => {
      alive = false;
    };
  }, [item.id]);

  // Deliberately does not copy afterwards. Making the link is a round trip to
  // the server, and a browser only allows the clipboard to be written while a
  // press is still fresh — so the copy that used to happen here was silently
  // refused every time, and the link never reached anybody's clipboard.
  // Copying is its own press now, which is a press the browser will honour.
  const makeLink = async () => {
    setBusy(true);
    setFailed(null);
    try {
      const made = await shareVisionLink(item);
      if (made) setToken(made);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  };

  /**
   * Copy, by whichever means this browser allows.
   *
   * The modern clipboard is refused in more places than it looks — an older
   * browser, a page inside a frame, a permission not granted — and a Copy
   * button that quietly does nothing is worse than one that admits it. So
   * there is a fallback, and past the fallback the link is selected and the
   * person is told to copy it themselves.
   */
  const copy = async (url: string) => {
    setFailed(null);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
      return;
    } catch {
      // Fall through to the older way.
    }
    if (linkRef.current && copyBySelection(linkRef.current)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
      return;
    }
    linkRef.current?.select();
    setFailed("Your browser wouldn't let me copy it — the link is selected, so press Ctrl/Cmd + C.");
  };

  /**
   * The share sheet the phone already has.
   *
   * On a phone this is the whole point: it opens WhatsApp, Messages and the
   * rest with the link already in hand, instead of asking somebody to copy
   * something and go and find the app themselves.
   */
  const sendIt = async () => {
    if (!token || typeof navigator.share !== "function") return;
    try {
      await navigator.share({ title: item.title, url: shareUrl(token) });
    } catch {
      // Dismissing the sheet lands here too, so there is nothing to report.
    }
  };

  const revoke = async () => {
    if (!token) return;
    setBusy(true);
    try {
      await stopSharing(token);
      setToken(null);
      setHearts(0);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  };

  const saveImage = async () => {
    setBusy(true);
    setSaved(await shareVision(item));
    setBusy(false);
    setTimeout(() => setSaved(null), 2600);
  };

  const url = token ? shareUrl(token) : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
      onClick={(e) => e.stopPropagation()}
      className="absolute inset-x-0 bottom-0 z-20 rounded-t-3xl border-t border-border bg-card p-4 shadow-2xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Share this vision
          </p>
          <p className="mt-1 truncate text-[13px] font-medium text-heading">
            {item.title}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {looking ? (
        <div className="grid place-items-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {token ? (
            <div className="mt-3">
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2">
                <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <input
                  ref={linkRef}
                  readOnly
                  value={url}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label="Link to this vision"
                  className="min-w-0 flex-1 bg-transparent text-[12px] text-foreground outline-none"
                />
                <button
                  onClick={() => copy(url)}
                  aria-label="Copy the link"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-[var(--brand-green-ink)]" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>

              {canSend && (
                <button
                  onClick={sendIt}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl px-3.5 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "var(--brand-green-strong)" }}
                >
                  <Send className="h-3.5 w-3.5" /> Send it
                </button>
              )}

              <p className="mt-2.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <Heart
                  className={cn(
                    "h-3.5 w-3.5",
                    hearts > 0 && "fill-current text-[#f2709c]"
                  )}
                />
                {hearts === 0
                  ? "No hearts yet."
                  : hearts === 1
                    ? "One person has loved this."
                    : `${hearts} people have loved this.`}
              </p>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
                Anyone with this link can see the picture and what you wrote,
                and leave a heart. They cannot see anything else of yours.
              </p>
            </div>
          ) : (
            <div className="mt-3">
              <button
                onClick={makeLink}
                disabled={busy || !sharingAvailable()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl px-3.5 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "var(--brand-green-strong)" }}
              >
                <Link2 className="h-3.5 w-3.5" />
                {busy ? "Making a link…" : "Create a link"}
              </button>
              <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
                {sharingAvailable()
                  ? "Anyone you send it to can see this one card and leave a heart. Nothing else of yours is shared, and you can stop it at any time."
                  : "Links need Innerly to be connected to its database."}
              </p>
            </div>
          )}

          {failed && (
            <p className="mt-2 text-[12px] text-muted-foreground">{failed}</p>
          )}

          <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
            <button
              onClick={saveImage}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              {saved ? (
                <Check className="h-3.5 w-3.5 text-[var(--brand-green-ink)]" />
              ) : (
                <ImageDown className="h-3.5 w-3.5" />
              )}
              {saved === "downloaded" ? "Saved" : saved === "shared" ? "Sent" : "Save as picture"}
            </button>

            {token && (
              <button
                onClick={revoke}
                disabled={busy}
                className="rounded-full px-2.5 py-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                Stop sharing
              </button>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}
