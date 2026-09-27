import { expect, test } from "@playwright/test";

const TRACE = "/rails/04-request-lifecycle/guided-trace/";
const PIN = "c3466ea00d7121798e3aa3144ffdf7174b81d8cb";

test.describe("Guided Trace", () => {
  test("starts on step 1 with the pinned GitHub link", async ({ page }) => {
    await page.goto(TRACE);
    await expect(page.locator(".gt-counter")).toHaveText("Step 1 of 8 · railties");
    await expect(page.getByRole("heading", { level: 2, name: "Puma hands Rails a Rack env" })).toBeVisible();
    await expect(page.getByRole("link", { name: "View on GitHub at pin" })).toHaveAttribute(
      "href",
      `https://github.com/rails/rails/blob/${PIN}/railties/lib/rails/generators/rails/app/templates/config.ru.tt#L1-L6`,
    );
    await expect(page.getByRole("button", { name: "Previous step" })).toBeDisabled();
  });

  test("the step rail selects a step and updates the URL", async ({ page }) => {
    await page.goto(TRACE);
    await page.getByRole("button", { name: /Step 5: Journey finds the matching route/ }).click();
    await expect(page.locator(".gt-counter")).toHaveText("Step 5 of 8 · actionpack");
    await expect(page.locator(".gt-code pre")).toContainText("recognize(req) do |route, parameters|");
    await expect(page.locator(".gt-lines")).toHaveText("L30–41");
    await expect(page.getByRole("button", { name: /Step 5:/ })).toHaveAttribute("aria-current", "step");
    await expect(page).toHaveURL(/#step-5$/);
  });

  test("prev/next walk the steps and stop at both ends", async ({ page }) => {
    await page.goto(TRACE);
    const next = page.getByRole("button", { name: "Next step" });
    const prev = page.getByRole("button", { name: "Previous step" });
    for (let i = 2; i <= 8; i++) {
      await next.click();
      await expect(page.locator(".gt-counter")).toHaveText(new RegExp(`^Step ${i} of 8`));
    }
    await expect(next).toBeDisabled();
    await expect(page.locator(".gt-handoff-call")).toHaveText("ArticlesController#show → ActionView");
    await prev.click();
    await expect(page.locator(".gt-counter")).toHaveText(/^Step 7 of 8/);
    await expect(page.getByRole("heading", { level: 2, name: "Metal sets up request and response" })).toBeFocused();
  });

  test("a #step hash deep-links to that step", async ({ page }) => {
    await page.goto(`${TRACE}#step-8`);
    await expect(page.locator(".gt-counter")).toHaveText("Step 8 of 8 · actionpack");
    await expect(page.locator(".gt-code pre")).toContainText("could not be found for #{self.class.name}");
  });

  test("shared chrome: breadcrumb, format switcher, meta chips", async ({ page }) => {
    await page.goto(TRACE);
    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumbs.getByRole("link", { name: "Ruby on Rails, in depth" })).toHaveAttribute("href", "/rails/");
    await expect(crumbs.getByText("II · Request lifecycle")).toHaveAttribute("aria-current", "page");
    const formats = page.getByRole("navigation", { name: "Formats of this chapter" }).getByRole("link");
    await expect(formats).toHaveText(["Guided Trace"]);
    await expect(formats.first()).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("list", { name: "About this article" })).toContainText("rails/rails @ c3466ea");
    await expect(page.getByRole("list", { name: "About this article" })).toContainText("Up to date");
  });
});

test("library home links to the Rails set", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(34, 40, 56)");
  await page.getByRole("link", { name: /Ruby on Rails/ }).click();
  await expect(page).toHaveURL(/\/rails\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ruby on Rails, in depth");
});

test("set home shows the pin and links chapter 04 to its Guided Trace", async ({ page }) => {
  await page.goto("/rails/");
  const truth = page.getByRole("complementary", { name: "Source of truth" });
  await expect(truth).toContainText("c3466ea");
  await expect(truth).toContainText("v8.1.4");
  await expect(truth).toContainText("2026-09-27");
  await expect(truth).toContainText("Tracked symbols8");
  await page.getByRole("link", { name: /Request lifecycle/ }).click();
  await expect(page).toHaveURL(new RegExp(`${TRACE}$`));
});

test.describe("phone width", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  for (const path of ["/", "/rails/", `${TRACE}#step-8`]) {
    test(`${path} has no horizontal page scroll`, async ({ page }) => {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBe(0);
    });
  }
});
