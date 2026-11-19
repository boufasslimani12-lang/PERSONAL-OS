import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { SUPABASE_URL } from "@/lib/supabase/config";
import { buildCsp, createNonce } from "@/lib/security/csp";

export async function proxy(request: NextRequest) {
  const nonce = createNonce();
  const csp = buildCsp({ nonce, supabaseUrl: SUPABASE_URL, isDev: process.env.NODE_ENV === "development" });

  // Next.js reads the CSP from the request headers and applies the nonce to its own scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = await updateSession(request, requestHeaders);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
