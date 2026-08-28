import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// The server-side client, for anything that has to know who is signed in
// before the page renders — route handlers, server components, the /admin
// gate. It reads and writes the session cookies rather than holding state.
export async function supabaseServer() {
  const store = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            for (const { name, value, options } of list) {
              store.set(name, value, options);
            }
          } catch {
            // Server components cannot set cookies. That is fine: the refresh
            // will be repeated by middleware or a route handler, both of which
            // can. Throwing here would break every page render instead.
          }
        },
      },
    }
  );
}
