import "server-only";

/**
 * Server Supabase client, for Server Components, Route Handlers and Server
 * Actions.
 *
 * Still the anon key, still bound to the caller's session, still fully subject
 * to Row Level Security. The only difference from the browser client is where
 * it runs and that it reads the session from the request cookies.
 *
 * This is the client that server-side authorization checks should use. Reaching
 * for the service-role client to "make a query work" would silently bypass
 * every policy in the database.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import type { Database } from "@/lib/types/database";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Session refresh is handled by middleware, so this is safe to ignore.
        }
      },
    },
  });
}
