/* eslint-disable @next/next/no-img-element */
import { MARK_SRC } from "@/lib/logo";
import { cn } from "@/lib/utils";

/**
 * The Innerly mark — the jellyfish, trimmed to its disc and given transparent
 * corners by tools/prepare-logo.mjs. Square, so it works everywhere a wordmark
 * cannot: favicons, app icons, avatars, tight headers.
 *
 * `label` is off by default because the mark is usually decoration sitting
 * beside text. Where it stands alone as the only thing naming the product —
 * the sign-in screen — pass it, or a screen reader announces nothing at all.
 */
export function Mark({
  size = 26,
  label,
  className,
}: {
  size?: number;
  label?: string;
  className?: string;
}) {
  return (
    <img
      src={MARK_SRC}
      alt={label ?? ""}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={cn("block shrink-0 select-none", className)}
      draggable={false}
    />
  );
}
