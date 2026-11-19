// Test environment guard: the suite must never write to a real Supabase project.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SECRET_KEY = process.env.E2E_SUPABASE_SECRET_KEY ?? "";

export function assertLocalSupabase() {
  let host = "";
  try {
    host = new URL(SUPABASE_URL).hostname;
  } catch {
    /* empty */
  }
  if (!["127.0.0.1", "localhost"].includes(host)) {
    throw new Error(
      `E2E tests only run against a LOCAL Supabase stack. NEXT_PUBLIC_SUPABASE_URL is "${SUPABASE_URL || "(unset)"}". ` +
        "Start one with `supabase start` and export its URL and keys (see docs/TESTING.md).",
    );
  }
  if (!SECRET_KEY) throw new Error("E2E_SUPABASE_SECRET_KEY (local stack secret key) is required to create the throwaway test user.");
}

export const TEST_USER_FILE = "tests/e2e/.auth/test-user.json";
