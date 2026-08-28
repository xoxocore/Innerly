"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import {
  X,
  Pencil,
  Trash,
  Share2,
  ChevronLeft,
  ChevronRight,
  Check,
  Download,
} from "lucide-react";
import { gradient } from "@/lib/content";
import { cn } from "@/lib/utils";
import { ACCENTS, type VisionItem } from "@/lib/types";
import { shareVision, type ShareOutcome } from "./share-card";

function RoundBtn({
  onClick,
  label,
  danger,
  children,
}: {
  onClick: () => void;
  label: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-full bg-background/85 text-foreground backdrop-blur transition-colors hover:bg-background",
        danger && "hover:text-destructive"
      )}
    >
      {children}
    </button>
  );
}

export function VisionLightbox({
  items,
  index,
  onIndexChange,
  onClose,
  onEdit,
  onDelete,
}: {
  items: VisionItem[];
  index: number;
  onIndexChange: (next: number) => void;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);
  const [sharing, setSharing] = useState(false);
  const item = items[index];

  const go = (delta: number) => {
    const next = index + delta;
    if (next >= 0 && next < items.length) onIndexChange(next);
  };

  // Arrows page the deck, Escape closes — the same keys the gestures mirror.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  });

  const onDragEnd = (_: unknown, info: PanInfo) => {
    // Either a decisive flick or a long drag counts as a page turn.
    if (info.offset.x < -80 || info.velocity.x < -500) go(1);
    else if (info.offset.x > 80 || info.velocity.x > 500) go(-1);
  };

  const share = async () => {
    setSharing(true);
    setOutcome(await shareVision(item));
    setSharing(false);
    setTimeout(() => setOutcome(null), 2600);
  };

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* paging arrows sit outside the card on a pointer device */}
      {index > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            go(-1);
          }}
          aria-label="Previous vision"
          className="absolute left-4 z-10 hidden h-10 w-10 place-items-center rounded-full bg-background/85 text-foreground backdrop-blur transition-colors hover:bg-background sm:grid"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {index < items.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            go(1);
          }}
          aria-label="Next vision"
          className="absolute right-4 z-10 hidden h-10 w-10 place-items-center rounded-full bg-background/85 text-foreground backdrop-blur transition-colors hover:bg-background sm:grid"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.16}
        onDragEnd={onDragEnd}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[380px] cursor-grab overflow-hidden rounded-3xl border border-border bg-card active:cursor-grabbing"
      >
        <div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1.5">
          <RoundBtn onClick={share} label="Share">
            {outcome === "shared" ? (
              <Check className="h-3.5 w-3.5 text-[var(--brand-green)]" />
            ) : outcome === "downloaded" ? (
              <Download className="h-3.5 w-3.5 text-[var(--brand-green)]" />
            ) : (
              <Share2 className={cn("h-3.5 w-3.5", sharing && "animate-pulse")} />
            )}
          </RoundBtn>
          <RoundBtn onClick={onEdit} label="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </RoundBtn>
          <RoundBtn onClick={onDelete} label="Delete" danger>
            <Trash className="h-3.5 w-3.5" />
          </RoundBtn>
          <RoundBtn onClick={onClose} label="Close">
            <X className="h-3.5 w-3.5" />
          </RoundBtn>
        </div>

        {/* The card keeps one shape whatever is inside it, so paging through
            the deck never makes the panel jump. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.imageUrl}
                alt={item.title}
                draggable={false}
                className="aspect-square w-full bg-secondary object-cover"
              />
            ) : (
              <div
                className="aspect-square w-full"
                style={{ backgroundImage: gradient(item.gradient ?? ACCENTS[0]) }}
              />
            )}

            <div className="max-h-[30vh] overflow-y-auto px-4 py-3.5">
              <h2 className="text-[15px] font-semibold leading-snug text-heading">
                {item.title}
              </h2>
              {item.description && (
                <div
                  className="rich-content mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: item.description }}
                />
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* deck position, the way a carousel marks its place */}
        {items.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 pb-3">
            {items.map((it, i) => (
              <button
                key={it.id}
                onClick={() => onIndexChange(i)}
                aria-label={`Vision ${i + 1}`}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index ? "w-4 bg-foreground" : "w-1.5 bg-foreground/20"
                )}
              />
            ))}
          </div>
        )}
      </motion.div>

      {outcome === "downloaded" && (
        <p className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-background/90 px-3.5 py-1.5 text-[12px] text-foreground backdrop-blur">
          Saved as an image — send it however you like.
        </p>
      )}
    </div>
  );
}
