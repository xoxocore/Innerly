"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp, type View } from "@/state/app-context";
import { useAuth } from "@/state/auth-context";
import {
  dismiss, fetchForMe, markSeen, type Delivered,
} from "@/lib/notifications";
import { NotificationCard } from "./card";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function NotificationBell() {
  const { profile, navigate } = useApp();
  const { user } = useAuth();
  const [items, setItems] = useState<Delivered[]>([]);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  const signedUpAt = user?.created_at;

  const load = useCallback(() => {
    fetchForMe(signedUpAt).then(setItems).catch(() => {});
  }, [signedUpAt]);

  useEffect(() => {
    if (!user) return;
    load();
    // Slow on purpose: a message that waits five minutes is fine, and a panel
    // polling every few seconds is not.
    const timer = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [user, load]);

  // Click outside, or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unseen = items.filter((n) => !n.seen);

  const openPanel = () => {
    setOpen(true);
    if (unseen.length) {
      // Marked as seen on opening, not on arrival — otherwise a badge appears
      // and clears itself without anybody having read anything.
      void markSeen(unseen.map((n) => n.id));
      setItems((prev) => prev.map((n) => ({ ...n, seen: true })));
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={wrap}>
      <button
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-label={
          unseen.length ? `Notifications, ${unseen.length} new` : "Notifications"
        }
        aria-expanded={open}
        className="relative grid h-9 w-9 place-items-center rounded-full border border-border/70 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Bell className="h-[17px] w-[17px]" />
        {unseen.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--brand-green-strong)] px-1 text-[10px] font-medium tabular-nums text-white">
            {unseen.length > 9 ? "9+" : unseen.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: EASE }}
            className="absolute right-0 z-40 mt-2 w-[min(340px,calc(100vw-32px))] origin-top-right rounded-3xl border border-border bg-card p-2.5 shadow-xl"
          >
            <p className="px-2 pb-2 pt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Notifications
            </p>

            {items.length === 0 ? (
              <p className="px-2 pb-4 pt-2 text-[12.5px] leading-relaxed text-muted-foreground">
                Nothing right now. Anything from us will land here.
              </p>
            ) : (
              <div className="flex max-h-[min(60vh,420px)] flex-col gap-2 overflow-y-auto">
                {items.map((n) => (
                  <NotificationCard
                    key={n.id}
                    title={n.title}
                    body={n.body}
                    kind={n.kind}
                    name={profile?.firstName}
                    unseen={!n.seen}
                    className={cn(n.link_view && "hover:bg-accent/40")}
                    onClick={
                      n.link_view
                        ? () => {
                            navigate(n.link_view as View);
                            setOpen(false);
                          }
                        : undefined
                    }
                    onDismiss={() => {
                      void dismiss(n.id);
                      setItems((prev) => prev.filter((x) => x.id !== n.id));
                    }}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
