import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

/**
 * Session refresh and coarse route protection.
 *
 * This turns away signed-out visitors at the door. It deliberately does NOT
 * check roles or account status: doing so would mean a database round trip on
 * every request, including for public archive pages that need none.
 *
 * Whether the session is actually allowed to manage anything is checked in the
 * /admin layout, which runs on the server for exactly those routes. And neither
 * is the real boundary — Row Level Security is. This only decides which page
 * someone reaches, never what data they can read once there.
 */

const PROTECTED = ["/admin"];

export default async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const needsSession = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (needsSession && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|pdf)$).*)",
  ],
};
