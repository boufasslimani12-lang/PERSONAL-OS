import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

// Fitness & Health — programs, workout tracking, progression and history. Local Supabase only.

const day = (page: Page, name: string) => page.locator("div.rounded-xl", { has: page.getByRole("heading", { name, exact: true }) }).first();
const exerciseCard = (page: Page, name: string) => page.locator("div.rounded-xl", { has: page.getByRole("heading", { name, exact: true, level: 3 }) }).first();

async function editDay(page: Page, dayName: string) {
  const toggle = day(page, dayName).getByRole("button", { name: `Edit ${dayName} exercises` });
  if ((await toggle.getAttribute("aria-pressed")) !== "true") await toggle.click();
}

async function addExercise(page: Page, dayName: string, exercise: string) {
  const card = day(page, dayName);
  await editDay(page, dayName);
  await card.getByLabel(`Exercise to add to ${dayName}`).selectOption({ label: exercise });
  await card.getByRole("button", { name: "Add exercise" }).click();
  await expect(card.locator("li", { hasText: exercise })).toBeVisible();
}

async function logSet(page: Page, exercise: string, set: number, kg: string, reps: string) {
  const card = exerciseCard(page, exercise);
  await card.getByLabel(`Set ${set} weight in kg`).fill(kg);
  await card.getByLabel(`Set ${set} reps`).fill(reps);
  await card.getByLabel(`Set ${set} reps`).press("Enter");
  await card.getByRole("button", { name: `Mark set ${set} done` }).click();
  await expect(card.getByRole("button", { name: `Mark set ${set} not done` })).toBeVisible();
}

test.describe.serial("fitness", () => {
  test("build a program with training days and exercises", async ({ page, problems }) => {
    await page.goto("/fitness");
    await expect(page.getByText("Create your workout program")).toBeVisible();
    await page.getByRole("button", { name: "New program" }).first().click();
    await page.fill("#name", "Upper / Lower");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.locator("#program-select option:checked")).toHaveText("Upper / Lower (active)");

    for (const name of ["Upper A", "Lower A"]) {
      await page.getByRole("button", { name: "Add training day" }).click();
      await page.fill("#name", name);
      await page.getByRole("button", { name: "Create", exact: true }).click();
      await expect(day(page, name)).toBeVisible();
    }
    await addExercise(page, "Upper A", "Barbell Bench Press");
    await addExercise(page, "Upper A", "Barbell Row");
    await addExercise(page, "Upper A", "Push-up");
    await addExercise(page, "Lower A", "Barbell Back Squat");

    // edit targets and notes (saved on blur)
    const bench = day(page, "Upper A").locator("li", { hasText: "Barbell Bench Press" });
    await bench.getByLabel("Sets").fill("2");
    await bench.getByLabel("Reps").fill("8-10");
    await bench.getByLabel("Rest (s)").fill("60");
    await bench.getByLabel("Notes").fill("Pause at chest");
    await bench.getByLabel("Notes").blur();
    // reorder: Barbell Row to the top
    await day(page, "Upper A").locator("li", { hasText: "Barbell Row" }).getByRole("button", { name: "Move up" }).click();
    // remove Push-up with the in-app confirmation
    await day(page, "Upper A").locator("li", { hasText: "Push-up" }).getByRole("button", { name: "Remove exercise" }).click();
    await page.locator("dialog[open]").getByRole("button", { name: "Delete" }).click();
    await expect(day(page, "Upper A").locator("li", { hasText: "Push-up" })).toHaveCount(0);

    await page.reload();
    // compact read view after reload: order and targets
    await expect(day(page, "Upper A").locator("li")).toHaveCount(2);
    const items = await day(page, "Upper A").locator("li").allInnerTexts();
    expect(items[0]).toContain("Barbell Row");
    expect(items[1]).toContain("Barbell Bench Press");
    expect(items[1]).toContain("2 × 8-10 · 60s");
    expect(items[1]).toContain("Pause at chest");
    await editDay(page, "Upper A");
    const benchAfter = day(page, "Upper A").locator("li", { hasText: "Barbell Bench Press" });
    await expect(benchAfter.getByLabel("Sets")).toHaveValue("2");
    await expect(benchAfter.getByLabel("Reps")).toHaveValue("8-10");
    await expect(benchAfter.getByLabel("Rest (s)")).toHaveValue("60");
    await expect(benchAfter.getByLabel("Notes")).toHaveValue("Pause at chest");
    await expect(page.getByText("Next session")).toBeVisible();
    await expect(page.getByRole("region", { name: "Next session" }).getByRole("button", { name: "Start Upper A" })).toBeVisible();
    void problems;
  });

  test("track a workout: ordered exercises, autosave, resume, finish", async ({ page, problems }) => {
    await page.goto("/fitness");
    await page.getByRole("region", { name: "Next session" }).getByRole("button", { name: "Start Upper A" }).click();
    await expect(page.getByText("Upper A started")).toBeVisible();
    await expect(exerciseCard(page, "Barbell Bench Press")).toBeVisible();
    const headings = await page.locator("main h3").allInnerTexts();
    expect(headings.slice(0, 2)).toEqual(["Barbell Row", "Barbell Bench Press"]);
    await expect(exerciseCard(page, "Barbell Bench Press")).toContainText("Target 2 × 8-10 · rest 60s · Pause at chest");
    await expect(exerciseCard(page, "Barbell Bench Press")).toContainText("First time logging this exercise");

    await logSet(page, "Barbell Bench Press", 1, "40", "12");
    await logSet(page, "Barbell Bench Press", 2, "45", "10");
    await expect(page.getByRole("timer")).toContainText("Rest");
    await logSet(page, "Barbell Row", 1, "50", "10");

    // leave and come back: the unfinished workout resumes with its values
    await page.goto("/dashboard");
    await page.goto("/fitness");
    await expect(page.getByRole("tab", { name: /Workout · live/ })).toHaveAttribute("aria-selected", "true");
    await expect(exerciseCard(page, "Barbell Bench Press").getByLabel("Set 2 weight in kg")).toHaveValue("45");
    await expect(exerciseCard(page, "Barbell Bench Press").getByRole("button", { name: "Mark set 2 not done" })).toBeVisible();

    await page.getByRole("button", { name: "Finish" }).click();
    await expect(page.getByText("Workout saved")).toBeVisible();
    await expect(page.getByRole("button", { name: "Resume workout" })).toHaveCount(0);
    void problems;
  });

  test("history shows the session and lets me correct a set", async ({ page, problems }) => {
    await page.goto("/fitness");
    await page.getByRole("tab", { name: /History/ }).click();
    const entry = page.locator("main button", { hasText: "Upper A" }).first();
    await expect(entry).toContainText("2 exercises");
    await expect(entry).toContainText("3 sets");
    await entry.click();
    const dialog = page.locator("dialog[open]");
    await expect(dialog).toContainText("Barbell Bench Press");
    const reps = dialog.locator("section", { hasText: "Barbell Bench Press" }).getByLabel("Set 2 reps");
    await reps.fill("11");
    await reps.blur();
    await expect(page.getByText("Set updated")).toBeVisible();
    await page.keyboard.press("Escape");
    void problems;
  });

  test("next session cycles, previous performance prefills, progression updates", async ({ page, problems }) => {
    await page.goto("/fitness");
    await expect(page.getByRole("region", { name: "Next session" }).getByRole("button", { name: "Start Lower A" })).toBeVisible(); // next after Upper A
    await day(page, "Upper A").getByRole("button", { name: "Start Upper A" }).click();
    const bench = exerciseCard(page, "Barbell Bench Press");
    await expect(bench).toContainText("Last time");
    await expect(bench).toContainText("40×12 · 45×11");
    await expect(bench.getByLabel("Set 1 weight in kg")).toHaveValue("40"); // prefilled from last time
    await logSet(page, "Barbell Bench Press", 1, "50", "8");
    await page.getByRole("button", { name: "Finish" }).click();
    await expect(page.getByText("Workout saved")).toBeVisible();

    await page.getByRole("tab", { name: "Progression" }).click();
    await page.locator("#progression-exercise").selectOption({ label: "Barbell Bench Press" });
    const main = page.locator("main");
    const summary = page.getByRole("group", { name: "Exercise summary" });
    await expect(summary).toContainText("Latest50 kg8 reps");
    await expect(summary).toContainText("Previous45 kg+5 kg vs previous");
    await expect(summary).toContainText("Best50 kg");
    await expect(summary).toContainText("Latest reps8");
    await expect(summary).toContainText("Sessions2");
    await expect(main.locator(".recharts-wrapper")).toHaveCount(1);
    void problems;
  });

  test("duplicate, switch active and archive programs", async ({ page, problems }) => {
    await page.goto("/fitness");
    await page.getByRole("button", { name: "Duplicate" }).click();
    await expect(page.getByText("Duplicated Upper / Lower")).toBeVisible();
    await expect(page.locator("#program-select option:checked")).toHaveText("Upper / Lower (copy)");
    await expect(day(page, "Upper A")).toBeVisible();
    await expect(day(page, "Lower A")).toBeVisible();
    await page.getByRole("button", { name: "Set active" }).click();
    await expect(page.getByText("Upper / Lower (copy) is now your active program")).toBeVisible();
    await expect(page.locator("#program-select option:checked")).toHaveText("Upper / Lower (copy) (active)");
    await page.getByRole("button", { name: "Archive" }).click();
    await page.locator("dialog[open]").getByRole("button", { name: "Archive" }).click();
    await expect(page.getByText("Program archived")).toBeVisible();
    await expect(page.locator("#program-select option", { hasText: "copy" })).toHaveCount(0);
    await page.getByText(/Show archived programs/).click();
    await page.getByRole("button", { name: "Restore" }).click();
    await expect(page.getByText("Upper / Lower (copy) restored")).toBeVisible();
    // history is intact after all of this
    await page.getByRole("tab", { name: /History/ }).click();
    await expect(page.locator("main button", { hasText: "Upper A" })).toHaveCount(2);
    void problems;
  });

  test("the workout screen is comfortable on a phone", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: "tests/e2e/.auth/user.json", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto("/fitness");
    await page.getByRole("button", { name: /^Start / }).first().click();
    await expect(page.locator("main h3").first()).toBeVisible();
    const box = await page.getByRole("button", { name: "Mark set 1 done" }).first().boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(40);
    expect(box!.height).toBeGreaterThanOrEqual(40);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: "test-results/fitness-workout-mobile.png", fullPage: true });
    await page.getByRole("button", { name: "Discard" }).click();
    await page.locator("dialog[open]").getByRole("button", { name: "Discard" }).click();
    await expect(page.getByText("Workout discarded")).toBeVisible();
    await ctx.close();
  });
});
