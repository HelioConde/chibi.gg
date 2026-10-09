const { test, expect } = require("@playwright/test");

async function checkLayout(page, label) {
  await page.screenshot({
    path: `visual-audit/${test.info().project.name}-${label}.png`,
    fullPage: true,
    animations: "disabled",
  });
  const metrics = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: document.documentElement.clientWidth,
  }));
  expect(metrics.scroll, `horizontal overflow: ${label} (${metrics.scroll}px vs ${metrics.width}px)`).toBeLessThanOrEqual(metrics.width + 4);
}

test("home: navigation, search and responsive layout", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".home-hero-copy h1")).toBeVisible();
  await expect(page.locator("#home-riot-id")).toBeVisible();
  await expect(page.locator(".topbar")).toBeVisible();
  await checkLayout(page, "home");
  expect(errors).toEqual([]);
});

test("keyboard search: dialog, escape and focus restoration", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const trigger = page.locator(".global-search-trigger");
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Fechar pesquisa" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("synthetic review: history is accessible without live Riot key", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/?demo=review", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".profile-page")).toBeVisible();
  await checkLayout(page, "review-demo");
  expect(errors).toEqual([]);
});

for (const route of ["meta", "comps", "stats", "builder", "leaderboard", "overlay"]) {
  test(`advanced page ${route} loads without uncaught errors`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/#" + route, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".app-shell main")).toBeVisible();
    await page.waitForTimeout(500);
    await checkLayout(page, route);
    expect(errors).toEqual([]);
  });
}


test("optimized local TFT artwork is served as WebP", async ({ request }) => {
  const response = await request.get("/img/output-v2/chibi-ui-20/element_003.webp");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/webp");
  expect((await response.body()).length).toBeGreaterThan(1000);
});

test("history typography is readable on both viewport sizes", async ({ page }) => {
  await page.goto("/?demo=review", { waitUntil: "domcontentloaded" });
  const history = page.locator(".profile-history-first .profile-history-head");
  await expect(history).toBeVisible();
  const sizes = await history.evaluate(root => {
    const title = root.querySelector(".profile-history-titlecopy h2");
    const description = root.querySelector(".profile-history-titlecopy p");
    const firstButton = root.querySelector(".history-head-controls button");
    return {
      title: parseFloat(getComputedStyle(title).fontSize),
      description: parseFloat(getComputedStyle(description).fontSize),
      button: firstButton ? parseFloat(getComputedStyle(firstButton).fontSize) : 0,
      textFits: root.getBoundingClientRect().width >= title.getBoundingClientRect().width,
    };
  });
  expect(sizes.title).toBeGreaterThanOrEqual(22);
  expect(sizes.description).toBeGreaterThanOrEqual(12);
  expect(sizes.button).toBeGreaterThanOrEqual(11);
  expect(sizes.textFits).toBeTruthy();
});
