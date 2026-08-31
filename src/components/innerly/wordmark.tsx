import { LOGO_ASPECT, LOGO_SRC } from "@/lib/logo";
import { cn } from "@/lib/utils";

/**
 * The Innerly wordmark, in the lettering it was drawn in.
 *
 * Painted as a shape rather than pasted as a picture: the artwork is black,
 * and black on the night-mode background is nothing at all. The letterforms
 * are exactly as drawn and never touched — only the ink follows the page, the
 * same way a printed logo takes the colour of whatever it is printed with.
 *
 * Sized by height alone, so the width follows from the artwork's own aspect
 * and the letters can never be squashed by a stray width class.
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
    <span
      role="img"
      aria-label="Innerly"
      style={{
        width,
        height,
        backgroundColor: "currentColor",
        WebkitMaskImage: `url("${LOGO_SRC}")`,
        maskImage: `url("${LOGO_SRC}")`,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
      className={cn("block shrink-0 select-none", className)}
    />
  );
}
