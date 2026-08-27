import { cn } from "@/lib/utils";

/**
 * The person, as a single letter. A photo would need somewhere to live; an
 * initial needs nothing and never fails to load.
 */
export function Avatar({
  name,
  className,
}: {
  name?: string | null;
  className?: string;
}) {
  const initial = (name ?? "").trim().charAt(0).toUpperCase() || "·";
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-[var(--brand-green)] text-[13px] font-medium leading-none text-white",
        className
      )}
    >
      {initial}
    </span>
  );
}
