"use client";

import { useEffect, useState } from "react";
import { signAvatar } from "@/lib/avatar";
import { cn } from "@/lib/utils";

/**
 * The person: their photo where they have added one, their initial where they
 * have not.
 *
 * The initial is not a placeholder to be tolerated — it is the fallback that
 * never fails to load, so it renders first and the photo replaces it once the
 * signed link comes back. Nothing flashes empty in between.
 */
export function Avatar({
  name,
  /** Their stored avatar path, if any. Left out to force the initial. */
  path,
  className,
}: {
  name?: string | null;
  path?: string | null;
  className?: string;
}) {
  const [link, setLink] = useState<{ path: string; url: string } | null>(null);
  const url = path && link?.path === path ? link.url : null;

  useEffect(() => {
    if (!path) return;
    let live = true;
    signAvatar(path).then((u) => {
      if (live && u) setLink({ path, url: u });
    });
    return () => {
      live = false;
    };
  }, [path]);

  const initial = (name ?? "").trim().charAt(0).toUpperCase() || "·";

  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--brand-green-strong)] text-[13px] font-medium leading-none text-white",
        className
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : (
        initial
      )}
    </span>
  );
}
