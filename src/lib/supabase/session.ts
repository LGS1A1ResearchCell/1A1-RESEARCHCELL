import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import type { Database } from "@/lib/types/database";

/**
 * Refreshes the Supabase session on every request and hands back both the
 * response (carrying any rotated auth cookies) and the current user.
 *
 * Without this, Server Components would eventually read an expired token and
 * users would appear randomly signed out.
 *
 * Note this returns the user for *routing* decisions only. It is not an
 * authorization check: what a user may actually do is decided by RLS in the
 * database, not by which page the middleware let them reach.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.supabaseUrl,
    env.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() revalidates the token against Supabase. getSession() only decodes
  // the cookie and can be spoofed, so it must not be used for this.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
