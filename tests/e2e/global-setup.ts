import { chromium, type FullConfig } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { SUPABASE_URL, SECRET_KEY, TEST_USER_FILE, assertLocalSupabase } from "./env";
import { createIsolatedUser } from "./fixtures";

// Creates a fresh, confirmed throwaway user in the LOCAL stack and saves a signed-in browser state.
export default async function globalSetup(config: FullConfig) {
  assertLocalSupabase();
  const email = `e2e-${Date.now()}@personal-os.test`;
  const password = `E2e-${crypto.randomUUID()}`;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SECRET_KEY, Authorization: `Bearer ${SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { display_name: "E2E" } }),
  });
  if (!res.ok) throw new Error(`Could not create test user: ${res.status} ${await res.text()}`);
  const user = (await res.json()) as { id: string };
  mkdirSync("tests/e2e/.auth", { recursive: true });
  writeFileSync(TEST_USER_FILE, JSON.stringify({ id: user.id, email, password }));

  const baseURL = config.projects[0].use.baseURL!;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${baseURL}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
  await page.waitForURL("**/dashboard", { timeout: 30_000 });
  await page.context().storageState({ path: "tests/e2e/.auth/user.json" });
  await browser.close();

  // Separate fresh accounts for suites that assert exact counts, so file order never matters.
  for (const label of ["dashboard", "fitness"]) await createIsolatedUser(baseURL, label);
}
