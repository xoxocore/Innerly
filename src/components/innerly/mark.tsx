/* eslint-disable @next/next/no-img-element */
import { MARK_SRC } from "@/lib/logo";
import { cn } from "@/lib/utils";

/**
 * The Innerly mark — the jellyfish, trimmed to its disc and given transparent
 * corners by tools/prepare-logo.mjs. Square, so it works everywhere the
 * wordmark cannot: favicons, app icons, avatars, tight headers.
 */
export function Mark({
  size = 26,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={MARK_SRC}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={cn("block shrink-0 select-none", className)}
      draggable={false}
    />
  );
}
