import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config";

const PUBLIC_PATHS = ["/login", "/auth"];

/**
 * Refreshes the Supabase session cookie and guards private routes.
 * `requestHeaders` carries the CSP nonce through to the page render.
 */
export async function updateSession(request: NextRequest, requestHeaders: Headers) {
  const next = () => NextResponse.next({ request: { headers: requestHeaders } });
  let response = next();
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return response; // misconfigured: the page renders its setup screen

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = next();
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  const redirect = (pathname: string, search = "") => {
    const to = request.nextUrl.clone();
    to.pathname = pathname;
    to.search = search;
    const r = NextResponse.redirect(to);
    response.cookies.getAll().forEach((c) => r.cookies.set(c)); // keep refreshed session cookies
    return r;
  };

  if (!data.user && !isPublic) return redirect("/login", path === "/" ? "" : `?next=${encodeURIComponent(path)}`);
  if (data.user && path === "/login") return redirect("/dashboard");
  return response;
}
