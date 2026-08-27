/* eslint-disable @next/next/no-img-element */
import { LOGO_ASPECT, LOGO_SRC } from "@/lib/logo";
import { cn } from "@/lib/utils";

/**
 * The Innerly logotype — the real artwork, trimmed and given transparency by
 * tools/prepare-logo.mjs from brand/innerly-logo-source.png.
 *
 * Sized by height alone; the width follows from the trimmed aspect ratio, so
 * callers never have to know the proportions. It carries its own colour, so
 * nothing here tints it.
 *
 * Not next/image: the source is a data URI (which keeps it working in the
 * single-file build), and the optimiser has nothing to do with 13KB that is
 * already exactly the size it renders at.
 */
export function Wordmark({
  height = 22,
  className,
}: {
  height?: number;
  className?: string;
}) {
  return (
    <img
      src={LOGO_SRC}
      alt="Innerly"
      width={Math.round(height * LOGO_ASPECT)}
      height={height}
      style={{ height, width: Math.round(height * LOGO_ASPECT) }}
      className={cn("block select-none object-contain", className)}
      draggable={false}
    />
  );
}
