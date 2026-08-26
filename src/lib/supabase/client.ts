"use client";

/**
 * Browser Supabase client.
 *
 * Runs with the anon key and the signed-in user's session. It holds no
 * privileges of its own — every read and write it attempts is evaluated by Row
 * Level Security in the database. Treat anything this client can do as
 * something an ordinary user could also do by hand with the same session.
 */

import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import type { Database } from "@/lib/types/database";

export function createClient() {
  return createBrowserClient<Database>(env.supabaseUrl, env.supabaseAnonKey);
}
