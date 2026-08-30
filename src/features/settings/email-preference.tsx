"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { currentUserId } from "@/lib/sync";

/**
 * Turning news and tips off, from inside the app.
 *
 * The link in an email does the same thing, but somebody who has already
 * unsubscribed and changed their mind has no email left to click — so it has
 * to be here too, and it has to work in both directions.
 *
 * Account email is not on this switch and never will be: without a password
 * reset, an account cannot be recovered.
 */
export function EmailPreference() {
  const [on, setOn] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const userId = currentUserId();
    if (!userId) return;
    let cancelled = false;
    supabase()
      .from("email_prefs")
      .select("marketing")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setOn(data?.marketing ?? true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (on === null) return null;

  const toggle = async () => {
    const next = !on;
    setOn(next);
    setSaving(true);
    const userId = currentUserId();
    if (userId) {
      await supabase()
        .from("email_prefs")
        .upsert({ user_id: userId, marketing: next, updated_at: new Date().toISOString() });
    }
    setSaving(false);
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-medium text-heading">Email from us</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Occasional news, tips and things worth reading. Nothing often.
      </p>

      <button
        onClick={toggle}
        role="switch"
        aria-checked={on}
        aria-label="Email from us"
        disabled={saving}
        className="mt-4 flex w-full items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card/70 px-4 py-3 text-left transition-colors hover:bg-accent/40"
      >
        <span className="text-[13.5px] text-foreground">
          {on ? "Yes, send them" : "No thanks"}
        </span>
        <span
          className={
            "relative h-6 w-10 shrink-0 rounded-full transition-colors " +
            (on ? "bg-[var(--brand-green-strong)]" : "bg-border")
          }
        >
          <span
            className={
              "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform " +
              (on ? "translate-x-[1.125rem]" : "translate-x-0.5")
            }
          />
        </span>
      </button>

      <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
        Emails about your account — confirming your address, resetting your
        password — always come through. You&apos;d be locked out otherwise.
      </p>
    </Card>
  );
}
