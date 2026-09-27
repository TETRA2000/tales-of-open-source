import { expect, test } from "@playwright/test";

const TRACE = "/rails/04-request-lifecycle/guided-trace/";
const PIN = "c3466ea00d7121798e3aa3144ffdf7174b81d8cb";
const ANATOMY = "/react/04-fiber-node/anatomy/";

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
    await expect(page.locator(".code-panel pre")).toContainText("recognize(req) do |route, parameters|");
    await expect(page.locator(".code-panel-lines")).toHaveText("L30–41");
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
    await expect(page.locator(".code-panel pre")).toContainText("could not be found for #{self.class.name}");
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

test.describe("Anatomy", () => {
  test("struct card lists the seven groups", async ({ page }) => {
    await page.goto(ANATOMY);
    const card = page.locator(".struct-card");
    for (const key of ["ID", "TR", "IN", "EF", "LN", "MD", "AL"]) {
      await expect(card.getByText(key, { exact: true })).toBeVisible();
    }
    await expect(card.locator(".struct-row").filter({ has: page.getByText("ID", { exact: true }) })).toContainText("tag");
  });

  test("struct source links to the pin", async ({ page }) => {
    await page.goto(ANATOMY);
    const details = page.locator("details").filter({ has: page.getByText("Source at pin", { exact: true }) });
    await details.getByText("Source at pin", { exact: true }).click();
    await expect(details.getByRole("link", { name: "View on GitHub at pin" })).toBeVisible();
    await expect(details.getByRole("link", { name: "View on GitHub at pin" })).toHaveAttribute(
      "href",
      "https://github.com/facebook/react/blob/1d34f91dfde6bba84d08b683aaba164c7194dacb/packages/react-reconciler/src/ReactFiber.js#L134-L207",
    );
  });

  test("the pointer-tree diagram is described in text", async ({ page }) => {
    await page.goto(ANATOMY);
    await expect(page.getByRole("img", { name: /Three pointers make a tree/ })).toBeVisible();
    await expect(page.getByRole("list", { name: "Edges in this diagram" })).toContainText("List — child → Item");
  });

  test("format switcher marks Anatomy as current", async ({ page }) => {
    await page.goto(ANATOMY);
    await expect(
      page.getByRole("navigation", { name: "Formats of this chapter" }).getByRole("link", { name: "Anatomy" }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("React set home shows 04 as up to date and links it", async ({ page }) => {
    await page.goto("/react/");
    const link = page.getByRole("link", { name: /Anatomy of a Fiber/ });
    await expect(link).toContainText("Up to date");
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${ANATOMY}$`));
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
  await expect(truth).toContainText("Tracked symbols66");
  await page.getByRole("link", { name: /Request lifecycle/ }).click();
  await expect(page).toHaveURL(new RegExp(`${TRACE}$`));
});

test("library home links to the React set", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /facebook\/react/ }).click();
  await expect(page).toHaveURL(/\/react\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("React, in depth");
  await expect(page.locator("h1 .accent")).toHaveCSS("color", "rgb(108, 200, 214)");
});

test("React set home shows its pin and links chapter 07 to its Guided Trace", async ({ page }) => {
  await page.goto("/react/");
  const truth = page.getByRole("complementary", { name: "Source of truth" });
  await expect(truth).toContainText("1d34f91");
  await expect(truth).toContainText("v19.3.0");
  await expect(truth).toContainText("2026-09-27");
  await expect(truth).toContainText("Tracked symbols79");
  await page.getByRole("link", { name: /What setState does/ }).click();
  await expect(page).toHaveURL(/\/react\/07-use-state\/guided-trace\/$/);
  await expect(page.getByRole("link", { name: "View on GitHub at pin" })).toHaveAttribute(
    "href",
    "https://github.com/facebook/react/blob/1d34f91dfde6bba84d08b683aaba164c7194dacb/packages/react/src/ReactHooks.js#L66-L71",
  );
  await expect(page.getByRole("list", { name: "About this article" })).toContainText("facebook/react @ 1d34f91");
});

test.describe("phone width", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  for (const path of ["/", "/rails/", "/react/", `${TRACE}#step-8`, ANATOMY]) {
    test(`${path} has no horizontal page scroll`, async ({ page }) => {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBe(0);
    });
  }
});

test.describe("phone width 375", () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test(`${ANATOMY} has no horizontal page scroll`, async ({ page }) => {
    await page.goto(ANATOMY);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
  });
});

const TRACES = [
  { set: "rails", chapter: "02-booting", label: "The boot we follow", steps: 9, package: "railties", title: "config/environment.rb starts the boot" },
  { set: "rails", chapter: "05-routing", label: "The route we follow", steps: 9, package: "actionpack", title: "draw evaluates routes.rb on a Mapper" },
  { set: "rails", chapter: "07-rendering", label: "The render we follow", steps: 10, package: "actionpack", title: "After the action, check whether anything was rendered" },
  { set: "rails", chapter: "10-associations", label: "The call we follow", steps: 10, package: "activerecord", title: "has_many is a class method that builds a reflection" },
  { set: "rails", chapter: "11-transactions", label: "The call we follow", steps: 10, package: "activerecord", title: "save is wrapped before it saves" },
  { set: "rails", chapter: "12-active-job", label: "The job we follow", steps: 11, package: "activejob", title: "perform_later builds a job and enqueues it" },
  { set: "react", chapter: "03-first-render", label: "The call we follow", steps: 11, package: "react-dom", title: "createRoot checks the container and builds a FiberRoot" },
  { set: "react", chapter: "05-work-loop", label: "The render we follow", steps: 12, package: "react-reconciler", title: "The Scheduler calls back into React" },
  { set: "react", chapter: "06-reconciling-children", label: "The re-render we follow", steps: 11, package: "react-reconciler", title: "Two reconcilers, one algorithm" },
  { set: "react", chapter: "07-use-state", label: "The state we follow", steps: 12, package: "react", title: "useState is a forwarder" },
  { set: "react", chapter: "08-use-effect", label: "The effect we follow", steps: 10, package: "react", title: "useEffect forwards to the dispatcher" },
  { set: "react", chapter: "10-scheduler", label: "The task we follow", steps: 10, package: "react-reconciler", title: "React translates lanes into Scheduler priorities" },
  { set: "react", chapter: "11-commit", label: "The commit we follow", steps: 10, package: "react-reconciler", title: "The commit runs its phases back to back" },
];

for (const trace of TRACES) {
  test(`${trace.set}/${trace.chapter} Guided Trace renders step 1 under its own label`, async ({ page }) => {
    await page.goto(`/${trace.set}/${trace.chapter}/guided-trace/`);
    await expect(page.getByRole("complementary", { name: trace.label })).toBeVisible();
    await expect(page.locator(".gt-counter")).toHaveText(`Step 1 of ${trace.steps} · ${trace.package}`);
    await expect(page.getByRole("heading", { level: 2, name: trace.title })).toBeVisible();
  });

  test.describe("phone width", () => {
    test.use({ viewport: { width: 390, height: 844 } });
    test(`no step of ${trace.set}/${trace.chapter} scrolls the page sideways`, async ({ page }) => {
      await page.goto(`/${trace.set}/${trace.chapter}/guided-trace/`);
      for (let i = 1; i <= trace.steps; i++) {
        await expect(page.locator(".gt-counter")).toHaveText(new RegExp(`^Step ${i} of`));
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `step ${i}`).toBe(0);
        if (i < trace.steps) await page.getByRole("button", { name: "Next step" }).click();
      }
    });
  });
}

test("the request lifecycle trace keeps the default label", async ({ page }) => {
  await page.goto(TRACE);
  await expect(page.getByRole("complementary", { name: "The request we follow" })).toBeVisible();
});
