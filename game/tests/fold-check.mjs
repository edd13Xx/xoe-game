/**
 * v18 fold check — Playwright WebKit, official iPhone 15 profile (393x659). TEST ONLY.
 * Measures key buttons WITHOUT scrolling, then advances with real taps when visible
 * (falls back to el.click() only to keep walking, and records that).
 * Usage: node tests/fold-check.mjs <build.html> <shotPrefix> <outJson>
 */
import { webkit, devices } from "/workspace/xoe-qa/node_modules/playwright/index.mjs";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const [BUILD, PREFIX, OUTJSON] = process.argv.slice(2);
const OUT = "/workspace/eddie-bot-handoff/qa";
const res = { build: BUILD, screens: {}, forced: [], errors: [], raf: {} };

const iphone = devices["iPhone 15"];
const browser = await webkit.launch({ headless: true });
const ctx = await browser.newContext({ ...iphone });
await ctx.route("**/*", (r) => (/^https?:/.test(r.request().url()) ? r.abort() : r.continue()));
const page = await ctx.newPage();
page.on("pageerror", (e) => res.errors.push(String(e)));
await page.goto(pathToFileURL(BUILD).href);
await page.waitForTimeout(1000);

const shot = (n) => page.screenshot({ path: `${OUT}/${PREFIX}-${n}.png` });
const phase = () => page.locator("#scene").getAttribute("data-phase").catch(() => null);

async function measure(label, specs) {
  const r = await page.evaluate((specs) => {
    const vh = innerHeight, vw = innerWidth;
    const out = { vh, scrollY: Math.round(scrollY), docH: document.documentElement.scrollHeight, items: {} };
    for (const [key, sel, text] of specs) {
      const els = [...document.querySelectorAll(sel)].filter((e) => !text || new RegExp(text, "i").test((e.innerText || e.textContent || "").trim()));
      const vis = els.filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; });
      const inV = vis.filter((x) => { const b = x.getBoundingClientRect(); return b.top >= 0 && b.bottom <= vh; });
      const e = inV[inV.length - 1] || vis[0];
      if (!e) { out.items[key] = null; continue; }
      const b = e.getBoundingClientRect();
      // Is the center actually the topmost element (not covered)?
      const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      const top = cy >= 0 && cy < vh ? document.elementFromPoint(cx, cy) : null;
      out.items[key] = {
        top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height),
        inView: b.top >= -1 && b.bottom <= vh + 1 && b.left >= -1 && b.right <= vw + 1,
        tappable: !!top && (top === e || e.contains(top)),
        fontPx: parseFloat(getComputedStyle(e).fontSize),
      };
    }
    return out;
  }, specs);
  r.phase = await phase();
  res.screens[label] = r;
  await shot(label);
  return r;
}

async function tap(sel, text) {
  const loc = text ? page.locator(sel).filter({ hasText: new RegExp(text, "i") }) : page.locator(sel);
  const el = loc.last();
  if (!(await el.count())) return false;
  const b = await el.boundingBox();
  const vh = 659;
  if (b && b.y >= 0 && b.y + b.height <= vh) {
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  } else {
    res.forced.push(`${sel} ${text ?? ""} @${b ? Math.round(b.y) : "?"}`);
    await el.evaluate((n) => n.click());
  }
  await page.waitForTimeout(350);
  return true;
}

async function raf(label, frames = 150) {
  res.raf[label] = await page.evaluate((n) => new Promise((done) => {
    const ts = []; let last = performance.now();
    const step = (t) => { ts.push(t - last); last = t; if (ts.length < n) requestAnimationFrame(step); else {
      ts.shift(); const avg = ts.reduce((a, b) => a + b, 0) / ts.length;
      done({ avgMs: +avg.toFixed(2), fps: +(1000 / avg).toFixed(1), maxMs: +Math.max(...ts).toFixed(1), over50: ts.filter((x) => x > 50).length });
    } };
    requestAnimationFrame(step);
  }), frames);
}

process.on("unhandledRejection", () => {});
try {
// Launch menu
await measure("launch", [
  ["start", "button", "^Start$"], ["keyBox", "input[aria-label='xAI API key']", ""],
  ["saveTest", "button", "^Save and test$"], ["tagline", ".xo-menu-sub", ""],
]);
res.grokOnBlocks = await page.locator("button.grok-toggle-btn").count();
res.disconnectButtons = await page.getByRole("button", { name: /Disconnect/i }).count();
await tap("button", "^Start$");
await page.waitForTimeout(400);
// Pilot select
{ const row = page.locator(".roster-row").first(); if (await row.count()) await row.evaluate((n) => n.click()); await page.waitForTimeout(200); }
for (const t of ["Female", "Sentinel"]) { const l = page.getByText(t, { exact: true }).first(); if (await l.count()) await l.evaluate((n) => n.click()); }
const disc = page.getByText("I confirm I have seen the simulation disclaimer.").first();
if (await disc.count()) await disc.evaluate((n) => n.click());
await page.waitForTimeout(200);
await measure("pilot", [["ready", "button", "start when ready"]]);
await tap("button", "start when ready");
await page.waitForTimeout(700);
await measure("wake", [["continue", "button", "^Continue$"], ["reminder", ".voice-reminder", ""], ["header", ".play-topbar-id .top-subtitle", ""], ["cue", "[data-next-cue]", ""]]);
res.headerText = await page.locator(".play-topbar-id .top-subtitle").first().innerText().catch(() => "");
// Walk story to practice
for (let i = 0; i < 20; i++) {
  const ph = await phase();
  if (ph === "practice" || ph === "practice-pause") break;
  if (await page.getByRole("button", { name: "Skip cinematic" }).count()) { await tap("button", "^Skip cinematic$"); continue; }
  if (!(await tap("button", "^Continue$"))) break;
}
if ((await phase()) === "practice-pause") await tap("button", "Resume practice");
await page.waitForTimeout(500);
await measure("practice", [["buy", "button", "^Buy XOE"], ["sell", "button", "^Sell XOE"], ["done", "button", "Done trading|Continue story"]]);
await raf("practice");
await tap("button", "^Buy XOE");
await page.waitForTimeout(600);
await tap("button", "^Sell XOE");
if (!(await tap("button", "^Continue story$"))) await tap("button", "^Done trading$");
await page.waitForTimeout(500);
for (let i = 0; i < 12; i++) {
  const ph = await phase();
  if (ph === "sis-rescue") break;
  if (!(await tap("button", "^Continue$"))) break;
}
await measure("sis-rescue", [["enterTerrace", "button", "^Enter the terrace$"]]);
await tap("button", "^Enter the terrace$");
await page.waitForTimeout(500);
await measure("navigate", [["moveRight", "button", "^Move right$"], ["moveDown", "button", "^Move down$"], ["inspect", "button", "Inspect sealed hatch"], ["next", "[data-terrace-next]", ""]]);
for (let i = 0; i < 10; i++) await tap("button", "^Move right$");
for (let i = 0; i < 5; i++) await tap("button", "^Move down$");
await tap("button", "Inspect sealed hatch");
await measure("navigate-hatch", [["travel", "button", "Travel to colonies"]]);
await tap("button", "Travel to colonies");
await page.waitForTimeout(900);
res.mapPhase = await phase();
const mapSpecs = [
  ["buy", "button", "^Buy XOE"], ["sell", "button", "^Sell XOE"], ["chapterCard", ".chapter-overlay", ""],
  ["chapterContinue", ".chapter-overlay button", "^Continue$"], ["chapter2", ".chapter-overlay button", "^Chapter 2$"],
  ["enter", ".enter-prompt button", "^Enter"], ["tickerRow", ".ticker-strip, .live-ticker", ""],
];
await measure("map-chapter", mapSpecs);
// overlap check chapter vs dock
res.mapOverlap = await page.evaluate(() => {
  const a = document.querySelector(".chapter-overlay")?.getBoundingClientRect();
  const b = document.querySelector(".map-trade .live-trade-hud")?.getBoundingClientRect();
  if (!a || !b) return null;
  return { overlap: !(a.bottom <= b.top || a.top >= b.bottom), card: [Math.round(a.top), Math.round(a.bottom)], dock: [Math.round(b.top), Math.round(b.bottom)] };
});
await tap(".chapter-overlay button", "^Continue$");
await page.waitForTimeout(500);
await raf("map");
// Fly to the next colony by tapping it on the map.
for (let i = 0; i < 40; i++) {
  if (await page.locator(".enter-prompt").count()) break;
  const pt = await page.evaluate(() => {
    const d = document.querySelector(".world-dome.next") || document.querySelector(".world-dome.colony");
    const sh = document.querySelector(".mars-world-shell");
    if (!d || !sh) return null;
    const s = sh.getBoundingClientRect();
    const r = d.getBoundingClientRect();
    const x = Math.min(Math.max(r.left + r.width / 2, s.left + 20), s.right - 20);
    const y = Math.min(Math.max(r.top + r.height / 2, s.top + 60), s.bottom - 150);
    return { x, y };
  });
  if (!pt) break;
  await page.touchscreen.tap(pt.x, pt.y);
  await page.waitForTimeout(400);
}
await measure("map-enter", mapSpecs);
const before = await phase();
const enterBtn = page.locator(".enter-prompt button").filter({ hasText: /^Enter/ });
if (await enterBtn.count()) {
  const b = await enterBtn.boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(700);
}
res.afterEnterPhase = await phase();
res.enterOpenedLesson = before === "colony-map" && res.afterEnterPhase !== "colony-map";
await shot("after-enter");

// v18 bonus lesson: Fees and leverage (fly to the bonus dome, enter, fly all 6 right gates).
await tap("button", "Back to colony map");
await page.waitForTimeout(600);
// v18.2: open the full-screen Map, check it, then "Fly to Fees and leverage (bonus)".
res.flyLog = [];
res.mapScreen = {};
await measure("map-small", [["mapBtn", ".map-open-btn", "^Map"], ["minimap", ".minimap-hud-canvas", ""], ["dockBuy", ".live-trade-dock button", "Buy"]]);
await shot("map-main-view");
const mapBtn = page.locator(".map-open-btn").first();
if (await mapBtn.count()) { const mb = await mapBtn.boundingBox(); await page.touchscreen.tap(mb.x + mb.width / 2, mb.y + mb.height / 2); }
await page.waitForTimeout(500);
res.mapScreen = await page.evaluate(() => {
  const f = document.querySelector(".full-map-screen"); if (!f) return { open: false };
  const r = f.getBoundingClientRect(); const c = document.querySelector(".full-map-close")?.getBoundingClientRect();
  const bonus = [...document.querySelectorAll(".full-map-dome")].find((b) => /Fees and leverage/.test(b.textContent));
  const br = bonus?.getBoundingClientRect();
  return { open: true, w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight,
    close: c && { y: Math.round(c.top), h: Math.round(c.height), visible: c.top >= 0 && c.bottom <= innerHeight },
    bonusBtn: bonus?.textContent, bonusInView: !!br && br.top >= 0 && br.bottom <= innerHeight,
    domes: [...document.querySelectorAll(".full-map-dome")].map((b) => b.textContent) };
});
await shot("full-map");
const bonusBtn = page.locator(".full-map-dome").filter({ hasText: /Fees and leverage/ }).first();
if (await bonusBtn.count()) { await bonusBtn.scrollIntoViewIfNeeded(); const bb = await bonusBtn.boundingBox(); await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); }
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(300);
  const t = await page.evaluate(() => document.querySelector(".enter-prompt button")?.textContent || "");
  res.flyLog.push(t.slice(0, 40));
  if (/Fees and leverage/.test(t)) break;
}
res.mapScreen.closedAfterFly = !(await page.locator(".full-map-screen").count());
await shot("bonus-enter-bar");
await measure("map-bonus-enter", [["enter", ".enter-prompt button", "^Enter"], ["buy", "button", "^Buy XOE"]]);
await tap(".enter-prompt button", "^Enter");
await page.waitForTimeout(600);
res.bonusPhase = await phase();
res.bonusTitle = await page.evaluate(() => document.querySelector("#scene h1")?.textContent || "");
await measure("bonus-lesson", [["edu", ".edu-label", ""], ["gate", ".arcade-gate-node", ""], ["preview", ".leverage-preview summary", ""]]);
res.bonusSteps = [];
const RIGHT = ["To open AND to close", "About 0.24%", "About 10%, up or down", "About 20%", "Wipe-out is further away", "Safer, not easier"];
const h1 = () => page.evaluate(() => document.querySelector("#scene h1")?.textContent || "");
for (let i = 0; i < 6; i++) {
  const before = await h1();
  res.bonusSteps.push(before);
  if (i === 0) await measure("bonus-step-1", [["gate", ".arcade-gate-node", ""], ["field", ".arcade-field", ""], ["question", ".lesson-question", ""], ["back", "button", "Back to colony map"]]);
  const gate = page.locator(".arcade-gate-node").filter({ hasText: RIGHT[i] }).first();
  const b = await gate.boundingBox();
  if (b && b.y >= 0 && b.y + b.height <= 659) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  else { res.forced.push(`gate ${RIGHT[i]} @${b ? Math.round(b.y) : "?"}`); await gate.evaluate((n) => n.click()); }
  // first tap flies XO into the gate's lane; once there the gate is enabled and a tap flies through it
  for (let t = 0; t < 40; t++) {
    await page.waitForTimeout(200);
    if ((await h1()) !== before || (await phase()) !== "colony-lesson") break;
    if (t % 5 === 4 && !(await gate.isDisabled().catch(() => true))) {
      const g = await gate.boundingBox().catch(() => null);
      if (g) await page.touchscreen.tap(g.x + g.width / 2, g.y + g.height / 2);
    }
  }
  if (i === 0) await shot("bonus-fly-1");
  if ((await phase()) !== "colony-lesson") break;
}
res.bonusDonePhase = await phase();
res.bonusFeedback = await page.evaluate(() => [...document.querySelectorAll("#scene [role=status]")].map((e) => e.textContent));
await shot("bonus-done");
} catch (e) { res.fatal = String(e).slice(0, 300); }
fs.writeFileSync(OUTJSON, JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 1).slice(0, 6000));
await browser.close();
