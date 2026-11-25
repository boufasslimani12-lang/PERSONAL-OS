import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { SUPABASE_URL, SECRET_KEY, TEST_USER_FILE } from "./env";

// Deletes the throwaway user; all of its rows are removed by ON DELETE CASCADE.
export default async function globalTeardown() {
  const ids: string[] = [];
  if (existsSync(TEST_USER_FILE)) ids.push((JSON.parse(readFileSync(TEST_USER_FILE, "utf8")) as { id: string }).id);
  const extra = "tests/e2e/.auth/extra-users.txt";
  if (existsSync(extra)) ids.push(...readFileSync(extra, "utf8").split("\n").filter(Boolean));
  for (const id of ids) {
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: { apikey: SECRET_KEY, Authorization: `Bearer ${SECRET_KEY}` } });
  }
  if (existsSync(extra)) unlinkSync(extra);
}
