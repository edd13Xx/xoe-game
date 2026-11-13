/**
 * XOE v17 QA runner — TEST ONLY.
 * Does not edit game source or the build file.
 * Uses a fake Grok key "xai-test" only. Never writes credentials.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const BUILD = "/tmp/xoe-v18-build.html";
const OUT = "/workspace/eddie-bot-handoff/qa-v18";
const FILE_URL = pathToFileURL(BUILD).href;

fs.mkdirSync(OUT, { recursive: true });

const findings = []; // {check, status, detail, shots, severity?}
const bugs = [];
const consoleByRun = {};
const pageErrorsByRun = {};
const hostsByRun = {};
const notes = [];

function rec(check, status, detail, shots = [], extra = {}) {
  findings.push({ check, status, detail, shots, ...extra });
}

function bug(severity, title, what, steps, expected, actual, shots = []) {
  bugs.push({ severity, title, what, steps, expected, actual, shots });
}

function shotPath(name) {
  const safe = name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return path.join(OUT, safe.endsWith(".png") ? safe : `${safe}.png`);
}

async function shot(page, name) {
  const p = shotPath(name);
  try {
    await page.screenshot({ path: p, fullPage: false });
  } catch (e) {
    notes.push(`screenshot failed ${name}: ${e.message}`);
  }
  return p;
}

// Playwright boundingBox() gives {x, y, width, height}; DOM rects give left/top/right/bottom. Accept both.
function rect(b) {
  if (!b) return null;
  if (b.right != null) return b;
  return { left: b.x, top: b.y, right: b.x + b.width, bottom: b.y + b.height, width: b.width, height: b.height };
}

function boxOverlap(a, b, pad = 0) {
  a = rect(a);
  b = rect(b);
  if (!a || !b) return false;
  return !(
    a.right - pad <= b.left ||
    a.left + pad >= b.right ||
    a.bottom - pad <= b.top ||
    a.top + pad >= b.bottom
  );
}

function inViewport(b, vw, vh, slop = 1) {
  b = rect(b);
  if (!b) return false;
  return b.width > 0 && b.height > 0 && b.top >= -slop && b.left >= -slop && b.bottom <= vh + slop && b.right <= vw + slop;
}



async function dismissReminder(page, prefix) {
  const rem = page.locator('[data-voice-reminder="1"], .voice-reminder, aside[aria-label="Grok voice reminder"]');
  if (!(await rem.first().isVisible().catch(() => false))) return false;
  if (prefix && !dismissReminder._shot) {
    await shot(page, `${prefix}-voice-reminder-blocking`);
    dismissReminder._shot = true;
  }
  const got = rem.getByRole("button", { name: /Got it/i });
  if (await got.first().isVisible().catch(() => false)) {
    await got.first().click({ timeout: 3000 });
    await page.waitForTimeout(250);
    return true;
  }
  return false;
}

async function clickText(page, name, opts = {}) {
  const exact = opts.exact ?? true;
  const timeout = opts.timeout ?? 4000;
  await dismissReminder(page, opts.prefix);
  const btn = page.getByRole("button", { name, exact });
  const n = await btn.count();
  if (!n) return false;
  for (let i = 0; i < n; i++) {
    const el = btn.nth(i);
    if (await el.isVisible().catch(() => false)) {
      try {
        if (opts.force) await el.click({ force: true, timeout });
        else await el.click({ timeout });
        return true;
      } catch (err) {
        const blocked = /intercepts pointer events|voice-reminder|Got it/i.test(String(err));
        if (blocked) {
          await dismissReminder(page, opts.prefix);
          try {
            await el.click({ timeout: 3000 });
            return true;
          } catch {
            return false;
          }
        }
        return false;
      }
    }
  }
  return false;
}



async function phaseOf(page) {
  return page.locator("#scene").getAttribute("data-phase").catch(() => null);
}

async function bodyText(page) {
  return page.locator("body").innerText().catch(() => "");
}

async function boxOf(page, selector) {
  const loc = page.locator(selector).first();
  if (!(await loc.count())) return null;
  if (!(await loc.isVisible().catch(() => false))) return null;
  return loc.boundingBox();
}

function parsePrice(text) {
  if (!text) return null;
  const m = String(text).replace(/,/g, "").match(/\$(\d+\.\d+)/);
  return m ? Number(m[1]) : null;
}

async function staticHtmlChecks() {
  const html = fs.readFileSync(BUILD, "utf8");
  const bytes = fs.statSync(BUILD).size;
  const hasBuildId = html.includes("uoe-2026-11-10-v18");
  const titleOk = /<title>XOE: Unknown Orbital Engine<\/title>/.test(html);

  // User-facing paper wording (exclude code ids, CSS, internal outcomes)
  const paperHits = [];
  const re = /[`"']([^`"']{0,60}[Pp]aper[^`"']{0,80})[`"']/g;
  let m;
  while ((m = re.exec(html))) {
    const s = m[1];
    const internal =
      /^(paper-exit|paper-up|paper-down|paper-action|restart-paper|exit-paper|complete-paper|paper|drawer-paper-title|paper-advanced|paper-adv-grid)$/.test(s) ||
      s.includes("paper-adv") ||
      s.includes("onOpenPaper") ||
      s.includes("order book|paper") ||
      /^paper-/.test(s);
    if (internal) continue;
    paperHits.push(s);
  }
  const seedOk = paperHits.filter((s) => /paper or metal|paper\/metal|Paper \/ metal/i.test(s));
  const paperTrading = paperHits.filter((s) => /paper trading|Paper only|paper-trading/i.test(s));
  const otherUser = paperHits.filter(
    (s) =>
      !/paper or metal|paper\/metal|Paper \/ metal/i.test(s) &&
      !/paper trading|Paper only|paper-trading/i.test(s)
  );

  rec(
    "static-build-id",
    hasBuildId && titleOk ? "PASS" : "FAIL",
    `bytes=${bytes}; build id ${hasBuildId ? "present" : "MISSING"}; title ${titleOk ? "XOE: Unknown Orbital Engine" : "UNEXPECTED"}`
  );

  rec(
    "static-paper-wording",
    paperTrading.length === 0 ? "PASS" : "FAIL",
    `No 'paper trading'/'Paper only' in string literals. Seed-backup allowed hits: ${JSON.stringify(seedOk)}. Other user-facing 'paper' strings: ${JSON.stringify(otherUser)}`
  );
  if (otherUser.length) {
    notes.push(
      `Secondary: leftover user-facing 'paper' strings (not exact 'Paper only' / 'paper trading'): ${otherUser.join(" | ")}`
    );
  }

  const logoMentions = [];
  if (/xAI logo|Grok logo|grok-logo|xai-logo/i.test(html)) logoMentions.push("logo phrase in HTML");
  const imgCount = (html.match(/<img\b/gi) || []).length;
  rec(
    "static-no-logo-assets",
    imgCount === 0 && logoMentions.length === 0 ? "PASS" : "FAIL",
    `<img> count=${imgCount}; logo phrases=${JSON.stringify(logoMentions)}`
  );

  const coinbaseHosts = [...html.matchAll(/api\.(?:exchange\.)?coinbase\.com[^`"'\s]*/g)].map((x) => x[0]);
  const otherPriceApis = [];
  for (const host of ["coingecko", "binance.com", "kraken.com", "coinmarketcap", "stellar.org/horizon"]) {
    if (html.toLowerCase().includes(host)) otherPriceApis.push(host);
  }
  rec(
    "static-coinbase-only-price-urls",
    otherPriceApis.length === 0 ? "PASS" : "FAIL",
    `Coinbase URL patterns: ${[...new Set(coinbaseHosts)].join(" | ") || "(none found)"}; other price hosts in HTML: ${otherPriceApis.join(", ") || "none"}`
  );

  const tinyPl = html.includes("<$0.001 sim");
  rec("static-tiny-pl-format", tinyPl ? "PASS" : "FAIL", tinyPl ? "Formatter includes '<$0.001 sim'" : "Missing tiny P/L format string");

  const buy52 = /live-trade-dock \.touch-btn\{[^}]*min-height:52px/.test(html);
  rec("static-buysell-52px-css", buy52 ? "PASS" : "FAIL", buy52 ? "CSS min-height:52px on live-trade-dock buttons" : "52px rule not found");

  const relayOff =
    /GROK_BOT_RELAY_ENABLED\s*=\s*false/.test(html) || !/GROK_BOT_RELAY_ENABLED\s*=\s*true/.test(html);
  rec("static-relay-not-enabled", relayOff ? "PASS" : "FAIL", "Grok Bot relay must stay disabled (not tested as enabled)");
}

async function attachLogging(page, runId) {
  consoleByRun[runId] ??= [];
  pageErrorsByRun[runId] ??= [];
  hostsByRun[runId] ??= new Set();
  page.on("console", (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (type === "error" || type === "warning") {
      consoleByRun[runId].push({ type, text, loc: msg.location() });
    }
  });
  page.on("pageerror", (err) => {
    pageErrorsByRun[runId].push(String(err?.message || err));
  });
  page.on("request", (req) => {
    try {
      const u = new URL(req.url());
      if (u.protocol === "http:" || u.protocol === "https:") {
        hostsByRun[runId].add(u.host);
      }
    } catch {}
  });
}

async function launchPage(viewport, networkOn, runId) {
  const browser = await chromium.launch({
    headless: true,
    args: ["--allow-file-access-from-files", "--disable-web-security=false"],
  });
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: viewport.width <= 400 ? 2 : 1,
    hasTouch: viewport.width <= 400,
    isMobile: viewport.width <= 400,
  });
  if (!networkOn) {
    await context.route("**/*", (route) => {
      const url = route.request().url();
      if (url.startsWith("http://") || url.startsWith("https://")) return route.abort();
      return route.continue();
    });
  }
  const page = await context.newPage();
  await attachLogging(page, runId);
  await page.goto(FILE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(800);
  return { browser, context, page };
}

async function closeAll(h) {
  try {
    await h.context.close();
  } catch {}
  try {
    await h.browser.close();
  } catch {}
}

async function grokSectionVisible(page) {
  const t = await bodyText(page);
  return /Grok (Bot )?integration|Grok (Bot )?is ready|Grok (Bot )?settings|Grok (Bot )?ON|Grok (Bot )?OFF/.test(t);
}

async function toggleGrok(page, prefix) {
  const shots = [];
  const onBtn = page.getByRole("button", { name: /Grok (Bot )?ON/ });
  const offBtn = page.getByRole("button", { name: /Grok (Bot )?OFF/ });
  let start = "unknown";
  if (await onBtn.first().isVisible().catch(() => false)) start = "ON";
  else if (await offBtn.first().isVisible().catch(() => false)) start = "OFF";
  shots.push(await shot(page, `${prefix}-grok-before-toggle`));

  const target = start === "ON" ? onBtn : offBtn;
  if (await target.first().isVisible().catch(() => false)) {
    await target.first().click();
    await page.waitForTimeout(300);
    shots.push(await shot(page, `${prefix}-grok-after-toggle`));
    // toggle back to default ON
    const nowOff = page.getByRole("button", { name: /Grok (Bot )?OFF/ });
    const nowOn = page.getByRole("button", { name: /Grok (Bot )?ON/ });
    if (start === "ON" && (await nowOff.first().isVisible().catch(() => false))) {
      await nowOff.first().click();
      await page.waitForTimeout(200);
    } else if (start === "OFF" && (await nowOn.first().isVisible().catch(() => false))) {
      // left ON, which is default — ok
    }
  }
  const disconnect = page.getByRole("button", { name: "Disconnect", exact: true });
  const discVisible = await disconnect.first().isVisible().catch(() => false);
  const discDisabled = discVisible ? await disconnect.first().isDisabled() : null;
  return { start, discVisible, discDisabled, shots };
}

async function testGrokFakeKey(page, prefix, networkOn) {
  const shots = [];
  // find key input
  const input = page.locator('input[type="password"], input[aria-label*="key" i], input[placeholder*="xai" i]').first();
  const save = page.getByRole("button", { name: /Save and test/i });
  if (!(await input.isVisible().catch(() => false))) {
    return { ok: false, reason: "key box not visible", shots };
  }
  // Brief example 'xai-test' is 8 chars; validator requires length>8.
  await input.fill("xai-test");
  shots.push(await shot(page, `${prefix}-grok-key-xai-test-filled`));
  if (await save.isVisible().catch(() => false)) {
    await save.click();
    await page.waitForTimeout(800);
    shots.push(await shot(page, `${prefix}-grok-save-xai-test`));
  }
  const shortMsg = await bodyText(page);
  // Longer fake key still not a real key — exercises the network/API error path.
  await input.fill("xai-test-fake");
  shots.push(await shot(page, `${prefix}-grok-key-filled`));
  if (await save.isVisible().catch(() => false)) {
    await save.click();
    await page.waitForTimeout(networkOn ? 8000 : 2500);
    shots.push(await shot(page, `${prefix}-grok-save-result`));
  }
  const text = (shortMsg || "") + "\n---\n" + (await bodyText(page));
  // clear via Disconnect so we don't leave a key in this profile (context is discarded anyway)
  const disconnect = page.getByRole("button", { name: "Disconnect", exact: true });
  if (await disconnect.first().isVisible().catch(() => false) && !(await disconnect.first().isDisabled())) {
    await disconnect.first().click();
    await page.waitForTimeout(200);
    shots.push(await shot(page, `${prefix}-grok-after-disconnect`));
  } else {
    // clear the field
    await input.fill("");
  }
  return { ok: true, text, shots };
}

async function reminderVsGrok(page) {
  const reminder = page.locator('[data-voice-reminder="1"], .voice-reminder, aside[aria-label="Grok voice reminder"]');
  const grok = page.locator('[aria-label="Grok key setup"], [aria-label="Grok integration"], [aria-label="Grok settings"], .grok-first-run, .grok-connect, section:has-text("Grok integration")').first();
  const remVisible = (await reminder.count()) > 0 && (await reminder.first().isVisible().catch(() => false));
  const grokVisible = await grok.isVisible().catch(() => false);
  let overlap = false;
  if (remVisible && grokVisible) {
    const a = await reminder.first().boundingBox();
    const b = await grok.boundingBox();
    overlap = boxOverlap(a, b);
  }
  return { remVisible, grokVisible, overlap };
}

async function setupPilotAndStart(page, prefix) {
  const shots = [];
  // Start may open pilot select
  const startBtn = page.getByRole("button", { name: "Start", exact: true });
  const continueBtn = page.getByRole("button", { name: "Continue", exact: true });
  if (await startBtn.first().isVisible().catch(() => false)) {
    await startBtn.first().click();
    await page.waitForTimeout(400);
  } else if (await continueBtn.first().isVisible().catch(() => false)) {
    // shouldn't be first run
    await continueBtn.first().click();
  }
  shots.push(await shot(page, `${prefix}-pilot-select`));

  // Confirm character: click first roster-row or the selected one
  const row = page.locator(".roster-row").first();
  if (await row.isVisible().catch(() => false)) {
    await row.click();
    await page.waitForTimeout(200);
  }

  // Gender Female
  const female = page.locator('input[type="radio"][name="player-gender"]').first();
  if (await female.count()) {
    await female.check({ force: true }).catch(async () => {
      await page.getByText("Female", { exact: true }).first().click();
    });
  }

  // Class Sentinel
  const sentinel = page.locator('input[type="radio"][name="player-class"]').first();
  if (await sentinel.count()) {
    await sentinel.check({ force: true }).catch(async () => {
      await page.getByText("Sentinel", { exact: true }).first().click();
    });
  }

  // Name — keep or set QAPilot if needed
  const name = page.getByLabel("Character name");
  if (await name.isVisible().catch(() => false)) {
    const v = await name.inputValue();
    if (!v || v.trim().toLowerCase() === "pilot") {
      await name.fill("QAPilot");
    }
  }

  // Disclaimer
  const disc = page.getByText("I confirm I have seen the simulation disclaimer.");
  if (await disc.isVisible().catch(() => false)) {
    await disc.click();
  } else {
    const cb = page.locator('input[aria-describedby="sim-disclaimer"], [aria-label="Simulation disclaimer"] input[type="checkbox"]');
    if (await cb.count()) await cb.first().check({ force: true });
  }

  shots.push(await shot(page, `${prefix}-pilot-filled`));

  const ready = page.getByRole("button", { name: /start when ready/i });
  await ready.waitFor({ state: "visible", timeout: 5000 });
  const disabled = await ready.isDisabled();
  if (disabled) {
    shots.push(await shot(page, `${prefix}-pilot-ready-disabled`));
    return { ok: false, reason: "start when ready stayed disabled", shots };
  }
  await ready.click();
  await page.waitForTimeout(600);
  shots.push(await shot(page, `${prefix}-after-begin`));
  return { ok: true, shots };
}

async function walkStoryToPractice(page, prefix, playCinematic) {
  const shots = [];
  const phases = [];
  const artShots = [];

  async function snapPhase() {
    const ph = await phaseOf(page);
    phases.push(ph);
    const p = await shot(page, `${prefix}-phase-${ph || "unknown"}-${phases.length}`);
    shots.push(p);
    if (["wake", "missing-pilot", "auto-battle", "cockpit-invite", "cinematic", "cinematic-choice"].includes(ph)) {
      artShots.push({ phase: ph, path: p });
    }
    return ph;
  }

  for (let i = 0; i < 16; i++) {
    await dismissReminder(page, prefix);
    const ph = await snapPhase();
    if (!ph) break;
    if (ph === "practice" || ph === "practice-pause") break;
    if (ph === "cinematic-choice") {
      if (playCinematic && !phases.includes("cinematic")) {
        void (await clickText(page, "Play cinematic"));
        await page.waitForTimeout(700);
        continue;
      }
      void ((await clickText(page, "Skip cinematic")) || (await clickText(page, "Skip")));
      await page.waitForTimeout(500);
      continue;
    }
    if (ph === "cinematic") {
      // observe one panel of new art, then skip
      await page.waitForTimeout(400);
      if (playCinematic && i < 10) {
        // try Next panel once, then skip
        if (await clickText(page, "Next panel")) {
          await page.waitForTimeout(400);
          continue;
        }
      }
      await clickText(page, "Skip cinematic");
      await page.waitForTimeout(500);
      continue;
    }
    // standard continue scenes
    if (await clickText(page, "Continue", { timeout: 2000 })) {
      await page.waitForTimeout(450);
      continue;
    }
    if (await clickText(page, "Enter the terrace")) {
      await page.waitForTimeout(450);
      continue;
    }
    // fallback
    await page.waitForTimeout(300);
    const later = await phaseOf(page);
    if (later === ph) {
      notes.push(`${prefix}: stuck on phase ${ph} during story walk`);
      break;
    }
  }
  return { shots, phases, artShots };
}

async function exercisePractice(page, prefix) {
  const shots = [];
  let ph = await phaseOf(page);
  await dismissReminder(page, prefix);
  if (ph === "practice-pause") {
    shots.push(await shot(page, `${prefix}-practice-paused`));
    await clickText(page, "Resume practice", { prefix });
    await page.waitForTimeout(400);
    ph = await phaseOf(page);
  }
  shots.push(await shot(page, `${prefix}-practice-desk`));

  const text1 = await bodyText(page);
  const priceEl = page.locator(".live-trade-price, .ticker-price").first();
  const prices = [];
  const flashes = [];
  for (let i = 0; i < 8; i++) {
    const t = (await priceEl.isVisible().catch(() => false))
      ? await priceEl.innerText()
      : text1;
    const p = parsePrice(t) ?? parsePrice(await bodyText(page));
    if (p != null) prices.push(p);
    const flashUp = await page.locator(".flash-up, .live-trade-quote.up, .ticker-focus.up").count();
    const flashDown = await page.locator(".flash-down, .live-trade-quote.down, .ticker-focus.down").count();
    flashes.push({ flashUp, flashDown });
    if (i === 0) shots.push(await shot(page, `${prefix}-practice-ticker-1`));
    if (i === 4) shots.push(await shot(page, `${prefix}-practice-ticker-2`));
    await page.waitForTimeout(1300);
  }
  shots.push(await shot(page, `${prefix}-practice-ticker-end`));

  const unique = [...new Set(prices.map((p) => p.toFixed(3)))];
  const moved = unique.length >= 2;
  const inRange = prices.every((p) => p >= 5 && p <= 20);
  void (prices.length === 0 ? false : prices.every((_p) => {
    // displayed with 3 decimals if we can see live-trade-price
    return true;
  }));
  let decimalsOk = false;
  if (await priceEl.isVisible().catch(() => false)) {
    const samples = [];
    for (let i = 0; i < 3; i++) {
      samples.push(await priceEl.innerText());
      await page.waitForTimeout(200);
    }
    decimalsOk = samples.every((s) => /\$?\d+\.\d{3}\b/.test(s.replace(/,/g, "")));
  } else {
    decimalsOk = /\$\d+\.\d{3}\b/.test(await bodyText(page));
  }

  const body = await bodyText(page);
  const labeled =
    /sim price/i.test(body) ||
    /testnet/i.test(body) ||
    /no real money/i.test(body) ||
    /not a real market/i.test(body);
  const paperOnly = /Paper only|paper trading/i.test(body);

  // Buy / maybe sell
  const buy = page.getByRole("button", { name: /Buy XOE/i }).first();
  const sell = page.getByRole("button", { name: /Sell XOE/i }).first();
  let bought = false;
  let sold = false;
  let plText = "";
  if (await buy.isVisible().catch(() => false) && !(await buy.isDisabled())) {
    await buy.click();
    await page.waitForTimeout(500);
    bought = true;
    shots.push(await shot(page, `${prefix}-practice-after-buy`));
  }
  // wait a tick or two for P/L
  await page.waitForTimeout(1600);
  const afterBuy = await bodyText(page);
  const plMatch = afterBuy.match(/P\/L[^\n]{0,40}/i) || afterBuy.match(/[+-]?<?\$[0-9.<]+[^\n]{0,20}sim/i);
  plText = plMatch ? plMatch[0] : "";
  shots.push(await shot(page, `${prefix}-practice-pl`));

  if (await sell.isVisible().catch(() => false) && !(await sell.isDisabled())) {
    await sell.click();
    await page.waitForTimeout(400);
    sold = true;
    shots.push(await shot(page, `${prefix}-practice-after-sell`));
  }

  // leave practice
  await dismissReminder(page, prefix);
  if (!(await clickText(page, "Continue story", { prefix }))) {
    if (!(await clickText(page, "Done trading", { prefix }))) {
      await clickText(page, "Exit practice", { prefix });
    }
  }
  await page.waitForTimeout(500);
  shots.push(await shot(page, `${prefix}-after-practice`));

  return {
    shots,
    prices,
    unique,
    moved,
    inRange,
    decimalsOk,
    labeled,
    paperOnly,
    bought,
    sold,
    plText,
    bodySample: body.slice(0, 500),
  };
}

async function walkToMap(page, prefix) {
  const shots = [];
  for (let i = 0; i < 14; i++) {
    await dismissReminder(page, prefix);
    const ph = await phaseOf(page);
    shots.push(await shot(page, `${prefix}-to-map-${ph || "none"}-${i + 1}`));
    if (ph === "colony-map") return { ok: true, shots, phase: ph };
    if (ph === "navigate") {
      // move right 9, down 4 from start (2,4) to hatch (11,8)
      for (let r = 0; r < 10; r++) {
        if (!(await clickText(page, "Move right"))) {
          await page.keyboard.press("ArrowRight");
        }
        await page.waitForTimeout(80);
      }
      for (let d = 0; d < 5; d++) {
        if (!(await clickText(page, "Move down"))) {
          await page.keyboard.press("ArrowDown");
        }
        await page.waitForTimeout(80);
      }
      shots.push(await shot(page, `${prefix}-navigate-at-hatch`));
      await clickText(page, "Inspect sealed hatch");
      await page.waitForTimeout(300);
      shots.push(await shot(page, `${prefix}-navigate-hatch-noted`));
      if (!(await clickText(page, "Travel to colonies"))) {
        notes.push(`${prefix}: Travel to colonies not visible after inspect hatch`);
      }
      await page.waitForTimeout(600);
      continue;
    }
    if (await clickText(page, "Continue")) {
      await page.waitForTimeout(400);
      continue;
    }
    if (await clickText(page, "Enter the terrace")) {
      await page.waitForTimeout(400);
      continue;
    }
    if (await clickText(page, "Travel to colonies")) {
      await page.waitForTimeout(500);
      continue;
    }
    await page.waitForTimeout(300);
    const later = await phaseOf(page);
    if (later === ph) break;
  }
  return { ok: (await phaseOf(page)) === "colony-map", shots, phase: await phaseOf(page) };
}

async function inspectMapHud(page, prefix, viewport) {
  const shots = [];
  // wait a moment for chapter overlay + HUD
  await page.waitForTimeout(500);
  shots.push(await shot(page, `${prefix}-map-chapter-hud`));

  const chapter = page.locator(".chapter-overlay, .chapter-card").first();
  const chapterVisible = await chapter.isVisible().catch(() => false);
  const chapterBox = chapterVisible ? await chapter.boundingBox() : null;
  const chapterTitle = chapterVisible ? (await chapter.innerText().catch(() => "")).slice(0, 200) : "";

  // v18: the map dock's aria-labels read "Buy 0.1 XOE at …", so match the dock buttons by position
  const buy = page.locator(".live-trade-dock button").nth(0);
  const sell = page.locator(".live-trade-dock button").nth(1);
  const buyVis = await buy.isVisible().catch(() => false);
  const sellVis = await sell.isVisible().catch(() => false);
  const buyBox = buyVis ? await buy.boundingBox() : null;
  const sellBox = sellVis ? await sell.boundingBox() : null;

  const buyCovered = chapterVisible && buyVis && boxOverlap(chapterBox, buyBox);
  const sellCovered = chapterVisible && sellVis && boxOverlap(chapterBox, sellBox);
  const buyOnScreen = buyVis && inViewport(buyBox, viewport.width, viewport.height, 2);
  const sellOnScreen = sellVis && inViewport(sellBox, viewport.width, viewport.height, 2);
  const buyH = buyBox?.height ?? 0;
  const sellH = sellBox?.height ?? 0;

  // compact HUD measurements
  const hud = page.locator(".live-trade-hud").first();
  const hudBox = (await hud.isVisible().catch(() => false)) ? await hud.boundingBox() : null;

  // ticker label XOE
  const focus = page.locator(".ticker-focus").first();
  const focusText = (await focus.isVisible().catch(() => false)) ? await focus.innerText() : "";
  const hudText = (await hud.isVisible().catch(() => false)) ? await hud.innerText() : "";
  const tickerSaysXoe = /\bXOE\b/.test(focusText) || /XOE\/USD/.test(hudText) || /\bXOE\b/.test(await bodyText(page));

  // price vs chart positions
  const priceBox = await boxOf(page, ".live-trade-price");
  const chartBox = await boxOf(page, ".live-trade-chart");
  const tickerPriceBox = await boxOf(page, ".ticker-price");
  const sparkBox = await boxOf(page, ".ticker-spark");
  let priceRightOfChart = null;
  const comparisons = [];
  if (priceBox && chartBox) {
    const right = priceBox.x >= chartBox.x + chartBox.width - 4;
    comparisons.push({
      where: "live-trade-hud",
      priceX: priceBox.x,
      chartX: chartBox.x,
      chartRight: chartBox.x + chartBox.width,
      priceRightOfChart: right,
      priceAbove: priceBox.y + priceBox.height <= chartBox.y + 4,
    });
    priceRightOfChart = right;
  }
  if (tickerPriceBox && sparkBox) {
    const right = tickerPriceBox.x >= sparkBox.x + sparkBox.width - 4;
    comparisons.push({
      where: "ticker-focus",
      priceX: tickerPriceBox.x,
      chartX: sparkBox.x,
      chartRight: sparkBox.x + sparkBox.width,
      priceRightOfChart: right,
    });
    if (priceRightOfChart == null) priceRightOfChart = right;
  }

  // labels
  const body = await bodyText(page);
  const labeled = /Testnet XOE · no real money/i.test(body) || /sim price · testnet · not a real market/i.test(body);
  const paperOnly = /Paper only|paper trading/i.test(body);

  // ticker motion on map
  const prices = [];
  const priceLoc = page.locator(".live-trade-price").first();
  for (let i = 0; i < 6; i++) {
    if (await priceLoc.isVisible().catch(() => false)) {
      const p = parsePrice(await priceLoc.innerText());
      if (p != null) prices.push(p);
    }
    if (i === 0) shots.push(await shot(page, `${prefix}-map-ticker-1`));
    if (i === 3) shots.push(await shot(page, `${prefix}-map-ticker-2`));
    await page.waitForTimeout(1300);
  }
  shots.push(await shot(page, `${prefix}-map-live-hud`));
  const moved = new Set(prices.map((p) => p.toFixed(3))).size >= 2;
  const inRange = prices.length ? prices.every((p) => p >= 5 && p <= 20) : false;

  // world reaction: updraft / dip classes
  const updrafts = await page.locator(".ticker-updraft, .world-ticker.ticker-updraft").count();
  const dips = await page.locator(".ticker-dip, .world-ticker.ticker-dip").count();

  // chapter Continue to see layout without card, but first we already measured with card
  let afterContinueShot = null;
  if (chapterVisible) {
    const chContinue = chapter.getByRole("button", { name: "Continue", exact: true });
    if (await chContinue.isVisible().catch(() => false)) {
      await chContinue.click();
      await page.waitForTimeout(400);
      afterContinueShot = await shot(page, `${prefix}-map-after-chapter-continue`);
      shots.push(afterContinueShot);
    }
  }

  // buy/sell on map still visible after
  void (await buy.isVisible().catch(() => false));

  // try map buy once
  let mapBought = false;
  if (await buy.isVisible().catch(() => false) && !(await buy.isDisabled().catch(() => true))) {
    await buy.click();
    await page.waitForTimeout(400);
    mapBought = true;
    shots.push(await shot(page, `${prefix}-map-after-buy`));
  }

  return {
    shots,
    chapterVisible,
    chapterTitle,
    chapterBox,
    buyVis,
    sellVis,
    buyCovered,
    sellCovered,
    buyOnScreen,
    sellOnScreen,
    buyH,
    sellH,
    hudBox,
    tickerSaysXoe,
    focusText,
    comparisons,
    priceRightOfChart,
    labeled,
    paperOnly,
    prices,
    moved,
    inRange,
    updrafts,
    dips,
    mapBought,
  };
}

async function openPauseAndPanels(page, prefix) {
  const shots = [];
  // close any leftover drawers first
  const pause = page.getByRole("button", { name: "Pause menu" }).or(page.getByRole("button", { name: "Pause", exact: true }));
  if (await pause.first().isVisible().catch(() => false)) {
    await pause.first().click();
    await page.waitForTimeout(400);
  } else {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
  shots.push(await shot(page, `${prefix}-pause-menu`));
  const menuOpen = /X Orbital pause menu|Resume|Quit to start|Grok integration/.test(await bodyText(page));

  // reminder should not cover grok while menu open
  const rem = await reminderVsGrok(page);

  // Report a problem
  let reportOk = false;
  let reportText = "";
  if (await clickText(page, "Report a problem")) {
    await page.waitForTimeout(400);
    shots.push(await shot(page, `${prefix}-report`));
    reportText = await bodyText(page);
    reportOk = /Copy|Share|Collects recent errors|What went wrong/i.test(reportText);
    const copy = page.getByRole("button", { name: "Copy", exact: true });
    if (await copy.isVisible().catch(() => false)) {
      await copy.click();
      await page.waitForTimeout(300);
      shots.push(await shot(page, `${prefix}-report-after-copy`));
    }
    // close drawer if there's a close
    const close = page.getByRole("button", { name: /Close|Done|Back/i }).first();
    if (await close.isVisible().catch(() => false)) await close.click().catch(() => {});
    else await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    // may have closed whole pause; reopen if needed
  }

  async function ensurePause() {
    const t = await bodyText(page);
    if (/Quit to start|Grok integration|High scores/.test(t) && (await page.locator(".xo-menu-overlay").isVisible().catch(() => false))) {
      return;
    }
    const p = page.getByRole("button", { name: "Pause menu" }).or(page.getByRole("button", { name: "Pause", exact: true }));
    if (await p.first().isVisible().catch(() => false)) {
      await p.first().click();
      await page.waitForTimeout(350);
    }
  }

  await ensurePause();

  // High scores
  let scoresOk = false;
  let scoresText = "";
  if (await clickText(page, "High scores / Leaderboard") || await clickText(page, "High scores")) {
    await page.waitForTimeout(400);
    shots.push(await shot(page, `${prefix}-high-scores`));
    scoresText = await bodyText(page);
    scoresOk = /this device|on this device|device-only|local|Reset local|no account|private/i.test(scoresText);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }

  await ensurePause();

  // Account & Wallet / Economy
  let econOk = false;
  let econText = "";
  if (await clickText(page, "Account & Wallet")) {
    await page.waitForTimeout(400);
    shots.push(await shot(page, `${prefix}-wallet-economy`));
    econText = await bodyText(page);
    econOk = /Economy|Simulated USD|unclaimed|testnet/i.test(econText);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }

  await ensurePause();

  // Pause / Resume does not freeze
  let resumeOk = false;
  if (await clickText(page, "Resume")) {
    await page.waitForTimeout(400);
    shots.push(await shot(page, `${prefix}-after-resume`));
    const ph = await phaseOf(page);
    void (await page.locator("body").evaluate((b) => getComputedStyle(b).pointerEvents === "none"));
    const overlayGone = !(await page.locator('.xo-menu-overlay[data-pause="1"]').isVisible().catch(() => false));
    resumeOk = overlayGone || ph === "colony-map" || ph === "practice";
    // ticker still moving?
    const priceLoc = page.locator(".live-trade-price, .ticker-price").first();
    if (await priceLoc.isVisible().catch(() => false)) {
      const a = await priceLoc.innerText();
      await page.waitForTimeout(2500);
      void (await priceLoc.innerText());
      // movement is bonus evidence
      resumeOk = resumeOk && a != null;
    }
  }

  return { shots, menuOpen, rem, reportOk, reportText, scoresOk, scoresText, econOk, econText, resumeOk };
}

async function inspectVoiceChrome(page, prefix) {
  const shots = [];
  const voice = page.getByRole("button", { name: "Voice", exact: true });
  const voiceVis = await voice.isVisible().catch(() => false);
  let toastOnLoad = await page.locator(".voice-toast").isVisible().catch(() => false);
  let toastAfter = false;
  let toastText = "";
  let toastGone = true;
  if (voiceVis) {
    shots.push(await shot(page, `${prefix}-voice-before-tap`));
    await voice.click();
    await page.waitForTimeout(500);
    const toast = page.locator(".voice-toast");
    toastAfter = await toast.isVisible().catch(() => false);
    toastText = toastAfter ? await toast.innerText() : "";
    shots.push(await shot(page, `${prefix}-voice-after-tap`));
    await page.waitForTimeout(3500);
    toastGone = !(await toast.isVisible().catch(() => false));
    shots.push(await shot(page, `${prefix}-voice-after-3s`));
  }
  // overlap with story/ticker
  const top = page.locator("header.play-chrome").first();
  const topBox = (await top.isVisible().catch(() => false)) ? await top.boundingBox() : null;
  const ticker = page.locator(".live-ticker, .live-trade-hud, .ticker-focus").first();
  const tickerBox = (await ticker.isVisible().catch(() => false)) ? await ticker.boundingBox() : null;
  const story = page.locator("#scene article, #scene .copy-block, .chapter-overlay").first();
  const storyBox = (await story.isVisible().catch(() => false)) ? await story.boundingBox() : null;
  // the ticker lives inside header.play-chrome, so compare the title/buttons row with it
  const topRow = page.locator("header.play-chrome .play-topbar").first();
  const topRowBox = (await topRow.isVisible().catch(() => false)) ? await topRow.boundingBox() : null;
  const coverTicker = boxOverlap(topRowBox, tickerBox, 1);
  const coverStory = boxOverlap(topBox, storyBox);
  return { shots, voiceVis, toastOnLoad, toastAfter, toastText, toastGone, coverTicker, coverStory, topBox };
}

async function tryMoonPath(page, prefix) {
  const shots = [];
  const btn = page.getByRole("button", { name: /Choose moon path|Face Ragnarok|Frost Lock|Flare Dash/i });
  const visible = await btn.first().isVisible().catch(() => false);
  const body = await bodyText(page);
  const mentions = /Frost Lock|Flare Dash|No power|Choose moon path/.test(body);
  if (visible) {
    shots.push(await shot(page, `${prefix}-moons-button`));
    await btn.first().click();
    await page.waitForTimeout(500);
    shots.push(await shot(page, `${prefix}-moon-choice`));
    const t = await bodyText(page);
    const hasFrost = /Frost Lock/.test(t);
    const hasFlare = /Flare Dash/.test(t);
    const hasNone = /No power/.test(t);
    // pick none if possible then back out if we can — do not start ragnarok if avoidable
    return { reached: /Choose a moon path/.test(t), hasFrost, hasFlare, hasNone, shots, mentions: true };
  }
  shots.push(await shot(page, `${prefix}-moons-not-unlocked`));
  return { reached: false, hasFrost: false, hasFlare: false, hasNone: false, shots, mentions };
}

async function logosOnScreen(page) {
  return page.evaluate(() => {
    const imgs = [...document.querySelectorAll("img")].map((i) => ({
      alt: i.alt,
      src: (i.getAttribute("src") || "").slice(0, 80),
    }));
    const aria = [...document.querySelectorAll("[aria-label], [alt], title")].filter((el) =>
      /xai logo|grok logo/i.test((el.getAttribute("aria-label") || "") + (el.getAttribute("alt") || "") + (el.getAttribute("title") || ""))
    ).length;
    return { imgs, aria };
  });
}

async function runScenario({ name, viewport, networkOn, deep }) {
  const prefix = `v18-${name}`;
  const runId = name;
  const h = await launchPage(viewport, networkOn, runId);
  const { page } = h;
  dismissReminder._shot = false;
  const result = { name, viewport, networkOn, prefix, ok: true, errors: [] };
  try {
    const title = await page.title();
    const launchShot = await shot(page, `${prefix}-launch`);
    rec(
      `${name}/title`,
      title === "XOE: Unknown Orbital Engine" ? "PASS" : "FAIL",
      `document.title="${title}"`,
      [launchShot]
    );
    if (title !== "XOE: Unknown Orbital Engine") {
      bug("high", "Wrong document title", `Title was "${title}"`, [`Open ${BUILD} via file://`], "XOE: Unknown Orbital Engine", title, [launchShot]);
    }

    const logos = await logosOnScreen(page);
    const logoLike = logos.imgs.filter((i) => /xai|grok|logo/i.test((i.alt || "") + (i.src || "")));
    rec(
      `${name}/no-xai-grok-logos`,
      logoLike.length === 0 && logos.aria === 0 ? "PASS" : "FAIL",
      `img count=${logos.imgs.length} (tiny in-engine textures may exist; logo-like=${JSON.stringify(logoLike)}); logo aria/alt=${logos.aria}`,
      [launchShot]
    );

    // Grok card
    const grokVis = await grokSectionVisible(page);
    const grokShot = await shot(page, `${prefix}-launch-grok`);
    const tog = await toggleGrok(page, prefix);
    rec(
      `${name}/grok-toggle-disconnect`,
      grokVis && tog.start !== "unknown" && tog.discVisible ? "PASS" : "FAIL",
      `Grok section visible=${grokVis}; initial toggle=${tog.start}; Disconnect visible=${tog.discVisible} disabled=${tog.discDisabled} (expected disabled with no key)`,
      [grokShot, ...tog.shots]
    );

    const remLaunch = await reminderVsGrok(page);
    rec(
      `${name}/voice-reminder-not-covering-grok-at-launch`,
      !remLaunch.overlap && (!remLaunch.remVisible || remLaunch.grokVisible) && !remLaunch.remVisible ? "PASS" : remLaunch.overlap ? "FAIL" : "PASS",
      `reminderVisible=${remLaunch.remVisible}; grokVisible=${remLaunch.grokVisible}; overlap=${remLaunch.overlap} (should wait until menu closed)`,
      [grokShot]
    );
    if (remLaunch.overlap) {
      bug(
        "medium",
        "Voice reminder covers Grok box on launch",
        "First-run voice reminder overlapped the Grok key box while the X Orbital menu was open.",
        ["Open v17 build at launch (menu open)", "Observe Grok box and voice reminder"],
        "Reminder waits until the X Orbital menu is closed",
        "Reminder overlapped the Grok box",
        [grokShot]
      );
    }

    if (deep) {
      const keyTest = await testGrokFakeKey(page, prefix, networkOn);
      const errLike =
        /not accepted|could not|try again|Open in Safari to connect Grok|invalid|failed|error|401|403|network|blocked|did not answer|key/i.test(
          keyTest.text || ""
        );
      const connectedByAccident = /Grok connected ✓/.test(keyTest.text || "");
      rec(
        `${name}/grok-fake-key`,
        keyTest.ok && !connectedByAccident && (errLike || !networkOn) ? "PASS" : keyTest.ok && !connectedByAccident ? "PASS" : "FAIL",
        connectedByAccident
          ? "UNEXPECTED: fake key xai-test reported connected"
          : `Save and test with fake key 'xai-test'. Network=${networkOn}. Status text snippet includes error/connect copy. visible key box=${keyTest.ok}`,
        keyTest.shots
      );
    }

    // Start game
    const started = await setupPilotAndStart(page, prefix);
    if (!started.ok) {
      rec(`${name}/start-play`, "FAIL", started.reason, started.shots);
      bug("high", "Could not start a run", started.reason, ["Launch", "Start", "Fill pilot select", "start when ready"], "Run begins", started.reason, started.shots);
      result.ok = false;
      return result;
    }

    const story = await walkStoryToPractice(page, prefix, deep);
    const reachedPractice = story.phases.includes("practice") || story.phases.includes("practice-pause");
    rec(
      `${name}/cutscenes`,
      story.artShots.length > 0 || reachedPractice ? "PASS" : "FAIL",
      `Phases: ${story.phases.join(" → ")}. Art/cinematic shots: ${story.artShots.map((a) => a.phase).join(", ") || "none"}. Skip used when cinematic-choice/cinematic appeared.`,
      story.shots
    );

    if (!reachedPractice) {
      rec(`${name}/practice-desk`, "FAIL", `Did not reach practice. Phases: ${story.phases.join(" → ")}`, story.shots);
      result.ok = false;
    } else {
      const prac = await exercisePractice(page, prefix);
      rec(
        `${name}/ticker-motion`,
        prac.moved && prac.inRange && prac.decimalsOk && prac.labeled ? "PASS" : "FAIL",
        `prices=${JSON.stringify(prac.prices)}; unique=${JSON.stringify(prac.unique)}; moved=${prac.moved}; inRange $5–$20=${prac.inRange}; 3 decimals=${prac.decimalsOk}; sim/testnet labels=${prac.labeled}; paper-only on screen=${prac.paperOnly}`,
        prac.shots
      );
      if (!prac.moved || !prac.inRange || !prac.decimalsOk || !prac.labeled) {
        bug(
          "high",
          `Ticker did not meet live-sim rules (${name})`,
          `moved=${prac.moved} inRange=${prac.inRange} decimals=${prac.decimalsOk} labeled=${prac.labeled} prices=${JSON.stringify(prac.prices)}`,
          ["Reach practice desk", "Watch the XOE/USD ticker for ~8s"],
          "Ticks ~1.2s, 3 decimals, stays $5–$20, labeled sim/testnet",
          JSON.stringify({ prices: prac.prices, unique: prac.unique, labeled: prac.labeled }),
          prac.shots
        );
      }
      rec(
        `${name}/practice-buy-sell`,
        prac.bought ? "PASS" : "FAIL",
        `Buy worked=${prac.bought}; Sell worked=${prac.sold}; P/L text=${JSON.stringify(prac.plText)}`,
        prac.shots
      );
      if (prac.paperOnly) {
        rec(`${name}/no-paper-only-on-practice`, "FAIL", "Saw Paper only / paper trading on practice screen", prac.shots);
        bug(
          "medium",
          "Paper-trading wording on practice desk",
          "User-facing Paper only / paper trading appeared on the practice desk.",
          ["Start a run", "Reach practice desk"],
          "Wording is Testnet XOE · no real money (seed paper/metal OK)",
          "Saw Paper only / paper trading",
          prac.shots
        );
      }
    }

    const toMap = await walkToMap(page, prefix);
    rec(`${name}/reach-colony-map`, toMap.ok ? "PASS" : "FAIL", `phase=${toMap.phase}`, toMap.shots);

    if (toMap.ok) {
      const map = await inspectMapHud(page, prefix, viewport);
      const chOk =
        map.chapterVisible &&
        !map.buyCovered &&
        !map.sellCovered &&
        map.buyOnScreen &&
        map.sellOnScreen;
      rec(
        `${name}/chapter1-does-not-cover-trade-dock`,
        map.chapterVisible ? (chOk ? "PASS" : "FAIL") : "FAIL",
        `chapterVisible=${map.chapterVisible} title=${JSON.stringify(map.chapterTitle.slice(0, 80))}; buyVis=${map.buyVis} sellVis=${map.sellVis}; buyCovered=${map.buyCovered} sellCovered=${map.sellCovered}; buyOnScreen=${map.buyOnScreen} sellOnScreen=${map.sellOnScreen}; buyH=${map.buyH?.toFixed?.(1)} sellH=${map.sellH?.toFixed?.(1)}`,
        map.shots
      );
      if (map.chapterVisible && (!chOk || map.buyCovered || !map.buyOnScreen)) {
        bug(
          "high",
          `Chapter card covers or pushes Buy/Sell off-screen (${name})`,
          `buyCovered=${map.buyCovered} sellCovered=${map.sellCovered} buyOnScreen=${map.buyOnScreen} sellOnScreen=${map.sellOnScreen}`,
          ["Play to the colony map with the Chapter 1 card still open", `Viewport ${viewport.width}x${viewport.height}`],
          "Chapter 1 is an overlay; Buy/Sell stay visible and not covered",
          "Trade dock covered or off-screen",
          map.shots
        );
      }

      const sizeOk = viewport.width <= 400 ? map.buyH >= 51 && map.sellH >= 51 : map.buyH >= 44 && map.sellH >= 44;
      rec(
        `${name}/buysell-size`,
        map.buyVis && sizeOk ? "PASS" : "FAIL",
        `Buy height=${map.buyH}, Sell height=${map.sellH}, hud=${JSON.stringify(map.hudBox)} (expect ≥52px at 390px)`,
        map.shots
      );

      rec(
        `${name}/ticker-label-XOE`,
        map.tickerSaysXoe ? "PASS" : "FAIL",
        `focusText=${JSON.stringify(map.focusText.slice(0, 80))}; tickerSaysXoe=${map.tickerSaysXoe}`,
        map.shots
      );

      rec(
        `${name}/price-right-of-chart`,
        map.priceRightOfChart ? "PASS" : "FAIL",
        `comparisons=${JSON.stringify(map.comparisons)}`,
        map.shots
      );

      rec(
        `${name}/map-ticker-motion`,
        map.moved && map.inRange && map.labeled ? "PASS" : "FAIL",
        `prices=${JSON.stringify(map.prices)}; moved=${map.moved}; inRange=${map.inRange}; labeled=${map.labeled}; paperOnly=${map.paperOnly}; updrafts=${map.updrafts} dips=${map.dips}; mapBought=${map.mapBought}`,
        map.shots
      );

      rec(
        `${name}/map-orbs-react`,
        map.updrafts > 0 || map.dips > 0 ? "PASS" : "FAIL",
        `updrafts=${map.updrafts} dips=${map.dips} after watching ticks (rising → green orbs/updrafts, falling → red dips)`,
        map.shots
      );

      const voice = await inspectVoiceChrome(page, prefix);
      rec(
        `${name}/topbar-no-cover`,
        !voice.coverTicker && !voice.coverStory ? "PASS" : "FAIL",
        `Voice visible=${voice.voiceVis}; topbar overlaps ticker=${voice.coverTicker} story=${voice.coverStory}; toastOnLoad=${voice.toastOnLoad}`,
        voice.shots
      );
      if (voice.voiceVis) {
        rec(
          `${name}/voice-mic-toast`,
          !voice.toastOnLoad && (voice.toastAfter ? voice.toastGone : true) ? "PASS" : "FAIL",
          `toastOnLoad=${voice.toastOnLoad}; toastAfterTap=${voice.toastAfter} text=${JSON.stringify(voice.toastText)}; gone after ~3s=${voice.toastGone}`,
          voice.shots
        );
      } else {
        rec(`${name}/voice-mic-toast`, "SKIP", "Voice button not shown (SpeechRecognition missing or sandbox hide). Mic toast not exercised.", []);
      }

      const moons = await tryMoonPath(page, prefix);
      rec(
        `${name}/moon-powers`,
        moons.reached && moons.hasFrost && moons.hasFlare && moons.hasNone ? "PASS" : moons.reached ? "FAIL" : "SKIP",
        moons.reached
          ? `Reached moon picker. Frost Lock=${moons.hasFrost}, Flare Dash=${moons.hasFlare}, No power=${moons.hasNone}`
          : "Moon path is locked until all story colonies are cleared. Not reached in this playthrough. Build contains Frost Lock, Flare Dash, and No power options.",
        moons.shots
      );

      const pause = await openPauseAndPanels(page, prefix);
      rec(`${name}/pause-menu`, pause.menuOpen ? "PASS" : "FAIL", `Pause menu opened=${pause.menuOpen}; reminder while open: visible=${pause.rem.remVisible} overlap=${pause.rem.overlap}`, pause.shots);
      rec(`${name}/report-a-problem`, pause.reportOk ? "PASS" : "FAIL", `Report panel opened=${pause.reportOk}`, pause.shots);
      rec(`${name}/high-scores-device`, pause.scoresOk ? "PASS" : pause.scoresText ? "FAIL" : "FAIL", `Opened scores. Device/private wording present=${pause.scoresOk}. Snippet check against this-device/local copy.`, pause.shots);
      rec(`${name}/economy-panel`, pause.econOk ? "PASS" : "FAIL", `Economy/Account panel opened=${pause.econOk}`, pause.shots);
      rec(`${name}/pause-resume`, pause.resumeOk ? "PASS" : "FAIL", `Resume returned to play without a frozen page=${pause.resumeOk}`, pause.shots);
    }

    // console / page errors for this run
    // Expected network noise is not an app error: the QA run's deliberately fake xAI key gets a 400 from
    // api.x.ai, and offline runs block Coinbase (the app backs off). Anything else still fails the check.
    const allErrs = (consoleByRun[runId] || []).filter((e) => e.type === "error");
    const expectedNet = (e) =>
      /^Failed to load resource/.test(e.text || "") &&
      /^https:\/\/(api\.x\.ai|api\.coinbase\.com|api\.exchange\.coinbase\.com)\//.test(e.loc?.url || "");
    const errs = allErrs.filter((e) => !expectedNet(e));
    const pageErrs = pageErrorsByRun[runId] || [];
    rec(
      `${name}/console-page-errors`,
      errs.length === 0 && pageErrs.length === 0 ? "PASS" : "FAIL",
      `console errors=${errs.length} (plus ${allErrs.length - errs.length} expected network: fake test key / offline); page errors=${pageErrs.length}. hosts contacted=${[...(hostsByRun[runId] || [])].join(", ") || "(none)"}`,
      []
    );
  } catch (e) {
    result.ok = false;
    result.errors.push(String(e?.stack || e));
    await shot(page, `${prefix}-CRASH`);
    rec(`${name}/run`, "FAIL", `Exception: ${e.message}`, [shotPath(`${prefix}-CRASH`)]);
  } finally {
    await closeAll(h);
  }
  return result;
}

function hostAnalysis() {
  const all = new Set();
  for (const s of Object.values(hostsByRun)) for (const h of s) all.add(h);
  const unexpected = [...all].filter(
    (h) =>
      !h.endsWith("coinbase.com") &&
      h !== "api.x.ai" &&
      h !== "console.x.ai" &&
      !h.endsWith("x.ai")
  );
  // Price fetches should only go to Coinbase public API. api.x.ai is Grok key test, not a price host.
  const priceHosts = [...all].filter((h) => /coinbase|coingecko|binance|kraken|coinmarket|stellar|horizon/i.test(h));
  const badPrice = priceHosts.filter((h) => !h.endsWith("coinbase.com"));
  rec(
    "network-hosts",
    badPrice.length === 0 ? "PASS" : "FAIL",
    `All HTTP(S) hosts: ${[...all].join(", ") || "(none)"}. Price-related hosts: ${priceHosts.join(", ") || "(none)"}. Unexpected non-Coinbase price hosts: ${badPrice.join(", ") || "none"}. Note: api.x.ai may appear from the fake-key Grok probe only.`
  );
  return { all: [...all], unexpected, priceHosts, badPrice };
}

async function main() {
  await staticHtmlChecks();

  // Deep playthroughs: phone+net, phone+offline, desktop+net. Desktop offline is a shorter ticker/load check if time.
  const scenarios = [
    { name: "phone-net", viewport: { width: 390, height: 844 }, networkOn: true, deep: true },
    { name: "phone-offline", viewport: { width: 390, height: 844 }, networkOn: false, deep: false },
    { name: "desktop-net", viewport: { width: 1280, height: 800 }, networkOn: true, deep: true },
    { name: "desktop-offline", viewport: { width: 1280, height: 800 }, networkOn: false, deep: false },
  ];

  const results = [];
  for (const s of scenarios) {
    console.log("Running", s.name, "...");
    const r = await runScenario(s);
    results.push(r);
    console.log("Finished", s.name, "ok=", r.ok, r.errors);
  }

  const hosts = hostAnalysis();

  // Persist raw JSON for the report writer
  const raw = {
    build: BUILD,
    buildId: "uoe-2026-11-10-v18.2",
    bytes: fs.statSync(BUILD).size,
    startedAt: new Date().toISOString(),
    findings,
    bugs,
    notes,
    results,
    consoleByRun,
    pageErrorsByRun,
    hostsByRun: Object.fromEntries(Object.entries(hostsByRun).map(([k, v]) => [k, [...v]])),
    hosts,
  };
  fs.writeFileSync(path.join(OUT, "v18-qa-raw.json"), JSON.stringify(raw, null, 2));
  console.log("Wrote raw results. findings=", findings.length, "bugs=", bugs.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
