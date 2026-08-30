"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { KEYS, usePersistentState } from "@/lib/storage";
import { useApp, type View } from "@/state/app-context";
import { NotificationCard } from "./card";
import { useNotifications } from "./store";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Long enough to read two sentences without hurrying. */
const LINGER = 9000;

/** More than this on screen is a wall, not a message. */
const AT_ONCE = 2;

/**
 * Shows a notification without waiting to be asked.
 *
 * Somebody who never opens the bell should still get told, so anything unseen
 * arrives by itself. Appearing counts as being seen — otherwise it comes back
 * on the next visit, and the badge sits there claiming to be unread something
 * they have already read.
 *
 * It only slides away; it never disappears from the bell. Missing one because
 * you looked away is not the same as dismissing it.
 */
export function Toaster() {
  const { navigate, profile } = useApp();
  const { items: all, unseen, see, remove } = useNotifications();
  // Nothing pops up over the first-run tour. A message shown while the screen
  // is dimmed and somebody is being walked around has reached nobody, and it
  // would be marked as read on the way past.
  const [tourDone] = usePersistentState<boolean>(KEYS.tourSeen, false);
  const [showing, setShowing] = useState<string[]>([]);
  const shown = useRef(new Set<string>());

  useEffect(() => {
    if (!tourDone) return;
    const fresh = unseen
      .filter((n) => !shown.current.has(n.id))
      .slice(0, AT_ONCE)
      .map((n) => n.id);
    if (fresh.length === 0) return;

    for (const id of fresh) shown.current.add(id);
    setShowing((prev) => [...prev, ...fresh].slice(-AT_ONCE));
    see(fresh);

    const timer = setTimeout(
      () => setShowing((prev) => prev.filter((id) => !fresh.includes(id))),
      LINGER
    );
    return () => clearTimeout(timer);
  }, [unseen, see, tourDone]);

  if (typeof document === "undefined") return null;

  // Looked up in the whole list, not the unseen ones. Showing a notification
  // is what marks it seen, so by the time this runs it has already left
  // `unseen` — resolving against that would blank the toast on the same tick
  // it appeared, and nobody would ever see one.
  const items = showing
    .map((id) => all.find((n) => n.id === id) ?? null)
    .filter((n): n is NonNullable<typeof n> => n !== null);

  // Rendered even when empty is pointless; bail before the portal.
  if (items.length === 0) return null;

  return createPortal(
    <div
      // Above the app, below the tour. Bottom-right on a desktop, across the
      // top on a phone where the bottom is where thumbs and browser bars live.
      className="pointer-events-none fixed inset-x-3 top-3 z-[60] flex flex-col gap-2 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-auto sm:w-[340px]"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {items.map((n) => (
          <motion.div
            key={n.id}
            layout
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.26, ease: EASE }}
            className="pointer-events-auto"
          >
            <NotificationCard
              title={n.title}
              body={n.body}
              kind={n.kind}
              name={profile?.firstName}
              className="shadow-xl"
              onClick={
                n.link_view
                  ? () => {
                      navigate(n.link_view as View);
                      setShowing((prev) => prev.filter((id) => id !== n.id));
                    }
                  : undefined
              }
              onDismiss={() => {
                // The X on a toast means "take this away for good", the same
                // as it does on the bell.
                remove(n.id);
                setShowing((prev) => prev.filter((id) => id !== n.id));
              }}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
}
