// Public Supabase connection settings, read from environment variables in one place.
// Both values are public by design (shipped to the browser; data is protected by Row Level Security).
// Never put a service-role key here or anywhere in the client.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** Returns the names of required settings that are missing (empty array = configured). */
export function missingSupabaseEnv(): string[] {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!SUPABASE_PUBLISHABLE_KEY) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  return missing;
}
