import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

// Life area Active/Inactive toggle (Settings) and its effect across the app.
// Runs against the local Supabase test stack only (see tests/e2e/env.ts).

const sidebarLink = (page: Page, name: string) => page.locator('aside nav[aria-label="Main"] a', { hasText: name });
const toggle = (page: Page, name: string) => page.getByRole("checkbox", { name: `${name} active` });

async function setActive(page: Page, name: string, active: boolean) {
  await page.goto("/settings");
  const box = toggle(page, name);
  await expect(box).toBeChecked({ checked: !active });
  await box.click();
  await expect(page.getByText(`${name} ${active ? "reactivated" : "deactivated"}`)).toBeVisible();
  await expect(box).toBeChecked({ checked: active });
}

test.describe.serial("life area active / inactive", () => {
  test("setup: a goal linked to Fitness & Health", async ({ page, problems }) => {
    await page.goto("/goals");
    await page.getByRole("button", { name: "New goal" }).click();
    await page.fill("#title", "Marathon plan");
    await page.selectOption("#life_area_id", { label: "Fitness & Health" });
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByRole("button", { name: /Marathon plan/ })).toBeVisible();
    void problems;
  });

  test("deactivating hides the area everywhere and persists", async ({ page, problems }) => {
    await page.goto("/settings");
    await expect(sidebarLink(page, "Fitness & Health")).toBeVisible();
    await setActive(page, "Fitness & Health", false);

    // 2. sidebar
    await expect(sidebarLink(page, "Fitness & Health")).toHaveCount(0);
    // 3. persists after refresh
    await page.reload();
    await expect(toggle(page, "Fitness & Health")).not.toBeChecked();
    await expect(sidebarLink(page, "Fitness & Health")).toHaveCount(0);

    // 4. analytics + dashboard exclude it from scoring
    await page.goto("/analytics");
    await expect(page.locator("table tbody tr", { hasText: "Education" })).toHaveCount(1);
    await expect(page.locator("table tbody tr", { hasText: "Fitness & Health" })).toHaveCount(0);
    await page.goto("/dashboard");
    const areaCards = page.locator("section", { has: page.getByRole("heading", { name: "Life areas" }) });
    await expect(areaCards).not.toContainText("Fitness & Health");
    await expect(areaCards).toContainText("Education");

    // new-item selectors no longer offer it
    await page.goto("/tasks");
    await page.getByRole("button", { name: "New task" }).click();
    await expect(page.locator("#life_area_id option", { hasText: "Fitness & Health" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    // 9. existing data is untouched and still linked (shown as inactive when editing)
    await page.goto("/goals");
    await page.getByRole("button", { name: /Marathon plan/ }).click();
    await expect(page.locator("dialog[open]")).toContainText("Fitness & Health");
    await page.locator("dialog[open]").getByRole("button", { name: "Edit" }).click();
    await expect(page.locator("dialog[open] #life_area_id option:checked").last()).toHaveText("Fitness & Health (inactive)");
    await page.keyboard.press("Escape");

    // the module page stays reachable and says why it is hidden
    await page.goto("/fitness");
    await expect(page.getByRole("status")).toContainText("Fitness & Health is inactive");
    void problems;
  });

  test("reactivating restores it everywhere", async ({ page, problems }) => {
    await setActive(page, "Fitness & Health", true);
    await expect(sidebarLink(page, "Fitness & Health")).toBeVisible();
    await page.reload();
    await expect(toggle(page, "Fitness & Health")).toBeChecked();
    await page.goto("/analytics");
    await expect(page.locator("table tbody tr", { hasText: "Fitness & Health" })).toHaveCount(1);
    await page.goto("/fitness");
    await expect(page.getByRole("status")).toHaveCount(0);
    await page.goto("/goals");
    await page.getByRole("button", { name: /Marathon plan/ }).click();
    await page.locator("dialog[open]").getByRole("button", { name: "Edit" }).click();
    await expect(page.locator("dialog[open] #life_area_id option:checked").last()).toHaveText("Fitness & Health");
    void problems;
  });

  test("several areas at once, including the journal area", async ({ page, problems }) => {
    await setActive(page, "Education", false);
    await setActive(page, "Religion", false);
    await setActive(page, "Mind & Reflection", false);
    await page.reload();
    for (const name of ["Education", "Religion", "Journal & Notes"]) await expect(sidebarLink(page, name)).toHaveCount(0);
    await expect(sidebarLink(page, "Finance")).toBeVisible();
    await page.goto("/analytics");
    for (const name of ["Education", "Religion", "Mind & Reflection"]) await expect(page.locator("table tbody tr", { hasText: name })).toHaveCount(0);
    await expect(page.locator("main")).toContainText("of 7 life areas");

    await setActive(page, "Education", true);
    await setActive(page, "Religion", true);
    await setActive(page, "Mind & Reflection", true);
    await page.reload();
    for (const name of ["Education", "Religion", "Journal & Notes"]) await expect(sidebarLink(page, name)).toBeVisible();
    void problems;
  });
});

test.describe("failures and duplicate clicks", () => {
  test.use({ expectedConsoleErrors: [/Failed to load resource: the server responded with a status of 500/] });

  test("a failed save restores the checkbox and shows an error", async ({ page, problems }) => {
    await page.goto("/settings");
    await page.route("**/rest/v1/life_areas**", (route) =>
      route.request().method() === "PATCH" ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Simulated outage" }) }) : route.continue(),
    );
    const box = toggle(page, "Finance");
    await expect(box).toBeChecked();
    await box.click();
    await expect(page.getByText("Couldn't deactivate Finance: Simulated outage")).toBeVisible();
    await expect(box).toBeChecked();
    await expect(box).toBeEnabled();
    await page.unroute("**/rest/v1/life_areas**");
    await page.reload();
    await expect(toggle(page, "Finance")).toBeChecked();
    await expect(sidebarLink(page, "Finance")).toBeVisible();
    void problems;
  });

  test("the checkbox is locked while saving, so rapid clicks send one request", async ({ page, problems }) => {
    await page.goto("/settings");
    let patches = 0;
    await page.route("**/rest/v1/life_areas**", async (route) => {
      if (route.request().method() === "PATCH") {
        patches++;
        await new Promise((r) => setTimeout(r, 800));
      }
      await route.continue();
    });
    const box = toggle(page, "Personal Growth");
    await box.click();
    await expect(box).toBeDisabled();
    await expect(page.locator('label[aria-busy="true"]')).toContainText("Saving…");
    await box.click({ force: true, timeout: 1000 }).catch(() => {});
    await box.click({ force: true, timeout: 1000 }).catch(() => {});
    await expect(page.getByText("Personal Growth deactivated")).toBeVisible();
    expect(patches).toBe(1);
    await page.unroute("**/rest/v1/life_areas**");
    await setActive(page, "Personal Growth", true);
    void problems;
  });
});
