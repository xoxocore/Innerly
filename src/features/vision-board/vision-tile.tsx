"use client";

import { useRef, useState } from "react";
import { motion, useDragControls } from "framer-motion";
import { gradient } from "@/lib/content";
import { stripHtml } from "./image";
import type { VisionItem } from "@/lib/types";

/**
 * One card on the board, which can be picked up and put somewhere else.
 *
 * A vision board is arranged, not sorted: which thing sits in the top-left
 * corner is a decision, and the only honest way to make it is to drag the card
 * there. So the order is whatever the person put it in, and dragging writes it
 * down.
 *
 * Dragging is started by hand rather than by framer's own listener, because
 * the two pointers want different things. A mouse should pick a card up the
 * moment it is pressed and moved. A finger should not — the same gesture is
 * how you scroll the page, and a board that hijacked it would be unusable. On
 * touch the card has to be held for a moment first, which is the gesture
 * people already know from rearranging apps on a phone.
 */

/** Long enough not to fight a scroll, short enough not to feel broken. */
const HOLD_MS = 260;

export function VisionTile({
  item,
  onOpen,
  onGrab,
  onMove,
  onDrop,
  register,
}: {
  item: VisionItem;
  onOpen: () => void;
  onGrab: () => void;
  /** Where the pointer is, in viewport coordinates. */
  onMove: (id: string, x: number, y: number) => void;
  onDrop: () => void;
  register: (id: string, el: HTMLElement | null) => void;
}) {
  const controls = useDragControls();
  const [held, setHeld] = useState(false);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set when a drag begins and cleared on the next press, so the click that
  // follows a drag does not also open the card.
  const dragged = useRef(false);

  const cancelHold = () => {
    if (hold.current) clearTimeout(hold.current);
    hold.current = null;
  };

  const press = (e: React.PointerEvent) => {
    dragged.current = false;
    if (e.pointerType === "mouse") {
      setHeld(true);
      controls.start(e);
      return;
    }
    const native = e.nativeEvent;
    hold.current = setTimeout(() => {
      setHeld(true);
      controls.start(native);
    }, HOLD_MS);
  };

  return (
    <motion.button
      ref={(el) => register(item.id, el)}
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileHover={{ y: -3 }}
      whileDrag={{ scale: 1.05, zIndex: 40 }}
      drag
      dragListener={false}
      dragControls={controls}
      dragSnapToOrigin
      dragElastic={0.1}
      dragMomentum={false}
      onPointerDown={press}
      onPointerUp={cancelHold}
      onPointerCancel={cancelHold}
      onDragStart={() => {
        dragged.current = true;
        onGrab();
      }}
      onDrag={(e) => {
        const p = e as PointerEvent;
        onMove(item.id, p.clientX, p.clientY);
      }}
      onDragEnd={() => {
        setHeld(false);
        onDrop();
      }}
      onClick={() => {
        if (dragged.current) return;
        onOpen();
      }}
      // Only while a card is actually held: taking touch away from the page at
      // rest would stop the board scrolling at all.
      style={{ touchAction: held ? "none" : undefined }}
      className="flex h-full cursor-grab flex-col overflow-hidden rounded-2xl border border-border bg-card text-left active:cursor-grabbing"
    >
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt={item.title}
          draggable={false}
          className="aspect-square w-full shrink-0 bg-secondary object-cover"
        />
      ) : (
        <div
          className="aspect-square w-full shrink-0"
          style={{ backgroundImage: gradient(item.gradient ?? ["#e8f7ef", "#d6ece0"]) }}
        />
      )}
      {/* The caption grows to fill, so tiles in a row end level without a
          fixed height that would clip a wrapped title. */}
      <div className="flex-1 p-3">
        <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug text-heading">
          {item.title}
        </h3>
        {item.description && (
          <p className="mt-0.5 line-clamp-1 text-[11.5px] leading-relaxed text-muted-foreground">
            {stripHtml(item.description)}
          </p>
        )}
      </div>
    </motion.button>
  );
}
