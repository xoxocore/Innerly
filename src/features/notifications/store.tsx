"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/state/auth-context";
import {
  dismiss as dismissRemote, fetchForMe, markSeen, type Delivered,
} from "@/lib/notifications";

type Store = {
  items: Delivered[];
  unseen: Delivered[];
  /** Marks them seen, wherever they were seen — the bell or a toast. */
  see: (ids: string[]) => void;
  remove: (id: string) => void;
};

const NotificationContext = createContext<Store | null>(null);

/**
 * One copy of the notifications, shared by the bell and the toasts.
 *
 * They have to agree: a message that appears on its own and then still shows
 * as unread on the bell has been delivered twice and read once.
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Delivered[]>([]);
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

  const see = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    void markSeen(ids);
    setItems((prev) =>
      prev.map((n) => (ids.includes(n.id) ? { ...n, seen: true } : n))
    );
  }, []);

  const remove = useCallback((id: string) => {
    void dismissRemote(id);
    setItems((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const value = useMemo<Store>(
    () => ({ items, unseen: items.filter((n) => !n.seen), see, remove }),
    [items, see, remove]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): Store {
  return (
    useContext(NotificationContext) ?? {
      items: [],
      unseen: [],
      see: () => {},
      remove: () => {},
    }
  );
}
