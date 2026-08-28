"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Read once, so a missing variable fails at the first call with a sentence
// that says what to do — rather than surfacing later as an opaque "Invalid API
// key" from the network tab.
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env.local for local work, ` +
        `and set it in Vercel under Project → Settings → Environment Variables.`
    );
  }
  return value;
}

// One client for the whole browser session. Creating a second would mean two
// copies of the auth state, and whichever refreshed the token last would
// silently invalidate the other.
//
// Typed as SupabaseClient rather than inferred: without a generated Database
// generic the inferred return is `any`, which would quietly switch off type
// checking on every query written against it.
let browserClient: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!browserClient) {
    browserClient = createBrowserClient(
      required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
      required(
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )
    );
  }
  return browserClient;
}

// True when the app has been given somewhere to talk to. Lets the UI keep
// working on local storage while the backend is still being wired up, instead
// of crashing on a screen that has nothing to do with accounts.
export const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
