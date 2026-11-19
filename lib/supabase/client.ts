"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function getSupabaseBrowser() {
  if (!client) {
    client = createBrowserClient<Database>(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
    );
  }
  return client;
}
