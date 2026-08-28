"use client";

import { useRef, useState } from "react";
import { ImagePlus, Upload, Link2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fileToDataUrl } from "./image";
import { RichText } from "./rich-text";

export type VisionDraft = {
  title: string;
  description: string;
  /** A data URL from a fresh upload, or a link someone pasted. */
  imageUrl?: string;
  /**
   * Carried through untouched when the photo was not changed. Without it, the
   * board could not tell "kept the same photo" from "pasted a link", and would
   * save the hour-long signed URL it was previewing as if it were the photo.
   */
  imagePath?: string;
};

export function VisionComposer({
  initial,
  onSave,
  onCancel,
}: {
  initial?: VisionDraft;
  onSave: (draft: VisionDraft) => void | Promise<void>;
  onCancel: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  // Only survives if the photo is left alone; every control below clears it.
  const [imagePath, setImagePath] = useState(initial?.imagePath);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const pickFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      setImageUrl(await fileToDataUrl(file));
      setImagePath(undefined);
    } finally {
      setBusy(false);
    }
  };

  const clearImage = () => {
    setImageUrl("");
    setImagePath(undefined);
  };

  const pasteLink = (url: string) => {
    setImageUrl(url);
    setImagePath(undefined);
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave({ title: title.trim(), description, imageUrl, imagePath });
    } finally {
      setSaving(false);
    }
  };

  const canSave = title.trim().length > 0;

  return (
    <Card className="p-4 sm:p-5">
      <div className="grid gap-5 sm:grid-cols-[minmax(0,220px)_1fr]">
        {/* Image */}
        <div>
          <div
            className={cn(
              "relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-dashed border-border bg-secondary",
              imageUrl && "border-solid"
            )}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="Vision"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <ImagePlus className="h-8 w-8" />
                <span className="text-[13px]">Add an image</span>
              </div>
            )}
            {imageUrl && (
              <button
                type="button"
                onClick={clearImage}
                aria-label="Remove image"
                className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-background/80 text-foreground backdrop-blur hover:bg-background"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
          >
            <Upload className="h-3.5 w-3.5" /> {busy ? "Processing…" : "Upload image"}
          </button>

          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-input bg-card px-3">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              value={imageUrl.startsWith("data:") ? "" : imageUrl}
              onChange={(e) => pasteLink(e.target.value)}
              placeholder="…or paste an image link"
              className="w-full bg-transparent py-2 text-[13px] outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Text */}
        <div className="flex flex-col">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Topic — e.g. A calm morning routine"
            autoFocus
            className="w-full rounded-2xl border border-border/60 bg-card/70 px-3.5 py-2.5 text-[14px] font-semibold outline-none backdrop-blur-sm focus:border-ring"
          />

          <p className="mb-1.5 mt-3.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Description <span className="font-normal lowercase tracking-normal">(optional)</span>
          </p>
          <RichText
            defaultValue={description}
            onChange={setDescription}
            placeholder="Why this matters, how it feels… 💫"
          />

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!canSave || saving || busy}
              style={{ backgroundColor: "var(--brand-green-strong)" }}
              className="text-white"
              onClick={save}
            >
              {saving
                ? "Saving…"
                : initial
                  ? "Save changes"
                  : "Add to board"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
