import { test as base, expect } from "@playwright/test";

/**
 * `problems` collects page errors, console errors and CSP violations; a test fails if any occur.
 * `expectedConsoleErrors` lets a test declare errors it provokes on purpose (e.g. a simulated 500).
 */
export const test = base.extend<{ problems: string[]; expectedConsoleErrors: RegExp[] }>({
  expectedConsoleErrors: [[], { option: true }],
  problems: async ({ page, expectedConsoleErrors }, use) => {
    const problems: string[] = [];
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error" && !expectedConsoleErrors.some((r) => r.test(m.text()))) problems.push(`console: ${m.text()}`);
    });
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (e) => {
        console.error(`CSP violation: ${e.violatedDirective} blocked ${e.blockedURI}`);
      });
    });
    await use(problems);
    expect(problems, problems.join("\n")).toEqual([]);
  },
});

export { expect };

/**
 * A fresh, isolated signed-in user for one test file, so suites never depend on each other's data or order.
 * Returns the storage-state path to pass to `test.use({ storageState })`. Deleted by global teardown.
 */
export async function createIsolatedUser(baseURL: string, label: string): Promise<string> {
  const { chromium } = await import("@playwright/test");
  const { appendFileSync, mkdirSync } = await import("node:fs");
  const { SUPABASE_URL, SECRET_KEY, assertLocalSupabase } = await import("./env");
  assertLocalSupabase();
  const email = `e2e-${label}-${Date.now()}@personal-os.test`;
  const password = `E2e-${crypto.randomUUID()}`;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SECRET_KEY, Authorization: `Bearer ${SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { display_name: "E2E" } }),
  });
  if (!res.ok) throw new Error(`Could not create test user: ${res.status} ${await res.text()}`);
  const { id } = (await res.json()) as { id: string };
  mkdirSync("tests/e2e/.auth", { recursive: true });
  appendFileSync("tests/e2e/.auth/extra-users.txt", id + "\n");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${baseURL}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
  await page.waitForURL("**/dashboard", { timeout: 30_000 });
  const path = `tests/e2e/.auth/${label}.json`;
  await page.context().storageState({ path });
  await browser.close();
  return path;
}
