"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, ImagePlus, Trash } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScreenHeader } from "@/components/innerly/screen-header";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { gradient } from "@/lib/content";
import { ACCENTS, type VisionItem, type VisionYear } from "@/lib/types";
import { useVisionBoard, uid } from "@/state/use-data";
import { VisionComposer, type VisionDraft } from "./vision-composer";
import { VisionLightbox } from "./vision-lightbox";
import { stripHtml } from "./image";

const c = copy.visionBoard;

export function VisionBoard() {
  const [years, setYears] = useVisionBoard();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addingYear, setAddingYear] = useState(false);
  const [yearInput, setYearInput] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<VisionItem | null>(null);
  const [lightboxAt, setLightboxAt] = useState<number | null>(null);

  const active = years.find((y) => y.id === selectedId) ?? years[0] ?? null;

  const patchYear = (id: string, patch: Partial<VisionYear>) =>
    setYears((prev) => prev.map((y) => (y.id === id ? { ...y, ...patch } : y)));

  const addYear = () => {
    const label = yearInput.trim() || String(new Date().getFullYear() + years.length);
    const y: VisionYear = { id: uid(), year: label, items: [] };
    setYears((prev) => [...prev, y]);
    setSelectedId(y.id);
    setYearInput("");
    setAddingYear(false);
  };

  const deleteYear = (id: string) => {
    setYears((prev) => prev.filter((y) => y.id !== id));
    setSelectedId(null);
  };

  const saveDraft = (draft: VisionDraft) => {
    if (!active) return;
    if (editing) {
      patchYear(active.id, {
        items: active.items.map((it) =>
          it.id === editing.id
            ? { ...it, title: draft.title, description: draft.description, imageUrl: draft.imageUrl }
            : it
        ),
      });
    } else {
      const accent = ACCENTS[active.items.length % ACCENTS.length];
      const item: VisionItem = {
        id: uid(),
        title: draft.title,
        description: draft.description,
        imageUrl: draft.imageUrl || undefined,
        gradient: [...accent] as [string, string],
        createdAt: new Date().toISOString(),
      };
      patchYear(active.id, { items: [...active.items, item] });
    }
    setComposerOpen(false);
    setEditing(null);
  };

  const removeItem = (itemId: string) => {
    if (!active) return;
    const rest = active.items.filter((i) => i.id !== itemId);
    patchYear(active.id, { items: rest });
    // Stay in the deck if anything is left, landing on the neighbour.
    setLightboxAt((at) =>
      rest.length === 0 || at === null ? null : Math.min(at, rest.length - 1)
    );
  };

  const visions = active?.items.length ?? 0;

  return (
    <div>
      <ScreenHeader breadcrumb={c.breadcrumb} title={c.title} subtitle={c.subtitle} />

      {/* Year chips */}
      <div className="mb-7 flex flex-wrap items-center gap-2">
        {years.map((y) => (
          <button
            key={y.id}
            onClick={() => setSelectedId(y.id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              active?.id === y.id
                ? "text-white"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
            style={
              active?.id === y.id
                ? { backgroundColor: "var(--brand-green)" }
                : undefined
            }
          >
            {y.year}
            {y.items.length > 0 && (
              <span
                className={cn(
                  "grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px]",
                  active?.id === y.id
                    ? "bg-white/25 text-white"
                    : "bg-background text-muted-foreground"
                )}
              >
                {y.items.length}
              </span>
            )}
          </button>
        ))}

        {addingYear ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addYear();
            }}
            className="flex items-center gap-2 rounded-full border border-border/70 bg-card py-0.5 pl-3.5 pr-1"
          >
            <input
              autoFocus
              value={yearInput}
              onChange={(e) => setYearInput(e.target.value)}
              onBlur={() => !yearInput && setAddingYear(false)}
              placeholder="e.g. 2028"
              className="w-16 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              style={{ backgroundColor: "var(--brand-green)" }}
              className="rounded-full px-3 py-1 text-[13px] font-medium text-white"
            >
              Add
            </button>
          </form>
        ) : (
          <button
            onClick={() => setAddingYear(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-[13px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Year
          </button>
        )}
      </div>

      {!active ? (
        <Card className="p-8 text-center">
          <p className="text-[13.5px] leading-relaxed text-muted-foreground">
            Add a year to start gathering what you&apos;re building toward.
          </p>
        </Card>
      ) : (
        <>
          {/* Active year header */}
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <input
                value={active.year}
                onChange={(e) => patchYear(active.id, { year: e.target.value })}
                aria-label="Edit year"
                className="w-36 bg-transparent text-[1.5rem] font-normal leading-tight tracking-tight text-heading outline-none"
              />
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {visions} {visions === 1 ? "Vision" : "Visions"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {!composerOpen && (
                <button
                  onClick={() => {
                    setEditing(null);
                    setComposerOpen(true);
                  }}
                  style={{ backgroundColor: "var(--brand-green)" }}
                  className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
                >
                  <ImagePlus className="h-3.5 w-3.5" /> Add to board
                </button>
              )}
              <button
                onClick={() => deleteYear(active.id)}
                aria-label="Delete year"
                className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
              >
                <Trash className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Composer */}
          <AnimatePresence>
            {composerOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                className="mb-6 overflow-hidden"
              >
                <VisionComposer
                  initial={
                    editing
                      ? {
                          title: editing.title,
                          description: editing.description ?? "",
                          imageUrl: editing.imageUrl,
                        }
                      : undefined
                  }
                  onSave={saveDraft}
                  onCancel={() => {
                    setComposerOpen(false);
                    setEditing(null);
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Grid */}
          {visions === 0 && !composerOpen ? (
            <Card className="p-8 text-center">
              <p className="text-[13.5px] leading-relaxed text-muted-foreground">
                Nothing here yet. Add the first thing you&apos;re calling in.
              </p>
            </Card>
          ) : (
            <motion.div layout className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <AnimatePresence initial={false}>
                {active.items.map((item) => (
                  <motion.button
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    whileHover={{ y: -3 }}
                    onClick={() => setLightboxAt(active.items.indexOf(item))}
                    className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-left"
                  >
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="aspect-square w-full shrink-0 bg-secondary object-cover"
                      />
                    ) : (
                      <div
                        className="aspect-square w-full shrink-0"
                        style={{ backgroundImage: gradient(item.gradient ?? ACCENTS[0]) }}
                      />
                    )}
                    {/* The caption grows to fill, so tiles in a row end level
                        without a fixed height that would clip a wrapped title. */}
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
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </>
      )}

      {/* Lightbox — the whole year as one swipeable deck */}
      {active && lightboxAt !== null && active.items[lightboxAt] && (
        <VisionLightbox
          items={active.items}
          index={lightboxAt}
          onIndexChange={setLightboxAt}
          onClose={() => setLightboxAt(null)}
          onEdit={() => {
            setEditing(active.items[lightboxAt]);
            setComposerOpen(true);
            setLightboxAt(null);
          }}
          onDelete={() => removeItem(active.items[lightboxAt].id)}
        />
      )}
    </div>
  );
}
