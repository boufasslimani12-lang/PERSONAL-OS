import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

// Dashboard — Personal Command Center. Local Supabase test stack only (tests/e2e/env.ts).

const kpi = (page: Page, label: string) => page.locator('section[aria-label="Daily overview"] a', { hasText: label });
const focus = (page: Page) => page.getByRole("region", { name: "Daily focus" });

function isoInCasablanca(offsetDays = 0) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + offsetDays * 86_400_000));
}

test.describe.serial("dashboard", () => {
  test("new account: honest empty states, no invented numbers", async ({ page, problems }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Good (morning|afternoon|evening), E2E\./);
    await expect(kpi(page, "Tasks completed")).toContainText("0/0");
    await expect(kpi(page, "Habits completed")).toContainText("0/0");
    await expect(kpi(page, "Active goals")).toContainText("0");
    await expect(page.getByText("No priorities for today")).toBeVisible();
    await expect(page.getByText("No completions in the last 7 days")).toBeVisible();
    await expect(page.getByText("No tracked data yet")).toBeVisible();
    // every active life area shows "No data", never 0%
    const areas = page.locator("section", { has: page.getByRole("heading", { name: "Life areas" }) });
    await expect(areas.getByText("No data")).toHaveCount(10);
    await expect(areas).not.toContainText("0%");
    void problems;
  });

  test("quick actions open each module's own create dialog", async ({ page, problems }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Task", exact: true }).click();
    await expect(page).toHaveURL(/\/tasks$/);
    await expect(page.locator("dialog[open]")).toContainText("New task");
    await page.fill("#title", "Ship the dashboard");
    await page.selectOption("#priority", "high");
    await page.fill("#due_date", isoInCasablanca());
    await page.selectOption("#life_area_id", { label: "Career & Business" });
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);

    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Habit", exact: true }).click();
    await expect(page.locator("dialog[open]")).toContainText("New");
    await page.fill("#name", "Stretch");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);

    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Goal", exact: true }).click();
    await expect(page.locator("dialog[open]")).toContainText("New goal");
    await page.fill("#title", "Launch Personal OS");
    await page.fill("#target_date", isoInCasablanca(5));
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);

    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Journal", exact: true }).click();
    await expect(page.locator("dialog[open]")).toContainText("New daily journal");
    await page.keyboard.press("Escape");
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Open Calendar" }).click();
    await expect(page).toHaveURL(/\/calendar/);
    void problems;
  });

  test("daily focus completes tasks in sync with Tasks", async ({ page, problems }) => {
    await page.goto("/dashboard");
    await expect(kpi(page, "Tasks completed")).toContainText("0/1");
    const row = focus(page).locator("li", { hasText: "Ship the dashboard" });
    await expect(row).toContainText("High");
    await expect(row).toContainText("Today");
    await expect(row).toContainText("Career & Business");
    await row.getByRole("button", { name: "Mark as done" }).click();
    await expect(kpi(page, "Tasks completed")).toContainText("1/1");
    await expect(row).toContainText("Completed");
    await page.goto("/tasks");
    await page.getByRole("tab", { name: /Completed/ }).click();
    await expect(page.getByText("Ship the dashboard")).toBeVisible();
    // undo from the dashboard
    await page.goto("/dashboard");
    await focus(page).locator("li", { hasText: "Ship the dashboard" }).getByRole("button", { name: "Mark as not done" }).click();
    await expect(kpi(page, "Tasks completed")).toContainText("0/1");
    void problems;
  });

  test("habits complete and undo in sync with Habits; progress and chart use real data", async ({ page, problems }) => {
    await page.goto("/dashboard");
    await expect(kpi(page, "Habits completed")).toContainText("0/1");
    await page.getByRole("button", { name: "Complete Stretch" }).click();
    await expect(kpi(page, "Habits completed")).toContainText("1/1");
    await page.goto("/habits");
    await expect(page.locator("tr", { hasText: "Stretch" })).toContainText("100%");
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Undo Stretch" }).click();
    await expect(kpi(page, "Habits completed")).toContainText("0/1");
    await page.getByRole("button", { name: "Complete Stretch" }).click();
    await expect(kpi(page, "Habits completed")).toContainText("1/1");

    // chart now has data
    await expect(page.getByText("No completions in the last 7 days")).toHaveCount(0);
    await expect(page.locator(".recharts-wrapper")).toHaveCount(1);
    // goals KPI + upcoming
    await expect(kpi(page, "Active goals")).toContainText("1");
    await expect(kpi(page, "Active goals")).toContainText("1 due in the next 14 days");
    const upcoming = page.getByRole("region", { name: "Upcoming" });
    await expect(upcoming).toContainText("Launch Personal OS");
    void problems;
  });

  test("upcoming lists events and deadlines chronologically", async ({ page, problems }) => {
    // an event tomorrow at 09:00 and one in three days
    for (const [title, days] of [["Dentist", 3], ["Team sync", 1]] as const) {
      await page.goto("/calendar?view=agenda");
      await page.getByRole("button", { name: "New event" }).click();
      await page.fill("#title", title);
      await page.fill("#start_at", `${isoInCasablanca(days)}T09:00`);
      await page.fill("#end_at", `${isoInCasablanca(days)}T10:00`);
      await page.getByRole("button", { name: "Create", exact: true }).click();
      await expect(page.locator("dialog[open]")).toHaveCount(0);
    }
    await page.goto("/dashboard");
    const items = page.getByRole("region", { name: "Upcoming" }).locator("li");
    await expect(items.filter({ hasText: "Dentist" })).toBeVisible();
    const titles = await items.allInnerTexts();
    const pos = (t: string) => titles.findIndex((x) => x.includes(t));
    expect(pos("Team sync")).toBeGreaterThanOrEqual(0);
    expect(pos("Team sync")).toBeLessThan(pos("Dentist"));
    expect(pos("Dentist")).toBeLessThan(pos("Launch Personal OS"));
    await expect(items.filter({ hasText: "Team sync" })).toContainText("09:00");
    void problems;
  });

  test("KPI cards navigate to their modules", async ({ page, problems }) => {
    for (const [label, url] of [["Tasks completed", /\/tasks$/], ["Habits completed", /\/habits$/], ["Active goals", /\/goals$/]] as const) {
      await page.goto("/dashboard");
      await kpi(page, label).click();
      await expect(page).toHaveURL(url);
    }
    void problems;
  });

  test("focus stays empty-state friendly and life areas respect Settings", async ({ page, problems }) => {
    await page.goto("/settings");
    await page.getByRole("checkbox", { name: "Religion active" }).click();
    await expect(page.getByText("Religion deactivated")).toBeVisible();
    await page.goto("/dashboard");
    const areas = page.locator("section", { has: page.getByRole("heading", { name: "Life areas" }) });
    await expect(areas).not.toContainText("Religion");
    await expect(areas.locator("a").filter({ hasNotText: "How is this calculated?" })).toHaveCount(9);
    await page.goto("/settings");
    await page.getByRole("checkbox", { name: "Religion active" }).click();
    await expect(page.getByText("Religion reactivated")).toBeVisible();
    await page.goto("/dashboard");
    await expect(areas.locator("a").filter({ hasNotText: "How is this calculated?" })).toHaveCount(10);
    await expect(focus(page)).toBeVisible();
    void problems;
  });
});
