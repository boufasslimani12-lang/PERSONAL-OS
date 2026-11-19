import { test as base, expect, type Page } from "@playwright/test";

// Collects page errors, console errors and CSP violations for every test; each test fails if any occur.
const test = base.extend<{ problems: string[] }>({
  problems: async ({ page }, use) => {
    const problems: string[] = [];
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") problems.push(`console: ${m.text()}`);
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

const ROUTES = [
  "/dashboard", "/goals", "/tasks", "/habits", "/calendar", "/fitness", "/education", "/languages",
  "/skills/hard", "/skills/soft", "/career", "/religion", "/finance", "/growth", "/journal", "/analytics", "/settings",
];

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
}

test.describe("security", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("security headers and nonce-based CSP are sent", async ({ page, problems }) => {
    const res = await page.goto("/login");
    const h = res!.headers();
    const csp = h["content-security-policy"];
    expect(csp).toContain("script-src 'self' 'nonce-");
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["x-powered-by"]).toBeUndefined();
    // the inline theme script carries the request nonce
    const nonce = /'nonce-([^']+)'/.exec(csp)![1];
    expect(await page.locator(`script[nonce]`).count()).toBeGreaterThan(0);
    expect(await page.evaluate(() => (document.querySelector("script[nonce]") as HTMLScriptElement).nonce)).toBe(nonce);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    void problems;
  });

  test("private pages redirect to login when signed out", async ({ page }) => {
    await page.goto("/finance");
    await expect(page).toHaveURL(/\/login\?next=%2Ffinance/);
  });
});

test.describe("every page renders", () => {
  for (const route of ROUTES) {
    test(`${route}`, async ({ page, problems }) => {
      const res = await page.goto(route);
      expect(res!.status()).toBeLessThan(400);
      await settle(page);
      await expect(page.getByText("Something went wrong")).toHaveCount(0);
      await expect(page.locator("main h1").first()).toBeVisible();
      void problems;
    });
  }

  test("no page-level horizontal scroll on a phone", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: "tests/e2e/.auth/user.json", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    for (const route of ["/dashboard", "/finance", "/habits", "/analytics"]) {
      await page.goto(route);
      await settle(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${route} overflows by ${overflow}px`).toBeLessThanOrEqual(1);
    }
    await ctx.close();
  });
});

test.describe.serial("core journeys", () => {
  test("goal with milestone and linked task drives progress", async ({ page, problems }) => {
    await page.goto("/goals");
    await page.getByRole("button", { name: "New goal" }).click();
    await page.fill("#title", "Run a half marathon");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await page.getByRole("button", { name: /Run a half marathon/ }).first().click();
    const dialog = page.locator("dialog[open]");
    await dialog.getByPlaceholder("Add a milestone…").fill("Run 10k");
    await dialog.getByPlaceholder("Add a milestone…").press("Enter");
    await dialog.getByPlaceholder("Add a task for this goal…").fill("Buy running shoes");
    await dialog.getByPlaceholder("Add a task for this goal…").press("Enter");
    await expect(dialog.getByText("Buy running shoes")).toBeVisible();
    await dialog.locator("li", { hasText: "Run 10k" }).locator("input[type=checkbox]").check();
    await expect(dialog).toContainText("1 of 2 items");
    void problems;
  });

  test("tasks: quick add, complete, and recurring roll-forward", async ({ page, problems }) => {
    await page.goto("/tasks");
    await page.getByPlaceholder(/Quick add/).fill("Plan the week");
    await page.getByPlaceholder(/Quick add/).press("Enter");
    const row = page.locator("div[role=button]", { hasText: "Plan the week" });
    await row.getByRole("button", { name: "Mark as done" }).click();
    await page.getByRole("tab", { name: /Completed/ }).click();
    await expect(page.getByText("Plan the week")).toBeVisible();

    await page.getByRole("tab", { name: /Today/ }).click();
    await page.getByRole("button", { name: "New task" }).click();
    await page.fill("#title", "Daily review");
    await page.selectOption("#recurrence", "daily");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await page.locator("div[role=button]", { hasText: "Daily review" }).getByRole("button", { name: "Mark as done" }).click();
    await expect(page.getByText("next occurrence scheduled")).toBeVisible();
    await page.getByRole("tab", { name: /Upcoming/ }).click();
    await expect(page.getByText("Daily review")).toBeVisible();
    void problems;
  });

  test("habit check-in updates the streak", async ({ page, problems }) => {
    await page.goto("/habits");
    await page.getByRole("button", { name: "New habit" }).click();
    await page.fill("#name", "Meditate");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await page.getByRole("button", { name: "Complete Meditate" }).last().click();
    await expect(page.locator("tr", { hasText: "Meditate" })).toContainText("100%");
    void problems;
  });

  test("finance: income and expense give the right savings rate", async ({ page, problems }) => {
    await page.goto("/finance");
    await page.getByRole("button", { name: "Transaction" }).click();
    await page.selectOption("#kind", "income");
    await page.fill("#amount", "10000");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await page.getByRole("button", { name: "Transaction" }).click();
    await page.fill("#amount", "2500.50");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.locator("main")).toContainText("75%");
    void problems;
  });

  test("journal entry renders Markdown safely", async ({ page, problems }) => {
    await page.goto("/journal");
    await page.getByRole("button", { name: /Write today/ }).first().click();
    await page.locator("dialog[open] textarea").fill("## Today\nFeeling **great** <script>window.x=1</script>");
    await page.getByRole("button", { name: "Save" }).click();
    await page.getByText("Feeling").first().click();
    await expect(page.locator("dialog[open] article strong")).toHaveText("great");
    expect(await page.evaluate(() => (window as unknown as { x?: number }).x)).toBeUndefined();
    void problems;
  });

  test("workout: log a set, rest timer, finish, then delete with in-app confirmation", async ({ page, problems }) => {
    await page.goto("/fitness");
    await page.getByRole("button", { name: "Start empty workout" }).click();
    await expect(page.getByText("sets done")).toBeVisible();
    await page.locator("select").filter({ hasText: "Add exercise…" }).selectOption({ label: "Barbell Back Squat" });
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByLabel("Reps").first().fill("5");
    await page.getByLabel("Weight").first().fill("100");
    await page.getByLabel("Weight").first().blur();
    await page.getByRole("button", { name: "Mark set done" }).first().click();
    await expect(page.getByRole("button", { name: "Skip" })).toBeVisible();
    await page.getByRole("button", { name: "Finish" }).click();
    await expect(page.getByText("Workout saved")).toBeVisible();
    await page.getByRole("tab", { name: /Overview/ }).click();
    await expect(page.getByText(/100 kg · e1RM 117 kg/)).toBeVisible();

    await page.getByRole("tab", { name: /Workouts/ }).click();
    await page.getByRole("button", { name: "Delete workout" }).first().click();
    const confirm = page.locator("dialog[open]");
    await expect(confirm).toContainText("Delete “Workout”?");
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("button", { name: "Delete workout" })).toHaveCount(1);
    await page.getByRole("button", { name: "Delete workout" }).first().click();
    await page.locator("dialog[open]").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("No completed workouts")).toBeVisible();
    void problems;
  });

  test("calendar event appears in the agenda", async ({ page, problems }) => {
    await page.goto("/calendar?view=agenda");
    await page.getByRole("button", { name: "New event" }).click();
    await page.fill("#title", "Dentist");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.locator("main")).toContainText("Dentist");
    void problems;
  });

  test("dates follow the profile time zone, not the server's", async ({ page, problems }) => {
    // Kiritimati is UTC+14: its calendar date differs from UTC's for most of the day.
    await page.goto("/settings");
    await page.selectOption("#tz", "Pacific/Kiritimati");
    await page.getByRole("button", { name: "Save preferences" }).click();
    await expect(page.getByText("Profile saved")).toBeVisible();
    const expected = new Intl.DateTimeFormat("en", { timeZone: "Pacific/Kiritimati", weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date());
    await page.goto("/dashboard");
    await expect(page.locator("main")).toContainText(expected.toUpperCase().replace(/,/g, ","), { ignoreCase: true });
    await page.goto("/settings");
    await page.selectOption("#tz", "Africa/Casablanca");
    await page.getByRole("button", { name: "Save preferences" }).click();
    await expect(page.getByText("Profile saved")).toBeVisible();
    void problems;
  });
});
