"use client";

import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { currentUserId } from "@/lib/sync";
import { Section, Toggle } from "./parts";

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
    <Section title="Email from us">
      <div className="mt-2">
        <Toggle
          label="News and tips"
          desc="Occasional things worth reading. Nothing often."
          checked={on}
          onChange={toggle}
          disabled={saving}
        />
      </div>
      <p className="mt-2 border-t border-border/50 pt-3 text-[12px] leading-relaxed text-muted-foreground">
        Emails about your account — confirming your address, resetting your
        password — always come through. You&apos;d be locked out otherwise.
      </p>
    </Section>
  );
}
