/* eslint-disable @next/next/no-img-element */
import { LOGO_ASPECT, LOGO_SRC } from "@/lib/logo";
import { cn } from "@/lib/utils";

/**
 * The Innerly wordmark — the name set in the brand's own lettering, trimmed to
 * its ink and cut out onto transparency by tools/prepare-logo.mjs.
 *
 * Sized by height alone: the width follows from the source aspect so the
 * letterforms can never be squashed by a stray width class. `alt` carries the
 * name, which is why the mark beside it is decoration.
 */
export function Wordmark({
  height = 22,
  className,
}: {
  height?: number;
  className?: string;
}) {
  const width = Math.round(height * LOGO_ASPECT);
  return (
    <img
      src={LOGO_SRC}
      alt="Innerly"
      width={width}
      height={height}
      style={{ width, height }}
      className={cn("block shrink-0 select-none object-contain", className)}
      draggable={false}
    />
  );
}
