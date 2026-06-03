"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Pencil, Trash } from "lucide-react";
import { gradient } from "@/lib/content";
import { ACCENTS, type VisionItem } from "@/lib/types";

export function VisionLightbox({
  item,
  onClose,
  onEdit,
  onDelete,
}: {
  item: VisionItem;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-[2rem] border border-border bg-card"
        >
          {/* top controls */}
          <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5">
            <button
              onClick={onEdit}
              aria-label="Edit"
              className="grid h-9 w-9 place-items-center rounded-full bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-background"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={onDelete}
              aria-label="Delete"
              className="grid h-9 w-9 place-items-center rounded-full bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-background hover:text-destructive"
            >
              <Trash className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="grid h-9 w-9 place-items-center rounded-full bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-background"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* image */}
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageUrl}
              alt={item.title}
              className="max-h-[55vh] w-full bg-secondary object-cover"
            />
          ) : (
            <div
              className="aspect-[4/3] w-full"
              style={{ backgroundImage: gradient(item.gradient ?? ACCENTS[0]) }}
            />
          )}

          {/* text */}
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="text-xl font-normal leading-snug tracking-tight text-heading">
              {item.title}
            </h2>
            {item.description && (
              <div
                className="rich-content mt-3 text-[15px] leading-relaxed text-foreground/90"
                dangerouslySetInnerHTML={{ __html: item.description }}
              />
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
