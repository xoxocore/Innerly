"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ReflectMark } from "@/components/innerly/reflect-mark";
import { checkIn } from "@/lib/missed";
import { useApp } from "@/state/app-context";
import { useMissedCheckIn } from "@/state/use-data";

/**
 * Jelly, once, about a day that has closed.
 *
 * A card at the top of whatever page you arrived on, not a dialog over it.
 * That difference is the whole design: a dialog has to be dealt with before
 * anything else can happen, and demanding to be dealt with is the wrong tone
 * for a message about a day that did not go to plan. This waits where it can
 * be read, or scrolled past, or answered.
 *
 * Both answers settle the day. "Not now" is a real answer and gets the same
 * finality as "yes" — a prompt that came back tomorrow having been declined
 * today would be nagging, and nagging somebody about what they did not manage
 * is the opposite of what this is for.
 */
export function MissedCheckIn() {
  const { profile, navigate } = useApp();
  const { missed, ask, settle } = useMissedCheckIn();

  if (!ask || !missed) return null;
  const said = checkIn(profile?.firstName, missed);

  return (
    <AnimatePresence>
      <motion.section
        data-check-in
        aria-label="A note from Jelly"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
        transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
        className="mb-6 overflow-hidden rounded-3xl border border-border/50 bg-card px-4 py-4 sm:px-5"
      >
        <div className="flex items-start gap-3.5 sm:gap-4">
          <ReflectMark size={48} className="mt-0.5" />

          <div className="min-w-0 flex-1 sm:max-w-[62ch]">
            <p className="text-[14px] font-medium leading-snug text-heading">
              {said.greeting}
            </p>
            {/* The thing itself, in the person's own words — quoted rather
                than listed, so it reads as something remembered and not as a
                row in a report of what went undone. */}
            <p className="mt-1 break-words text-[13.5px] leading-relaxed text-foreground/85">
              {said.what}
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              {said.offer}
            </p>

            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  settle();
                  navigate("reflect");
                }}
                className="rounded-full bg-[var(--brand-green-strong)] px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
              >
                Let&apos;s look at it
              </button>
              <button
                onClick={settle}
                className="rounded-full px-3.5 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      </motion.section>
    </AnimatePresence>
  );
}
