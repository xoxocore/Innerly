"use client";

/* eslint-disable @next/next/no-img-element */
import {
  REFLECT_EYELID,
  REFLECT_EYES,
  REFLECT_SHUT,
  REFLECT_SRC,
} from "@/lib/reflect-jelly";
import { cn } from "@/lib/utils";
import { CLOSING, OPENING, useBlink } from "./use-blink";

/**
 * Jelly, holding a heart.
 *
 * She turns up on the one screen in the app that asks about something that did
 * not go well, so she does nothing but be there and blink. Anything more
 * animated would be a mascot performing at somebody having a hard day.
 */
export function ReflectMark({
  size = 48,
  label,
  blink = true,
  className,
}: {
  size?: number;
  label?: string;
  blink?: boolean;
  className?: string;
}) {
  const shut = useBlink(blink);

  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ width: size, height: size }}
      className={cn("relative block shrink-0 select-none", className)}
    >
      <img
        src={REFLECT_SRC}
        data-jelly="heart"
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="block"
        draggable={false}
      />
      {REFLECT_EYES.map((eye, i) => (
        <span
          key={i}
          data-jelly="lid"
          aria-hidden
          style={{
            position: "absolute",
            left: `${eye.left * 100}%`,
            top: `${eye.top * 100}%`,
            width: `${eye.width * 100}%`,
            height: `${eye.height * shut * REFLECT_SHUT * 100}%`,
            background: REFLECT_EYELID,
            transition: `height ${shut ? CLOSING : OPENING}ms ease-in-out`,
            pointerEvents: "none",
          }}
        />
      ))}
    </span>
  );
}
