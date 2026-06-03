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
  imageUrl?: string;
};

export function VisionComposer({
  initial,
  onSave,
  onCancel,
}: {
  initial?: VisionDraft;
  onSave: (draft: VisionDraft) => void;
  onCancel: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [busy, setBusy] = useState(false);

  const pickFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      setImageUrl(await fileToDataUrl(file));
    } finally {
      setBusy(false);
    }
  };

  const canSave = title.trim().length > 0;

  return (
    <Card className="p-5 sm:p-6">
      <div className="grid gap-6 sm:grid-cols-[minmax(0,260px)_1fr]">
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
                <span className="text-sm">Add an image</span>
              </div>
            )}
            {imageUrl && (
              <button
                type="button"
                onClick={() => setImageUrl("")}
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
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
          >
            <Upload className="h-4 w-4" /> {busy ? "Processing…" : "Upload image"}
          </button>

          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-input bg-card px-3">
            <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={imageUrl.startsWith("data:") ? "" : imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="…or paste an image link"
              className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground"
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
            className="w-full rounded-2xl border border-input bg-card px-4 py-3 text-[17px] font-medium outline-none focus:border-ring"
          />

          <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Description <span className="font-normal lowercase tracking-normal">(optional)</span>
          </p>
          <RichText
            defaultValue={description}
            onChange={setDescription}
            placeholder="Why this matters, how it feels… 💫"
          />

          <div className="mt-5 flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              disabled={!canSave}
              onClick={() => onSave({ title: title.trim(), description, imageUrl })}
            >
              {initial ? "Save changes" : "Add to board"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
