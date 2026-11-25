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
