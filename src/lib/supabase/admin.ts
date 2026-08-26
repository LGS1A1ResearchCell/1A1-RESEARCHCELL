import "server-only";

/**
 * Service-role Supabase client.
 *
 * This client BYPASSES ROW LEVEL SECURITY ENTIRELY. It is not a convenience for
 * awkward queries — it is a deliberate escape hatch for the small number of
 * operations that genuinely cannot be expressed as a policy, such as reading a
 * pending account request before the applicant has any role at all.
 *
 * Rules for using it:
 *
 *   1. Never import this from a Client Component. The `server-only` import above
 *      turns such an import into a build error rather than a runtime leak.
 *   2. Always perform the authorization check yourself, in the calling code,
 *      before doing anything with it. There is no policy behind you.
 *   3. Prefer `lib/supabase/server.ts`. If a normal client would work, use it.
 *
 * The key is read here rather than in `lib/env.ts` so that no module reachable
 * from the client bundle ever references it, even indirectly.
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/lib/types/database";

export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      "Missing environment variable SUPABASE_SERVICE_ROLE_KEY.\n" +
        "This key is required for privileged server-side operations. Copy " +
        ".env.example to .env.local and fill it in from your Supabase project.",
    );
  }

  return createSupabaseClient<Database>(env.supabaseUrl, serviceRoleKey, {
    auth: {
      // A service-role client has no user and must never persist or refresh
      // a session; doing so could attach the key's identity to a request.
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
