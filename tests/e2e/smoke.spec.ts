import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

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
      // Accessibility: every interactive element has an accessible name.
      const unnamed = await page.evaluate(() => {
        const name = (el: Element) => {
          const e = el as HTMLElement;
          const labelledby = e.getAttribute("aria-labelledby");
          const byId = labelledby ? labelledby.split(" ").map((id) => document.getElementById(id)?.textContent ?? "").join(" ") : "";
          const labels = (e as HTMLInputElement).labels ? Array.from((e as HTMLInputElement).labels!).map((l) => l.textContent ?? "").join(" ") : "";
          return (e.getAttribute("aria-label") ?? "") + byId + labels + (e.textContent ?? "") + (e.getAttribute("title") ?? "") + (e.getAttribute("placeholder") ?? "");
        };
        return Array.from(document.querySelectorAll("button, a[href], input:not([type=hidden]), select, textarea"))
          .filter((el) => (el as HTMLElement).offsetParent !== null && !name(el).trim())
          .map((el) => el.outerHTML.slice(0, 120));
      });
      expect(unnamed, `elements without an accessible name:\n${unnamed.join("\n")}`).toEqual([]);
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

  test("habit check-in updates the streak", async ({ page, problems }, info) => {
    const name = `Meditate ${info.retry}`; // unique per attempt: the account is shared across suites
    await page.goto("/habits");
    await page.getByRole("button", { name: "New habit" }).click();
    await page.fill("#name", name);
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await page.getByRole("button", { name: `Complete ${name}` }).last().click();
    await expect(page.locator("tr", { hasText: name })).toContainText("100%");
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

  test("calendar event appears in the agenda", async ({ page, problems }) => {
    await page.goto("/calendar?view=agenda");
    await page.getByRole("button", { name: "New event" }).click();
    await page.fill("#title", "Dentist");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.locator("main")).toContainText("Dentist");

    // A weekly event that started four weeks ago must still be expanded into this week's agenda.
    const past = new Date(Date.now() - 28 * 86_400_000);
    const wall = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca", year: "numeric", month: "2-digit", day: "2-digit" }).format(past) + "T18:00";
    await page.getByRole("button", { name: "New event" }).click();
    await page.fill("#title", "Weekly sync");
    await page.fill("#start_at", wall);
    await page.fill("#end_at", wall.replace("T18:00", "T19:00"));
    await page.selectOption("#recurrence", "weekly");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.locator("main")).toContainText("Weekly sync");
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
