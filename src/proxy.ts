import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

/**
 * Keeps the Supabase session fresh on every navigation.
 *
 * This is Next 16's `proxy` convention, which replaced `middleware`. It runs
 * before the request reaches a route.
 *
 * Route protection proper is added in the authentication phase and will build
 * on the user returned here. Authorization itself always remains in the
 * database: this decides which page a request may reach, never what the user
 * may read or write once there.
 */
export default async function proxy(request: NextRequest) {
  const { response } = await updateSession(request);
  return response;
}

export const config = {
  matcher: [
    /*
     * Every path except static assets and image files, which never carry a
     * session and would only add latency.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|pdf)$).*)",
  ],
};
