import { existsSync, readFileSync } from "node:fs";
import { SUPABASE_URL, SECRET_KEY, TEST_USER_FILE } from "./env";

// Deletes the throwaway user; all of its rows are removed by ON DELETE CASCADE.
export default async function globalTeardown() {
  if (!existsSync(TEST_USER_FILE)) return;
  const { id } = JSON.parse(readFileSync(TEST_USER_FILE, "utf8")) as { id: string };
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
    method: "DELETE",
    headers: { apikey: SECRET_KEY, Authorization: `Bearer ${SECRET_KEY}` },
  });
}
