"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Loader2, MailX } from "lucide-react";
import { Mark } from "@/components/innerly/mark";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

/**
 * The page an unsubscribe link opens.
 *
 * Deliberately outside the app: whoever clicks it is reading their email, not
 * signed in, and quite possibly on a different device. Asking them to sign in
 * first would make unsubscribing harder than subscribing, which is both rude
 * and, in most places, against the law.
 *
 * The token in the link is the whole of the authority, and it grants exactly
 * one thing: turning marketing email off.
 */
export default function UnsubscribePage() {
  return (
    <Suspense fallback={<Shell><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></Shell>}>
      <Unsubscribe />
    </Suspense>
  );
}

function Unsubscribe() {
  const token = useSearchParams().get("t");
  // "unknown" from the start when there is nothing to try, so the effect never
  // has to set state on the way in.
  const usable = !!token && isSupabaseConfigured;
  const [state, setState] = useState<"working" | "done" | "unknown" | "error">(
    usable ? "working" : "unknown"
  );

  useEffect(() => {
    if (!usable) return;
    let cancelled = false;
    supabase()
      .rpc("unsubscribe", { t: token })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setState("error");
        else setState(data === true ? "done" : "unknown");
      });
    return () => {
      cancelled = true;
    };
  }, [token, usable]);

  if (state === "working") {
    return (
      <Shell>
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
      </Shell>
    );
  }

  if (state === "done") {
    return (
      <Shell>
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[var(--brand-green-strong)]">
          <Check className="h-5 w-5 text-white" />
        </span>
        <h1 className="title-regular mt-4 text-[1.25rem] tracking-tight text-heading">
          Done — no more of those
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
          You won&apos;t get news or tips from us again. Anything to do with your
          account still comes through, like a password reset — you&apos;d be
          locked out otherwise.
        </p>
        <p className="mx-auto mt-4 max-w-xs text-[12.5px] leading-relaxed text-muted-foreground">
          Changed your mind? Turn it back on in Innerly under Settings.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-secondary">
        <MailX className="h-5 w-5 text-muted-foreground" />
      </span>
      <h1 className="title-regular mt-4 text-[1.25rem] tracking-tight text-heading">
        {state === "error" ? "Something went wrong" : "That link didn't work"}
      </h1>
      <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
        {state === "error"
          ? "Try again in a moment. If it keeps happening, reply to any email from us and we'll turn it off by hand."
          : "It may have been used already, or the address may have been copied only part of the way. You can also turn these off in Innerly under Settings."}
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-[360px] text-center">
        <div className="mb-7 flex justify-center">
          <Mark size={44} label="Innerly" />
        </div>
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-7">
          {children}
        </div>
      </div>
    </main>
  );
}
