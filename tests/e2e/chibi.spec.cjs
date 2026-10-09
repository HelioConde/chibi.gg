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


test("public TFT meta uses authorized lightweight requests when scrolled into view",async ({page})=>{
  const requests=[];
  await page.route("**/functions/v1/public-tft-**",async route=>{
    const req=route.request();
    if(req.url().includes("public-tft-comps")||req.url().includes("public-tft-stats")){
      requests.push({url:req.url(),headers:req.headers()});
      const stats=req.url().includes("public-tft-stats");
      return route.fulfill({
        status:200,
        contentType:"application/json",
        body:JSON.stringify(stats
          ?{context:{setNumber:18,queueId:1100,minGames:4},sampleParticipants:0,champions:[],traits:[],items:[]}
          :{context:{setNumber:18,queueId:1100,minGames:4},sampleParticipants:0,comps:[]}),
      });
    }
    return route.continue();
  });
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await page.locator(".home-meta-preview").scrollIntoViewIfNeeded();
  await expect.poll(()=>requests.length,{timeout:15000}).toBeGreaterThanOrEqual(2);
  for(const entry of requests){
    expect(entry.headers["apikey"]).toMatch(/^sb_publishable_/);
    expect(entry.headers["authorization"]).toContain("Bearer sb_publishable_");
  }
});

test("account menu is accessible and usable even when its SDK is deferred",async ({page})=>{
  await page.goto("/",{waitUntil:"domcontentloaded"});
  if(test.info().project.name==="mobile-chromium"){
    await page.getByRole("button",{name:"Abrir navegação"}).click();
    await expect(page.locator(".mobile-nav-account")).toBeVisible();
  }
  const trigger=page.locator(".account-menu-trigger");
  await expect(trigger).toBeVisible();
  await trigger.click();
  const panel=page.locator(".account-menu-panel");
  await expect(panel).toBeVisible({timeout:20000});
  await expect(panel).toHaveAttribute("role","dialog");
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
});


test("home uses the reduced CSS without requesting full advanced styles",async ({page})=>{
  const cssRequests=[];
  page.on("request",request=>{
    if(request.url().includes(".generated.css"))cssRequests.push(request.url());
  });
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator(".home-hero-copy h1")).toBeVisible();
  await expect(page.locator(".home-meta-preview")).toBeAttached();
  const heroStyle=await page.locator(".home-hero-copy h1").evaluate(node=>({
    fontSize:parseFloat(getComputedStyle(node).fontSize),
    color:getComputedStyle(node).color,
  }));
  expect(heroStyle.fontSize).toBeGreaterThan(30);
  expect(cssRequests.filter(url=>url.includes("styles-full.generated.css"))).toHaveLength(0);
});

test("advanced pages load full CSS before rendering content",async ({page})=>{
  await page.goto("/#builder",{waitUntil:"domcontentloaded"});
  await expect(page.locator(".builder-page")).toBeVisible({timeout:20000});
  const sample=await page.locator(".builder-page").evaluate(node=>({
    display:getComputedStyle(node).display,
    padding:getComputedStyle(node).paddingTop,
  }));
  expect(sample.display).not.toBe("none");
  expect(sample.padding).not.toBe("");
});


test("full Builder remains scrollable after lazy route CSS loads",async ({page})=>{
  await page.goto("/#builder",{waitUntil:"domcontentloaded"});
  await expect(page.locator(".builder-page")).toBeVisible({timeout:20000});
  await page.waitForTimeout(350);
  const dimensions=await page.evaluate(()=>{
    const builder=document.querySelector(".builder-page");
    const shell=document.querySelector(".app-shell");
    const root=document.getElementById("root");
    const metrics=(element)=>element?{
      height:Math.round(element.getBoundingClientRect().height),
      scrollHeight:element.scrollHeight,
      overflowY:getComputedStyle(element).overflowY,
      position:getComputedStyle(element).position,
      maxHeight:getComputedStyle(element).maxHeight,
    }:null;
    return {
      viewport:innerHeight,
      html:metrics(document.documentElement),
      body:metrics(document.body),
      root:metrics(root),
      shell:metrics(shell),
      builder:metrics(builder),
      fullCssLoaded:!!Array.from(document.styleSheets).find(sheet=>(sheet.href||"").includes("styles-full")),
    };
  });
  console.log("BUILDER_SCROLL_DIAGNOSTIC",JSON.stringify(dimensions));
  const expectedHeight=test.info().project.name==="mobile-chromium"?2100:1600;
  expect(dimensions.html.scrollHeight).toBeGreaterThan(expectedHeight);
});


test("public aggregate requests are deduplicated while profiles remain uncached",async ({page})=>{
  let statusCalls=0;
  await page.route("**/functions/v1/public-tft-status",async route=>{
    if(route.request().method()==="OPTIONS"){
      return route.fulfill({status:200,headers:{
        "access-control-allow-origin":"*",
        "access-control-allow-headers":"authorization, apikey, content-type",
        "access-control-allow-methods":"POST, OPTIONS",
      }});
    }
    const input=route.request().postDataJSON();
    if(input.platform!=="oc1")return route.continue();
    statusCalls++;
    return route.fulfill({
      status:200,
      headers:{"access-control-allow-origin":"*","content-type":"application/json"},
      body:JSON.stringify({platform:"OC1",id:"ok",name:"TFT",locales:[],maintenances:[],incidents:[],operational:true,checkedAt:Date.now(),source:"tft-status-v1"}),
    });
  });
  await page.goto("/",{waitUntil:"domcontentloaded"});
  const result=await page.evaluate(async()=>{
    const api=await import("/src/api/tft.ts");
    const rows=await Promise.all([
      api.fetchTftStatus("oc1"),
      api.fetchTftStatus("oc1"),
      api.fetchTftStatus("oc1"),
    ]);
    return rows.map(row=>row.platform);
  });
  expect(result).toEqual(["OC1","OC1","OC1"]);
  expect(statusCalls).toBe(1);
});

test("temporary public API failures can be retried immediately",async ({page})=>{
  let attempts=0;
  await page.route("**/functions/v1/public-tft-status",async route=>{
    if(route.request().method()==="OPTIONS"){
      return route.fulfill({status:200,headers:{
        "access-control-allow-origin":"*",
        "access-control-allow-headers":"authorization, apikey, content-type",
        "access-control-allow-methods":"POST, OPTIONS",
      }});
    }
    if(route.request().postDataJSON().platform!=="jp1")return route.continue();
    attempts++;
    const unavailable=attempts===1;
    return route.fulfill({
      status:unavailable?503:200,
      headers:{"access-control-allow-origin":"*","content-type":"application/json"},
      body:JSON.stringify(unavailable
        ?{error:"riot_unreachable",message:"Serviço temporariamente indisponível"}
        :{platform:"JP1",id:"ok",name:"TFT",locales:[],maintenances:[],incidents:[],operational:true,checkedAt:Date.now(),source:"tft-status-v1"}),
    });
  });
  await page.goto("/",{waitUntil:"domcontentloaded"});
  const result=await page.evaluate(async()=>{
    const api=await import("/src/api/tft.ts");
    let code="";
    try{await api.fetchTftStatus("jp1");}
    catch(error){code=error.code;}
    const recovered=await api.fetchTftStatus("jp1");
    return {code,platform:recovered.platform};
  });
  expect(result).toEqual({code:"riot_unreachable",platform:"JP1"});
  expect(attempts).toBe(2);
});


test("Riot pagination advances by upstream IDs when some match details are missing",async ({page})=>{
  const now=Date.now();
  const matches=Array.from({length:18},(_,i)=>({
    id:"BR1_"+(7654321000+i),
    playedAt:now-i*3000000,
    duration:1800,
    queueId:1100,
    setNumber:18,
    setName:"Set 18",
    gameVersion:"16.19.1",
    placement:(i%8)+1,
    level:8,
    goldLeft:10,
    damageToPlayers:25,
    augments:[],
    traits:[],
    units:[],
  }));
  const corsHeaders={
    "access-control-allow-origin":"*",
    "access-control-allow-methods":"POST, OPTIONS",
    "access-control-allow-headers":"apikey, authorization, content-type",
  };
  await page.route("**/functions/v1/public-tft-profile",route=>{
    if(route.request().method()==="OPTIONS")return route.fulfill({status:200,headers:corsHeaders});
    return route.fulfill({
    status:200,
    contentType:"application/json",
    headers:{"access-control-allow-origin":"*"},
    body:JSON.stringify({
      player:{gameName:"QAPlayer",tagLine:"TEST",platform:"BR1",level:100,profileIconId:0},
      ranked:[],
      summary:{matches:18,averagePlacement:4.5,top4Rate:50,winRate:6,firsts:1,eighths:2},
      matches,
      paging:{start:0,count:20,requested:20,returned:18},
      partial:{summoner:false,ranked:false,history:false},
    }),
    });
  });
  const starts=[];
  await page.route("**/functions/v1/public-tft-history",route=>{
    if(route.request().method()==="OPTIONS")return route.fulfill({status:200,headers:corsHeaders});
    const body=route.request().postDataJSON();
    starts.push(body.start);
    return route.fulfill({
      status:200,
      contentType:"application/json",
      headers:{"access-control-allow-origin":"*"},
      body:JSON.stringify({
        matches:[],
        paging:{start:body.start,count:20,requested:starts.length===1?20:0,returned:0},
      }),
    });
  });
  await page.goto("/?player=QAPlayer&tag=TEST&region=br1",{waitUntil:"domcontentloaded"});
  await expect(page.locator(".profile-page")).toBeVisible({timeout:20000});
  const more=page.locator(".load-more");
  await expect(more).toBeVisible();
  await more.click();
  await expect.poll(()=>starts.length).toBe(1);
  await expect(more).toBeEnabled();
  await more.click();
  await expect.poll(()=>starts.length).toBe(2);
  expect(starts).toEqual([20,40]);
  await expect(more).toHaveCount(0);
});
