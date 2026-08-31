"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, ZoomIn } from "lucide-react";

/**
 * Choosing which part of a picture is the picture.
 *
 * Without this a cover is uploaded whole and then cropped by CSS to whatever
 * the layout needs, which takes the middle — and the middle of a photograph is
 * very often not the subject of it. Somebody's head ends up outside the frame
 * and there is nothing they can do about it.
 *
 * Drag to move, the slider to zoom. What is inside the frame is exactly what is
 * saved: the same numbers drive the preview and the canvas that writes the file,
 * so there is no second interpretation to drift.
 */

/** Wide enough for a cover to stay sharp on a large screen, small enough to send. */
const OUT_WIDTH = 1600;

export function ImageCropper({
  file,
  aspect,
  title = "Position the picture",
  onCancel,
  onDone,
}: {
  file: File;
  /** Width ÷ height of the frame the picture has to fill. */
  aspect: number;
  title?: string;
  onCancel: () => void;
  onDone: (cropped: Blob) => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [width, setWidth] = useState(0);
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // Held together with the file it came from, so a second picture chosen while
  // the first is still decoding can never be shown against the wrong bitmap.
  const [loaded, setLoaded] =
    useState<{ file: File; img: HTMLImageElement; url: string } | null>(null);
  const ready = loaded?.file === file ? loaded : null;
  const img = ready?.img ?? null;
  const src = ready?.url ?? null;

  // The object URL is revoked when the picture changes or this closes, so a
  // cropper opened repeatedly does not leak a copy of every image each time.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => setLoaded({ file, img: image, url });
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Measured from the node itself rather than set on mount, so the first paint
  // already has a width and nothing has to re-render to find one.
  const measure = useCallback((el: HTMLDivElement | null) => {
    frame.current = el;
    if (el) setWidth(el.clientWidth);
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (frame.current) setWidth(frame.current.clientWidth);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const box = { w: width, h: width ? Math.round(width / aspect) : 0 };

  /** The smallest scale that still covers the frame — the starting point. */
  const base =
    img && box.w
      ? Math.max(box.w / img.naturalWidth, box.h / img.naturalHeight)
      : 1;
  const scale = base * zoom;
  const drawn = img
    ? { w: img.naturalWidth * scale, h: img.naturalHeight * scale }
    : { w: 0, h: 0 };

  /** Never let the frame show past the edge of the picture. */
  const clamp = useCallback(
    (x: number, y: number) => ({
      x: Math.min(0, Math.max(box.w - drawn.w, x)),
      y: Math.min(0, Math.max(box.h - drawn.h, y)),
    }),
    [box.w, box.h, drawn.w, drawn.h]
  );

  // Centred to begin with, and re-centred whenever the zoom changes so the
  // middle of the frame stays put instead of the picture jumping.
  const centred = {
    x: (box.w - drawn.w) / 2,
    y: (box.h - drawn.h) / 2,
  };
  const at = clamp(offset.x || centred.x, offset.y || centred.y);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: at.x, oy: at.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setOffset(clamp(d.ox + (e.clientX - d.x), d.oy + (e.clientY - d.y)));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const cut = async () => {
    if (!img) return;
    setBusy(true);
    try {
      const outW = OUT_WIDTH;
      const outH = Math.round(OUT_WIDTH / aspect);
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not prepare that image.");

      // The frame, expressed in the original picture's own pixels. Reading it
      // back out this way is what keeps the result identical to the preview.
      const sx = -at.x / scale;
      const sy = -at.y / scale;
      const sw = box.w / scale;
      const sh = box.h / scale;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

      const blob = await new Promise<Blob | null>((done) =>
        canvas.toBlob(done, "image/jpeg", 0.9)
      );
      if (!blob) throw new Error("Could not prepare that image.");
      onDone(blob);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-lg rounded-3xl border border-border bg-card p-5 shadow-xl"
      >
        <h2 className="text-[15px] leading-snug text-heading">{title}</h2>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
          Drag to move it, and zoom until it sits the way you want. What you see
          here is exactly what gets saved.
        </p>

        <div
          ref={measure}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ height: box.h || undefined }}
          className="relative mt-4 touch-none select-none overflow-hidden rounded-2xl border border-border bg-secondary"
        >
          {src && img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                left: at.x,
                top: at.y,
                width: drawn.w,
                height: drawn.h,
                maxWidth: "none",
                cursor: "grab",
              }}
            />
          ) : (
            <div className="grid h-40 place-items-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="range"
            aria-label="Zoom"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => {
              setZoom(Number(e.target.value));
              // Re-centre on change, so zooming never strands the picture in a
              // corner it has to be dragged back from.
              setOffset({ x: 0, y: 0 });
            }}
            className="h-1 w-full cursor-pointer accent-[var(--brand-green-strong)]"
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-full border border-border/60 px-3.5 py-2 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={cut}
            disabled={!img || busy}
            style={{ backgroundColor: "var(--brand-green-strong)" }}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Use this
          </button>
        </div>
      </div>
    </div>
  );
}
