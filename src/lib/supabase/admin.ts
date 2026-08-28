import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The service-role client. It bypasses every row-level policy, which is why it
 * exists — suspending or deleting an account cannot be done any other way —
 * and why it must never reach a browser.
 *
 * Two things keep it server-side: the key has no NEXT_PUBLIC_ prefix, so Next
 * will not inline it into the bundle, and the guard below turns a mistaken
 * import from a client component into an immediate, obvious crash rather than
 * a silent leak.
 *
 * Never import this from anything under a "use client" directive.
 */
export function supabaseAdmin(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error(
      "supabaseAdmin() was called in a browser. The service key must never " +
        "leave the server."
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it in Vercel under " +
        "Project → Settings → Environment Variables — without a NEXT_PUBLIC_ " +
        "prefix, or it would be published to every visitor."
    );
  }

  // No session to persist or refresh: this client acts as the service, never
  // as a person, and each request makes a fresh one.
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
