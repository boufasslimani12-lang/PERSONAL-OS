import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { missingSupabaseEnv, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config";

export async function getSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component: the proxy refreshes the session instead.
          }
        },
      },
    },
  );
}

/** Returns an authenticated client + user, redirecting to /login when signed out. Cached per request. */
export const requireUser = cache(async () => {
  // Misconfigured deployment: /login renders a "Configuration required" screen instead of crashing.
  if (missingSupabaseEnv().length) redirect("/login");
  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return { supabase, user: data.user };
});
