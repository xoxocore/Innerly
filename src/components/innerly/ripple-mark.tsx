import { cn } from "@/lib/utils";

/** The Innerly "listening" mark: concentric arcs radiating from a dot, set in a soft circle. */
export function RippleMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-[#f8dde4] dark:bg-[#3a2a30]",
        className
      )}
    >
      <svg
        width="40%"
        height="40%"
        viewBox="0 0 120 120"
        fill="none"
        stroke="currentColor"
        className="text-foreground"
        strokeWidth={6}
        strokeLinecap="round"
      >
        <circle cx="40" cy="60" r="6" fill="currentColor" stroke="none" />
        <path d="M58 38a30 30 0 0 1 0 44" />
        <path d="M74 26a52 52 0 0 1 0 68" />
        <path d="M90 16a72 72 0 0 1 0 88" />
      </svg>
    </div>
  );
}
