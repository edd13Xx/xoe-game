#!/usr/bin/env node
// Local v19 Chromium review harness. Mocked network only; no real keys or account calls.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_BUILD = path.join(ROOT, "dist/index.html");
const OUT_DIR = path.join(ROOT, "qa", "verify");
const SEED_FILE = path.join(OUT_DIR, "seed.json");

// ---------------------------------------------------------------- args
const argv = process.argv.slice(2);
function takeOpt(name) {
  const i = argv.indexOf(name);
  if (i === -1) return null;
  const v = argv[i + 1];
  argv.splice(i, 2);
  return v ?? null;
}
const BUILD = path.resolve(takeOpt("--build") || process.env.VERIFY_BUILD || DEFAULT_BUILD);
void (takeOpt("--device") || "desktop");

// ---------------------------------------------------------------- seed (fixed inputs)
const FIXED_CLOCK = "2026-11-10T12:00:00-06:00"; // America/Indiana/Knox, Central
const FIXED_CLOCK_MS = Date.parse(FIXED_CLOCK);
const FAKE_KEY = "xai-test-fake-0000"; // fake; the game rejects "xai-test" alone as too short

const MOCK_GROK_REPLY = "VERIFY MOCK REPLY: a seed phrase is the master backup for a wallet. Never share it.";

function buildSeed() {
  return {
    tool: "xoe-verify",
    version: 1,
    seed: 20261110,
    clock: FIXED_CLOCK,
    clockMs: FIXED_CLOCK_MS,
    coinbase: {
      note: "Mocked Coinbase public API (spot + 24h stats). No network.",
      spot: { "XLM-USD": "0.2500", "BTC-USD": "90000.00", "ETH-USD": "3000.00", "ADA-USD": "0.5000" },
      open24h: { "XLM-USD": "0.2450", "BTC-USD": "89000.00", "ETH-USD": "2950.00", "ADA-USD": "0.4900" },
    },
    xai: { note: "Mocked api.x.ai chat completions (grok-test only). Fake key.", fakeKey: FAKE_KEY, reply: MOCK_GROK_REPLY },
    localStorage: {
      "xoe.deviceId.v1": "dev-verify-0001",
      "xoe.soundMuted.v1": "1",
      "xoe.tutorial.v1": JSON.stringify({ completed: false, step: 0 }),
      "xoe.voiceReminder.v1": JSON.stringify({
        dontRemind: true,
        lastShownAtMs: FIXED_CLOCK_MS,
        coloniesSinceShow: 0,
        shownFirstStart: true,
        shownFirstPlay: true,
      }),
    },
  };
}

function stable(v) {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])]));
  return v;
}
void ((buf) => crypto.createHash("sha256").update(buf).digest("hex"));

function writeSeed() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const text = JSON.stringify(stable(buildSeed()), null, 2) + "\n";
  fs.writeFileSync(SEED_FILE, text);
  return text;
}
function loadSeed() {
  if (!fs.existsSync(SEED_FILE)) writeSeed();
  return JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
}

// ---------------------------------------------------------------- browser session
async function pw() {
  try {
    return await import("playwright");
  } catch {
    console.error("Playwright not found. Run: npm i -D playwright && npx playwright install chromium webkit");
    process.exit(2);
  }
}

const COINBASE_RE = /^https:\/\/api\.(exchange\.)?coinbase\.com\//;
const XAI_RE = /^https:\/\/api\.x\.ai\//;

/**
 * device: "desktop" (Chromium 1280x800) or "iphone15" (WebKit, Playwright "iPhone 15": 393x659, touch, mobile Safari UA).
 * xai: optional (route, request) => fulfill handler; without it api.x.ai is blocked.
 */
async function openGame({ device = "desktop", xai = null, seed = loadSeed(), query = "" } = {}) {
  if (!fs.existsSync(BUILD)) throw new Error(`build not found: ${BUILD}`);
  const { chromium } = await pw();
  const phone = device !== "desktop";
  const browser = await chromium.launch({ headless: true });
  const context = phone
    ? await browser.newContext({ viewport: device === "landscape" ? {width:844,height:390} : {width:390,height:844}, hasTouch:true, isMobile:true, deviceScaleFactor:1, reducedMotion: "no-preference" })
    : await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: "no-preference" });
  const net = { coinbase: 0, xai: 0, blocked: [], hosts: new Set() };
  await context.route(/^(https?|wss?):/, async (route) => {
    const url = route.request().url();
    try { net.hosts.add(new URL(url).host); } catch {}
    if (COINBASE_RE.test(url)) {
      net.coinbase++;
      return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(coinbaseMock(url, seed)) });
    }
    if (XAI_RE.test(url) && xai) {
      net.xai++;
      return xai(route, route.request());
    }
    net.blocked.push(url.replace(/[?#].*$/, ""));
    return route.abort("blockedbyclient");
  });
  // Deterministic randomness + seeded save, before any game script runs.
  await context.addInitScript(({ seedNum, ls }) => {
    let a = seedNum >>> 0;
    const rand = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    Math.random = rand;
    try {
      if (window.crypto && typeof crypto.randomUUID === "function") {
        crypto.randomUUID = () => "00000000-0000-4000-8000-" + Math.floor(rand() * 1e12).toString(16).padStart(12, "0");
      }
    } catch {}
    try {
      if (!sessionStorage.getItem("__xoeVerifySeeded")) {
        localStorage.clear();
        for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v);
        sessionStorage.setItem("__xoeVerifySeeded", "1");
      }
    } catch {}
  }, { seedNum: seed.seed, ls: seed.localStorage });
  const page = await context.newPage();
  // Native browser clocks: performance/RAF must not be measured through a fixture clock.
  const errors = [];
  page.on("console", msg=>{ if(msg.type()==="error") errors.push(`console: ${msg.text()}`) });
  page.on("pageerror", (e) => errors.push(String(e?.message || e)));
  await page.goto(pathToFileURL(BUILD).href + query, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(900);
  const s = { browser, context, page, net, errors, phone, device };
  return s;
}
async function closeGame(s) {
  try { await s.context.close(); } catch {}
  try { await s.browser.close(); } catch {}
}

function coinbaseMock(url, seed) {
  const pair = (url.match(/(?:prices|products)\/([A-Z]+-[A-Z]+)\//) || [])[1] || "XLM-USD";
  const spot = seed.coinbase.spot[pair] ?? "1.0000";
  const open = seed.coinbase.open24h[pair] ?? spot;
  if (/\/spot/.test(url)) return { data: { amount: spot, base: pair.split("-")[0], currency: "USD" } };
  if (/\/stats/.test(url)) return { open, high: spot, low: open, last: spot, volume: "1000" };
  if (/\/candles/.test(url)) return [];
  if (/\/book/.test(url)) return { bids: [], asks: [], sequence: 1 };
  return {};
}

// ---------------------------------------------------------------- page helpers
const wait = (s, ms) => s.page.waitForTimeout(ms);
async function press(s, loc, timeout = 4000) {
  const el = loc.first();
  if (!(await el.count())) return false;
  try { await el.scrollIntoViewIfNeeded({ timeout: 2000 }); } catch {}
  if (!(await el.isVisible().catch(() => false))) return false;
  try {
    if (s.phone) await el.tap({ timeout });
    else await el.click({ timeout });
    return true;
  } catch {
    try { await el.click({ timeout, force: true }); return true; } catch { return false; }
  }
}
const btn = (s, name, exact = true) => s.page.getByRole("button", { name, exact });
const pressName = (s, name, exact = true) => press(s, btn(s, name, exact));
const phaseOf = (s) => s.page.locator("#scene").getAttribute("data-phase").catch(() => null);
const bodyText = (s) => s.page.locator("body").innerText().catch(() => "");
async function dismissReminder(s) {
  const got = s.page.locator('[data-voice-reminder="1"], .voice-reminder').getByRole("button", { name: /Got it/i });
  if (await got.first().isVisible().catch(() => false)) { await press(s, got); await wait(s, 200); }
}

/** Lesson gates: tap the gate. Same lane → XO flies through; other lane → XO flies over, then through. */

async function setupPilot(s) {
  if (!(await pressName(s, "Start"))) return { ok: false, why: "Start not tappable" };
  await wait(s, 500);
  await press(s, s.page.locator(".roster-row").first());
  await wait(s, 150);
  for (const t of ["Female", "Sentinel", "I confirm I have seen the simulation disclaimer."]) {
    const l = s.page.getByText(t, { exact: true }).first();
    if (!(await press(s, l))) {
      const name = t === "Female" ? "player-gender" : t === "Sentinel" ? "player-class" : null;
      if (name) await s.page.locator(`input[name="${name}"]`).first().check({ force: true }).catch(() => {});
    }
    await wait(s, 120);
  }
  const ready = btn(s, "Start when ready");
  if (await ready.isDisabled().catch(() => true)) return { ok: false, why: "Start when ready stayed disabled" };
  await press(s, ready);
  await wait(s, 700);
  return { ok: true, why: `phase ${await phaseOf(s)}` };
}

async function walkStory(s) {
  const phases = [];
  for (let i = 0; i < 20; i++) {
    await dismissReminder(s);
    const ph = await phaseOf(s);
    phases.push(ph);
    if (ph === "practice" || ph === "practice-pause") break;
    if (ph === "cinematic-choice" || ph === "cinematic") {
      if (!(await pressName(s, "Skip cinematic"))) await pressName(s, "Skip");
      await wait(s, 450);
      continue;
    }
    if (await pressName(s, "Continue")) { await wait(s, 400); continue; }
    if (await pressName(s, "Enter the terrace")) { await wait(s, 400); continue; }
    await wait(s, 300);
    if ((await phaseOf(s)) === ph) break;
  }
  return phases;
}

async function practiceDesk(s) {
  await dismissReminder(s);
  if ((await phaseOf(s)) === "practice-pause") { await pressName(s, "Resume practice"); await wait(s, 400); }
  const res = { bought: false, sold: false, label: false, paperWord: false };
  const body = await bodyText(s);
  res.label = /sim price|testnet|no real money/i.test(body);
  res.paperWord = /paper trading|paper only/i.test(body);
  const buy = s.page.getByRole("button", { name: /Buy XOE/i });
  if (await press(s, buy)) { res.bought = true; await wait(s, 1200); }
  const sell = s.page.getByRole("button", { name: /Sell XOE/i });
  if (await press(s, sell)) { res.sold = true; await wait(s, 400); }
  await dismissReminder(s);
  if (!(await pressName(s, "Continue story"))) if (!(await pressName(s, "Done trading"))) await pressName(s, "Exit practice");
  await wait(s, 500);
  return res;
}

async function toMap(s) {
  for (let i = 0; i < 24; i++) {
    await dismissReminder(s);
    const ph = await phaseOf(s);
    if (ph === "colony-map") return true;
    if (ph === "navigate") {
      for (let r = 0; r < 10; r++) { if (!(await pressName(s, "Move right"))) await s.page.keyboard.press("ArrowRight"); await wait(s, 60); }
      for (let d = 0; d < 5; d++) { if (!(await pressName(s, "Move down"))) await s.page.keyboard.press("ArrowDown"); await wait(s, 60); }
      await pressName(s, "Inspect sealed hatch");
      await wait(s, 300);
      await pressName(s, "Travel to colonies");
      await wait(s, 600);
      continue;
    }
    let moved = false;
    for (const n of ["Continue", "Enter the terrace", "Travel to colonies", "Keep going", "Next", "Fly on", "Continue story"]) {
      if (await pressName(s, n)) { moved = true; await wait(s, 400); break; }
    }
    if (moved) continue;
    await wait(s, 300);
    if ((await phaseOf(s)) === ph) break;
  }
  return (await phaseOf(s)) === "colony-map";
}

async function closeChapterCard(s) {
  const ch = s.page.locator(".chapter-overlay");
  if (await ch.isVisible().catch(() => false)) await press(s, ch.getByRole("button", { name: "Continue", exact: true }));
  await wait(s, 400);
  await dismissReminder(s);
}

async function reachMap(s) {
  const p = await setupPilot(s);
  if (!p.ok) return { ok: false, why: p.why };
  await walkStory(s);
  const desk = await practiceDesk(s);
  const ok = await toMap(s);
  if (ok) await closeChapterCard(s);
  return { ok, why: `phase ${await phaseOf(s)}`, desk };
}

// ---------------------------------------------------------------- flows



// User-visible old title: "X Orbital Engine" as words (any case). "XOE: Unknown Orbital Engine" never matches
// (the lookbehind skips "Unknown Orbital Engine"; \b before X needs a word start).

// Code identifiers (x-orbital-engine, X_Orbital_Engine, XOrbitalEngine): counted and reported, but not a FAIL —
// they never render as text. Documented in VERIFY.md.

// Every host the build may name. Anything else is a FAIL (prices or relays sneaking in).

// ---------------------------------------------------------------- main

const measureCadence=async s=>await s.page.evaluate(()=>new Promise(resolve=>{let prev=performance.now(),begin=prev;const values=[];function frame(now){values.push(now-prev);prev=now;if(now-begin>2500){const v=values.slice(1).sort((a,b)=>a-b);resolve({intervals:v.length,p95:v[Math.floor(v.length*.95)],max:v[v.length-1],over34:v.filter(x=>x>34).length,visibility:document.visibilityState})}else requestAnimationFrame(frame)}requestAnimationFrame(frame)}));
const results=[];
for(const device of ['desktop','portrait','landscape']){
 const s=await openGame({device});const result={device,nativeBrowserClocks:true};
 try{
  result.launch=await s.page.evaluate(()=>({viewport:[innerWidth,innerHeight],nav:performance.getEntriesByType('navigation').map(n=>({dom:n.domContentLoadedEventEnd,load:n.loadEventEnd})),paint:performance.getEntriesByType('paint').map(p=>({name:p.name,ms:p.startTime}))}));
  result.frontFrameCadence=await measureCadence(s);
  result.map=await reachMap(s);
  result.frameCadence=await measureCadence(s);
  await pressName(s,"Full Map");
  await press(s,s.page.locator('[data-dome="fees-leverage"]'));
  result.movingStart=await s.page.locator('.xo-avatar').evaluate(el=>({x:parseFloat(el.style.left),y:parseFloat(el.style.top)}));
  result.movingMapFrameCadence=await measureCadence(s);
  result.movingEnd=await s.page.locator('.xo-avatar').evaluate(el=>({x:parseFloat(el.style.left),y:parseFloat(el.style.top)}));
  result.movementDistance=Math.hypot(result.movingEnd.x-result.movingStart.x,result.movingEnd.y-result.movingStart.y);
  if(result.movementDistance<100)throw new Error("Moving-map sample did not exercise a real flight");
  result.errors=s.errors;result.unexpectedRequests=s.net.blocked;
 }catch(e){result.failure=String(e)}
 results.push(result);await closeGame(s);
}
fs.writeFileSync('review/performance-native-v19.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
