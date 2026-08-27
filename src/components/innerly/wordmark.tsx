import { cn } from "@/lib/utils";

/**
 * The Innerly logotype.
 *
 * This is the wordmark set in a high-contrast editorial serif, which carries
 * the character of the real logotype (lowercase, calligraphic, green) without
 * pretending to be a pixel match. To use the actual artwork instead, drop it
 * at `public/innerly-logo.svg` and swap the span below for:
 *
 *   <img src="/innerly-logo.svg" alt="Innerly" className={cn("h-5 w-auto", className)} />
 *
 * Nothing else needs to change — every caller sizes this by height.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      aria-label="Innerly"
      role="img"
      className={cn(
        "select-none font-[family-name:var(--font-display)] leading-none tracking-[-0.01em] text-[var(--brand-green)]",
        className
      )}
    >
      innerly
    </span>
  );
}
