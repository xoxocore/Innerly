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
  const [lightbox, setLightbox] = useState<VisionItem | null>(null);

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
    patchYear(active.id, { items: active.items.filter((i) => i.id !== itemId) });
    setLightbox(null);
  };

  const visions = active?.items.length ?? 0;

  return (
    <div>
      <ScreenHeader breadcrumb={c.breadcrumb} title={c.title} subtitle={c.subtitle} />

      {/* Year chips */}
      <div className="mb-8 flex flex-wrap items-center gap-2">
        {years.map((y) => (
          <button
            key={y.id}
            onClick={() => setSelectedId(y.id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              active?.id === y.id
                ? "bg-foreground text-background"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            {y.year}
            {y.items.length > 0 && (
              <span
                className={cn(
                  "grid h-5 min-w-5 place-items-center rounded-full px-1 text-xs",
                  active?.id === y.id
                    ? "bg-background/20 text-background"
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
            className="flex items-center gap-2 rounded-full border border-input bg-card pl-4 pr-1.5 py-1"
          >
            <input
              autoFocus
              value={yearInput}
              onChange={(e) => setYearInput(e.target.value)}
              onBlur={() => !yearInput && setAddingYear(false)}
              placeholder="e.g. 2028"
              className="w-20 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              className="rounded-full bg-foreground px-3 py-1.5 text-sm font-medium text-background"
            >
              Add
            </button>
          </form>
        ) : (
          <button
            onClick={() => setAddingYear(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus className="h-4 w-4" /> Year
          </button>
        )}
      </div>

      {!active ? (
        <Card className="p-10 text-center">
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Add a year to start gathering what you&apos;re building toward.
          </p>
        </Card>
      ) : (
        <>
          {/* Active year header */}
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <input
                value={active.year}
                onChange={(e) => patchYear(active.id, { year: e.target.value })}
                aria-label="Edit year"
                className="w-40 bg-transparent text-[2rem] font-bold leading-tight tracking-tight text-heading outline-none"
              />
              <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
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
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <ImagePlus className="h-4 w-4" /> Add to board
                </button>
              )}
              <button
                onClick={() => deleteYear(active.id)}
                aria-label="Delete year"
                className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
              >
                <Trash className="h-4 w-4" />
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
            <Card className="p-10 text-center">
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                Nothing here yet. Add the first thing you&apos;re calling in.
              </p>
            </Card>
          ) : (
            <motion.div layout className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence initial={false}>
                {active.items.map((item) => (
                  <motion.button
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    whileHover={{ y: -3 }}
                    onClick={() => setLightbox(item)}
                    className="overflow-hidden rounded-3xl border border-border bg-card text-left"
                  >
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="aspect-[4/3] w-full bg-secondary object-cover"
                      />
                    ) : (
                      <div
                        className="aspect-[4/3] w-full"
                        style={{ backgroundImage: gradient(item.gradient ?? ACCENTS[0]) }}
                      />
                    )}
                    <div className="p-5">
                      <h3 className="text-[17px] font-semibold leading-snug text-heading">
                        {item.title}
                      </h3>
                      {item.description && (
                        <p className="mt-1.5 line-clamp-2 text-[15px] leading-relaxed text-muted-foreground">
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

      {/* Lightbox */}
      {lightbox && (
        <VisionLightbox
          item={lightbox}
          onClose={() => setLightbox(null)}
          onEdit={() => {
            setEditing(lightbox);
            setComposerOpen(true);
            setLightbox(null);
          }}
          onDelete={() => removeItem(lightbox.id)}
        />
      )}
    </div>
  );
}
