const fs = require("node:fs");
const path = require("node:path");
const AxeBuilder = require("@axe-core/playwright").default;
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


for (const size of [320, 375, 430]) {
  test(`narrow viewport ${size}px: navigation and form remain usable`, async ({ page }) => {
    await page.setViewportSize({ width: size, height: 720 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#home-riot-id")).toBeVisible();
    const input = page.locator("#home-riot-id");
    await input.fill("AlchemyFlames#br1");
    await expect(input).toHaveValue("AlchemyFlames#br1");
    await checkLayout(page, "narrow-" + size);
    const rect = await input.boundingBox();
    expect(rect.width).toBeGreaterThan(150);
  });
}

for (const route of ["/", "/?demo=review", "/#builder"]) {
  test(`WCAG audit: ${route}`, async ({ page }) => {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".app-shell main")).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"]).analyze();
    const summary = {
      route,
      project: test.info().project.name,
      counts: results.violations.reduce((memo, issue) => {
        memo[issue.impact || "unknown"] = (memo[issue.impact || "unknown"] || 0) + 1;
        return memo;
      }, {}),
      issues: results.violations.map(issue => ({
        id: issue.id, impact: issue.impact,
        targets: issue.nodes.slice(0,5).map(n => n.target),
        help: issue.help,
      })),
    };
    fs.mkdirSync("visual-audit", { recursive: true });
    const filename = route === "/" ? "home" : route.includes("demo") ? "demo" : "builder";
    fs.writeFileSync(path.join("visual-audit", `axe-${test.info().project.name}-${filename}.json`),JSON.stringify(summary,null,2));
    console.log("AXE",JSON.stringify(summary));
    const serious = results.violations.filter(issue => issue.impact === "critical" || issue.impact === "serious");
    expect(serious, "high-impact WCAG findings: " + JSON.stringify(serious.map(i=>i.id))).toHaveLength(0);
  });
}

test("local artwork and static metadata never point to missing assets", async ({page}) => {
  const missing = [];
  page.on("response", response => {
    const url = response.url();
    if (url.includes("/img/") && url.startsWith("http://127.0.0.1:4173/") && response.status() >= 400) {
      missing.push({ url, status: response.status() });
    }
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator(".home-visual-showcase").scrollIntoViewIfNeeded();
  await page.locator(".home-builder-v2").scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  expect(missing).toEqual([]);
});


test("optimized favicon and navigation art fit actual display sizes", async ({request})=>{
  for (const [asset,ceiling] of [
    ["/favicon-64.png",100*1024],
    ["/apple-touch-icon.png",150*1024],
    ["/img/output-v2/icon/brand-96.webp",80*1024],
    ["/img/output-v2/icons/element_001-small.webp",40*1024],
    ["/img/icon-small.webp",80*1024],
  ]) {
    const response=await request.get(asset);
    expect(response.status(),asset).toBe(200);
    const bytes=await response.body();
    expect(bytes.length,asset+" unexpectedly large").toBeLessThan(ceiling);
    expect(bytes.length,asset+" empty").toBeGreaterThan(200);
  }
});
