// Public Supabase connection settings (confirmed project: grhbvkksrwsqwdznfbnj).
// Both values are PUBLIC by design: they are shipped to every browser in the JS bundle, and all data is
// protected by Row Level Security. They are built-in defaults so that every deployment of this repository
// connects to the right database even without Vercel configuration; NEXT_PUBLIC_* environment variables,
// when set, take precedence. Never put a service-role key here or anywhere in the client.
const DEFAULT_SUPABASE_URL = "https://grhbvkksrwsqwdznfbnj.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_W4e_EC2-ruDpR2GqnIFIag_SvddalBJ";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY;

/** Returns the names of required settings that are missing (empty array = configured). */
export function missingSupabaseEnv(): string[] {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!SUPABASE_PUBLISHABLE_KEY) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  return missing;
}
