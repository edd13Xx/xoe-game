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
 * xai: optional (route, _request) => fulfill handler; without it api.x.ai is blocked.
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
  await page.clock.install({ time: seed.clockMs }); // fixed start clock; time then runs normally
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
void ((s, name, exact = true) => press(s, btn(s, name, exact)));
void ((s) => s.page.locator("#scene").getAttribute("data-phase").catch(() => null));
const bodyText = (s) => s.page.locator("body").innerText().catch(() => "");

/** Lesson gates: tap the gate. Same lane → XO flies through; other lane → XO flies over, then through. */

// ---------------------------------------------------------------- flows



// User-visible old title: "X Orbital Engine" as words (any case). "XOE: Unknown Orbital Engine" never matches
// (the lookbehind skips "Unknown Orbital Engine"; \b before X needs a word start).

// Code identifiers (x-orbital-engine, X_Orbital_Engine, XOrbitalEngine): counted and reported, but not a FAIL —
// they never render as text. Documented in VERIFY.md.

// Every host the build may name. Anything else is a FAIL (prices or relays sneaking in).

// ---------------------------------------------------------------- main

let mode='ok',release;let calls=0;
const s=await openGame({xai:async(route)=>{
 calls++;
 if(mode==='delay')await new Promise(r=>{release=r});
 await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({choices:[{message:{content:"I'm XOE, Unknown Orbital Engine. Mocked reply."}}]})}).catch(()=>{});
}});
const result={errors:s.errors};
try{
 const input=s.page.locator('input[type=password]').first();
 await input.fill(FAKE_KEY);await press(s,s.page.getByRole('button',{name:/Save and test/}).first());await wait(s,500);
 result.sessionOnly=await s.page.evaluate(k=>sessionStorage.getItem('xoe.grokSessionKey.v1')===k&&!localStorage.getItem('xoe.grokConnect.v1')?.includes(k),FAKE_KEY);
 const remember=s.page.getByRole('checkbox',{name:/Remember on this device/}).first();await remember.check();
 await press(s,s.page.getByRole('button',{name:/Save and test/}).first());await wait(s,500);
 result.explicitRemember=await s.page.evaluate(k=>JSON.parse(localStorage.getItem('xoe.grokConnect.v1')||'{}').apiKey===k,FAKE_KEY);
 await press(s,s.page.getByRole('button',{name:'Grok Bot ON',exact:true}));const afterOff=calls;await wait(s,350);
 result.offRetainsKeyNoCalls=await s.page.evaluate(k=>JSON.parse(localStorage.getItem('xoe.grokConnect.v1')||'{}').apiKey===k,FAKE_KEY)&&afterOff===calls;
 await press(s,s.page.getByRole('button',{name:'Grok Bot OFF',exact:true}));
 mode='delay';await press(s,s.page.getByRole('button',{name:/Save and test/}).first());await wait(s,250);
 result.pendingStarted=!!release;
 await press(s,s.page.getByRole('button',{name:/Disconnect Grok Bot/}).first());
 release?.();await wait(s,500);
 result.disconnectNoResurrection=await s.page.evaluate(k=>!Object.values(localStorage).some(v=>v.includes(k))&&!Object.values(sessionStorage).some(v=>v.includes(k))&&![...document.querySelectorAll('input[type=password],input[type=text]')].some(el=>el.value===k),FAKE_KEY);
 result.branding=!/\bGrok\b(?! Bot)/.test(await bodyText(s));
 result.requests={xai:calls,blocked:s.net.blocked.length};
 await s.page.screenshot({path:'review/grok-disconnected.png',fullPage:false});
}catch(e){result.failure=String(e)}
await closeGame(s);fs.writeFileSync('review/grok-privacy-runtime.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
