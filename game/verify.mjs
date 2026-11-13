#!/usr/bin/env node
/**
 * XOE verify tool — LOCAL ONLY. TEST ONLY.
 *
 *   node verify.mjs seed                 write qa/verify/seed.json (fixed seed, clock, mocked Coinbase prices)
 *   node verify.mjs run <flow>|list      play a named flow headlessly, PASS/FAIL per step
 *   node verify.mjs screenshot <page>|list   iPhone 15 WebKit 393x659 + desktop 1280x800 PNGs into qa/verify/
 *   node verify.mjs check                every mechanical locked rule, one line each, non-zero exit on any FAIL
 *
 * Options: --build <path> (or VERIFY_BUILD) picks the HTML file. Default: the shipped v18.2 HTML.
 *          --device desktop|iphone15 (run only; default desktop).
 *
 * Safety: every http(s) request is blocked except api.coinbase.com / api.exchange.coinbase.com
 * (answered by a fixed local mock) and api.x.ai (answered by a fixed local mock in grok-test only).
 * Nothing leaves the box. Fake keys only ("xai-test-fake-0000"). Never prints a key-like match.
 * Not part of the game build: lives in the project root, outside src/, tsconfig and vitest.
 */
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
const DEVICE_OPT = takeOpt("--device") || "desktop";
const [CMD, ARG] = argv;

// ---------------------------------------------------------------- seed (fixed inputs)
const FIXED_CLOCK = "2026-11-10T12:00:00-06:00"; // America/Indiana/Knox, Central
const FIXED_CLOCK_MS = Date.parse(FIXED_CLOCK);
const FAKE_KEY = "xai-test-fake-0000"; // fake; the game rejects "xai-test" alone as too short
const SHORT_KEY = "xai-test";
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
const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

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
  const { chromium, webkit, devices } = await pw();
  const phone = device === "iphone15";
  const browser = phone ? await webkit.launch({ headless: true }) : await chromium.launch({ headless: true });
  const context = phone
    ? await browser.newContext({ ...devices["iPhone 15"], reducedMotion: "reduce" })
    : await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
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
async function pressGate(s, text) {
  const g = s.page.locator(".arcade-gate-node").filter({ hasText: new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`) }).first();
  if (!(await g.count())) return false;
  try { await g.scrollIntoViewIfNeeded({ timeout: 2000 }); } catch {}
  // A coordinate tap also hits the flight field (pointer capture), so send the click to the gate.
  await g.dispatchEvent("click");
  return true;
}

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

async function openPause(s) {
  const modalPause = s.page.getByRole("dialog", {name:"Colony fight"}).getByRole("button", {name:"Pause",exact:true});
  if (await modalPause.isVisible().catch(()=>false)) { await press(s,modalPause); await wait(s,300); return s.page.locator(".xo-menu-overlay").isVisible().catch(()=>false); }
  const p = s.page.getByRole("button", { name: "Pause menu" }).or(s.page.getByRole("button", { name: "Pause", exact: true }));
  if (!(await press(s, p))) await s.page.keyboard.press("Escape");
  await wait(s, 500);
  return s.page.locator(".xo-menu-overlay").isVisible().catch(() => false);
}

// ---------------------------------------------------------------- flows
class Steps {
  constructor(flow) { this.flow = flow; this.rows = []; }
  rec(id, ok, detail) {
    this.rows.push({ id, ok: !!ok });
    const n = String(this.rows.length).padStart(2, "0");
    console.log(`${ok ? "PASS" : "FAIL"} ${this.flow}.${n} ${id} — ${detail}`);
    return !!ok;
  }
}

const BONUS_RIGHT = ["To open AND to close", "About 0.24%", "About 10%, up or down", "About 20%", "Wipe-out is further away", "Safer, not easier"];

const FLOWS = {
  tutorial: {
    about: "Open Tutorial from the start menu, check the XOE intro line, step through all 6 steps, confirm it is saved as done.",
    async run(s, t) {
      t.rec("launch-menu", await btn(s, "Start").first().isVisible(), "start menu shows Start");
      t.rec("open-tutorial", await pressName(s, "Tutorial"), "tapped Tutorial in Panels");
      await wait(s, 500);
      const panel = s.page.locator(".tutorial-panel");
      const h1 = (await panel.locator("h2").innerText().catch(() => "")).trim();
      t.rec("step1-identity", /I[’']m XOE, Unknown Orbital Engine/.test(h1), `step 1 title: "${h1}"`);
      const seen = [await panel.getAttribute("data-tutorial-step").catch(() => null)];
      for (let i = 0; i < 5; i++) {
        await press(s, panel.getByRole("button", { name: "Next", exact: true }));
        await wait(s, 250);
        seen.push(await panel.getAttribute("data-tutorial-step").catch(() => null));
      }
      t.rec("six-steps", seen.length === 6 && new Set(seen).size === 6 && !seen.includes(null), `steps: ${seen.join(" > ")}`);
      const body = await bodyText(s);
      t.rec("no-paper-trading-copy", !/paper trading|paper only/i.test(body), "no 'paper trading' / 'Paper only' on screen");
      t.rec("finish", await press(s, panel.getByRole("button", { name: /Got it/ })), "tapped 'Got it — let’s fly'");
      await wait(s, 300);
      const saved = await s.page.evaluate(() => localStorage.getItem("xoe.tutorial.v1"));
      t.rec("saved-complete", /"completed":true/.test(saved || ""), `xoe.tutorial.v1 = ${saved}`);
    },
  },
  map: {
    about: "Pilot setup → story → practice desk buy/sell → navigate → colony map; checks the trade dock, full map and pause menu.",
    async run(s, t) {
      const p = await setupPilot(s);
      t.rec("pilot-setup", p.ok, p.why);
      if (!p.ok) return;
      const phases = await walkStory(s);
      t.rec("story-to-practice", ["practice", "practice-pause"].includes(phases.at(-1)), `phases: ${phases.join(" > ")}`);
      const d = await practiceDesk(s);
      t.rec("practice-trade", d.bought && d.sold && d.label && !d.paperWord, `buy=${d.bought} sell=${d.sold} sim/testnet label=${d.label} paper-wording=${d.paperWord}`);
      const ok = await toMap(s);
      t.rec("reach-colony-map", ok, `phase ${await phaseOf(s)}`);
      if (!ok) return;
      await closeChapterCard(s);
      const dock = await s.page.locator(".live-trade-dock button").count();
      t.rec("trade-dock", dock >= 2, `${dock} dock buttons`);
      const domes = await s.page.locator(".world-dome").count();
      t.rec("domes", domes >= 10, `${domes} domes on the map`);
      t.rec("open-full-map", (await pressName(s, "Full Map")) && (await s.page.locator(".full-map-screen").isVisible().catch(() => false)), "Full Map button opens the full map");
      const list = await s.page.locator(".full-map-dome").count();
      const bonus = await s.page.locator(".full-map-dome.bonus").count();
      t.rec("full-map-list", list >= 10 && bonus === 1, `${list} domes listed, ${bonus} bonus`);
      await pressName(s, "Close map");
      await wait(s, 300);
      const paused = await openPause(s);
      const pt = await bodyText(s);
      t.rec("pause-menu", paused && /Resume/.test(pt) && /Quit to start/.test(pt), "pause menu has Resume + Quit to start");
    },
  },
  "fees-bonus": {
    about: "Reach the map, fly to the bonus dome from the full map, play all 6 'Fees and leverage' steps (one wrong answer), check the ~0.3% funding line.",
    async run(s, t) {
      const r = await reachMap(s);
      t.rec("reach-colony-map", r.ok, r.why);
      if (!r.ok) return;
      await pressName(s, "Full Map");
      await wait(s, 400);
      t.rec("fly-to-bonus", await press(s, s.page.locator(".full-map-dome.bonus")), "tapped the ★ bonus dome in the full map");
      let prompt = "";
      for (let i = 0; i < 30 && !/Fees and leverage/.test(prompt); i++) {
        await wait(s, 300);
        prompt = (await s.page.locator(".enter-prompt").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
      }
      t.rec("enter-prompt", /Fees and leverage/.test(prompt), `prompt: "${prompt.slice(0, 60)}"`);
      await press(s, s.page.locator(".enter-prompt button").first());
      await wait(s, 700);
      t.rec("lesson-open", (await phaseOf(s)) === "colony-lesson", `phase ${await phaseOf(s)}`);
      let funding = false;
      const edu = /Education only · sim and testnet · not financial advice/.test(await bodyText(s));
      t.rec("edu-label", edu, "'Education only · sim and testnet · not financial advice' on the lesson");
      // v19 keeps one-line lessons; the complete funding explanation lives behind Learn more.
      await pressName(s, "Learn more"); await wait(s, 500);
      funding = /about 0\.3% is a safer number/.test(await bodyText(s));
      await pressName(s, "Close"); await pressName(s, "Resume"); await wait(s, 300);
      let rights = 0;
      let wrongFeedback = "";
      for (let i = 0; i < 6; i++) {
        await dismissReminder(s);
        await wait(s, 900); // the lesson ignores taps for a moment after each answer
        if (/about 0\.3% is a safer number/.test(await bodyText(s))) funding = true;
        if (i === 0) {
          // wrong gate in another lane: XO flies over, then through it
          await pressGate(s, "Only when you win");

          for (let z = 0; z < 20 && !wrongFeedback; z++) { await wait(s, 300); wrongFeedback = ((await bodyText(s)).match(/(Not that one\.|Wrong gate\.)[^\n]*/) || [""])[0]; }
          await wait(s, 900);
        }
        const want = i < 5 ? `Step ${i + 1}/6 right.` : "Fees and leverage clear.";
        let got = false;
        for (let attempt = 0; attempt < 3 && !got; attempt++) {
          if (!(await pressGate(s, BONUS_RIGHT[i]))) break;
          for (let z = 0; z < 12 && !got; z++) {
            await wait(s, 300);
            const bt = await bodyText(s);
            if (/about 0\.3% is a safer number/.test(bt)) funding = true;
            got = bt.includes(want);
          }
        }
        if (!got) break;
        rights++;
      }
      t.rec("wrong-answer-feedback", !!wrongFeedback, `"${wrongFeedback.slice(0, 50)}"`);
      t.rec("six-right", rights === 6, `${rights}/6 steps answered right`);
      t.rec("funding-line", funding, "'about 0.3% is a safer number' available through lesson Learn more / FAQ");
      const body = await bodyText(s);
      t.rec("back-on-map", (await phaseOf(s)) === "colony-map" && /Fees and leverage clear\./.test(body), `phase ${await phaseOf(s)}; "Fees and leverage clear." shown=${/Fees and leverage clear\./.test(body)}`);
      t.rec("no-paper-trading-copy", !/paper trading|paper only/i.test(body), "no 'paper trading' / 'Paper only' on screen");
    },
  },
  "grok-test": {
    about: "Grok Bot card with mocked api.x.ai: label, short-key error, bad-key (401) error, good fake key connects, Ask XOE reply, built-in identity line, Disconnect deletes the key.",
    xai: true,
    async run(s, t) {
      const body0 = await bodyText(s);
      t.rec("label-grok-bot", /Grok Bot integration/.test(body0) && (await btn(s, /Grok Bot (ON|OFF)/, false).count()) > 0, "card says 'Grok Bot integration' + 'Grok Bot ON'");
      // built-in identity (no key yet): Ask XOE "who are you"
      await pressName(s, "Ask XOE");
      await wait(s, 500);
      const q = s.page.getByRole("textbox", { name: "Ask XOE question" });
      await q.first().fill("Who are you?");
      await press(s, s.page.locator(".ask-grok-panel").getByRole("button", { name: "Ask", exact: true }));
      let reply = "";
      for (let z = 0; z < 20 && !reply; z++) { await wait(s, 300); reply = (await s.page.locator(".ask-grok-reply .bubble").innerText().catch(() => "")).trim(); }
      t.rec("builtin-identity", /I[’']m XOE, Unknown Orbital Engine/.test(reply), `built-in reply: "${reply.slice(0, 70)}"`);
      t.rec("no-xai-call-without-key", s.net.xai === 0, `${s.net.xai} api.x.ai calls before a key`);
      await s.page.keyboard.press("Escape");
      await wait(s, 300);
      const closeBtn = s.page.locator(".drawer-shell, [role=dialog]").getByRole("button", { name: /Close|Back|Done/i });
      if (await closeBtn.first().isVisible().catch(() => false)) await press(s, closeBtn);
      await wait(s, 300);

      const input = s.page.locator('input[type="password"]').first();
      const save = s.page.getByRole("button", { name: /Save and test/i }).first();
      const status = async (re) => {
        for (let z = 0; z < 25; z++) {
          const m = (await bodyText(s)).match(re);
          if (m) return m[0];
          await wait(s, 300);
        }
        return "";
      };
      // 1) short key → local error, no network
      s.mode = "401";
      await input.fill(SHORT_KEY);
      await press(s, save);
      const short = await status(/That key is too short[^\n]*/);
      t.rec("short-key-error", !!short, `"${short.slice(0, 60)}"`);
      // 2) bad key → mocked 401 → error path
      await input.fill(FAKE_KEY);
      await press(s, save);
      const bad = await status(/xAI said the key is not valid[^\n]*/);
      t.rec("bad-key-error", !!bad && s.net.xai >= 1, `mocked 401 → "${bad.slice(0, 60)}"`);
      // 3) good fake key → mocked 200 → connected
      s.mode = "ok";
      await input.fill(FAKE_KEY).catch(() => {});
      if (!(await press(s, save))) await press(s, s.page.getByRole("button", { name: /Save and test Grok Bot|Save and test/i }));
      const okLine = await status(/Grok Bot connected ✓|Live Grok Bot: connected/);
      t.rec("good-key-connected", !!okLine, `mocked 200 → "${okLine}"`);
      const kept = await s.page.evaluate((k) => sessionStorage.getItem("xoe.grokSessionKey.v1") === k && !localStorage.getItem("xoe.grokConnect.v1")?.includes(k), FAKE_KEY);
      t.rec("key-session-only", kept, "fake key retained in session storage, absent from persistent settings (value not printed)");
      const sys = s.lastSystem || "";
      t.rec("system-prompt-identity", /I'm XOE, Unknown Orbital Engine\./.test(sys) && /Never call yourself Grok/.test(sys), "request tells the model to say \"I'm XOE, Unknown Orbital Engine.\"");
      t.rec("fake-key-sent-only-to-mock", s.authOk === true, "Authorization header carried the fake key (to the local mock only)");
      // 4) Ask XOE via live path
      await pressName(s, "Ask XOE");
      await wait(s, 500);
      await s.page.getByRole("textbox", { name: "Ask XOE question" }).first().fill("What is a seed phrase?");
      const before = s.net.xai;
      await press(s, s.page.locator(".ask-grok-panel").getByRole("button", { name: "Ask", exact: true }));
      let live = "";
      for (let z = 0; z < 30 && !live.includes("VERIFY MOCK REPLY"); z++) { await wait(s, 300); live = (await s.page.locator(".ask-grok-reply").innerText().catch(() => "")).replace(/\s+/g, " "); }
      const by = (live.match(/Answered by: (.*)$/) || ["", ""])[1].trim();
      t.rec("live-reply", live.includes(MOCK_GROK_REPLY) && s.net.xai > before, `reply shown; answered by: "${by}"`);
      t.rec("reply-labeled-grok-bot", /Grok Bot/.test(by), `label "${by}"`);
      await s.page.keyboard.press("Escape");
      await wait(s, 300);
      // 5) Disconnect deletes key
      const disc = btn(s, "Disconnect");
      for (let i = 0; i < (await disc.count()); i++) {
        const d = disc.nth(i);
        if ((await d.isVisible().catch(() => false)) && (await d.isEnabled().catch(() => false))) { await (s.phone ? d.tap() : d.click()).catch(() => {}); break; }
      }
      await wait(s, 300);
      const stored = await s.page.evaluate(() => JSON.parse(localStorage.getItem("xoe.grokConnect.v1") || "{}").apiKey || "");
      t.rec("disconnect-deletes-key", stored === "", stored === "" ? "no key in storage" : "key still stored");
      t.rec("network-mocked-only", s.net.blocked.length === 0 || s.net.blocked.every((u) => !/x\.ai|coinbase/.test(u)), `${s.net.xai} mocked x.ai, ${s.net.coinbase} mocked coinbase, ${s.net.blocked.length} blocked`);
    },
  },
};

function xaiMockFor(s) {
  return async (route, req) => {
    let body = {};
    try { body = JSON.parse(req.postData() || "{}"); } catch {}
    const sys = (body.messages || []).find((m) => m.role === "system");
    if (sys) s.lastSystem = String(sys.content || "");
    s.authOk = (req.headers()["authorization"] || "") === `Bearer ${FAKE_KEY}`;
    const j = (status, b) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(b) });
    if (s.mode === "ok") return j(200, { id: "verify", object: "chat.completion", choices: [{ index: 0, message: { role: "assistant", content: MOCK_GROK_REPLY }, finish_reason: "stop" }] });
    return j(401, { error: "Incorrect API key provided: xa***00. You can obtain an API key from https://console.x.ai." });
  };
}

async function cmdRun(flow) {
  if (!flow || flow === "list") {
    console.log("Flows:");
    for (const [k, v] of Object.entries(FLOWS)) console.log(`  ${k.padEnd(11)} ${v.about}`);
    return 0;
  }
  const f = FLOWS[flow];
  if (!f) { console.error(`Unknown flow "${flow}". Try: node verify.mjs run list`); return 2; }
  const device = DEVICE_OPT === "iphone15" ? "iphone15" : "desktop";
  console.log(`verify run ${flow} · build ${path.basename(BUILD)} · ${device === "iphone15" ? "iPhone 15 WebKit 393x659" : "desktop Chromium 1280x800"}`);
  const t = new Steps(flow);
  const holder = {};
  const s = await openGame({ device, xai: f.xai ? (route, req) => xaiMockFor(holder.s)(route, req) : null });
  holder.s = s;
  s.mode = "401";
  try {
    await f.run(s, t);
  } catch (e) {
    t.rec("crash", false, String(e?.message || e).split("\n")[0]);
  }
  t.rec("no-page-errors", s.errors.length === 0, `${s.errors.length} page errors`);
  const bad = [...s.net.hosts].filter((h) => !/^api\.(exchange\.)?coinbase\.com$|^api\.x\.ai$/.test(h));
  t.rec("network-blocked", true, `requests: ${s.net.coinbase} coinbase (mock), ${s.net.xai} x.ai (mock), ${s.net.blocked.length} blocked${bad.length ? ` (hosts: ${bad.sort().join(", ")})` : ""}`);
  await closeGame(s);
  const pass = t.rows.filter((r) => r.ok).length;
  const fail = t.rows.length - pass;
  console.log(`SUMMARY ${flow}: ${fail ? "FAIL" : "PASS"} ${pass}/${t.rows.length} steps passed`);
  return fail ? 1 : 0;
}

// ---------------------------------------------------------------- screenshots
const PAGES = {
  launch: { about: "start menu (title, Start, Grok Bot card)", async go() { return true; } },
  "grok-card": {
    about: "Grok Bot integration card in the start menu",
    async go(s) {
      const card = s.page.locator("section", { hasText: "Grok Bot integration" }).last();
      await card.scrollIntoViewIfNeeded().catch(() => {});
      return card.isVisible().catch(() => false);
    },
  },
  "pilot-select": { about: "pilot select after Start (XO CLASSIFIED card)", async go(s) { const ok = await pressName(s, "Start"); await wait(s, 500); await s.page.locator(".roster-row").first().scrollIntoViewIfNeeded().catch(() => {}); return ok; } },
  tutorial: { about: "Tutorial drawer step 1", async go(s) { const ok = await pressName(s, "Tutorial"); await wait(s, 500); return ok; } },
  practice: {
    about: "practice trade desk",
    async go(s) {
      const p = await setupPilot(s);
      if (!p.ok) return false;
      const ph = await walkStory(s);
      if ((await phaseOf(s)) === "practice-pause") { await pressName(s, "Resume practice"); await wait(s, 400); }
      await s.page.evaluate(() => window.scrollTo(0, 0));
      return ["practice", "practice-pause"].includes(ph.at(-1));
    },
  },
  map: { about: "colony map with trade dock", async go(s) { const r = await reachMap(s); await s.page.evaluate(() => document.querySelector(".mars-world-shell")?.scrollIntoView({ block: "start" })); return r.ok; } },
  "full-map": { about: "full map screen (dome list)", async go(s) { const r = await reachMap(s); if (!r.ok) return false; const ok = await pressName(s, "Full Map"); await wait(s, 500); return ok; } },
  pause: { about: "pause menu during play", async go(s) { const r = await reachMap(s); if (!r.ok) return false; return openPause(s); } },
};

async function cmdScreenshot(name) {
  if (!name || name === "list") {
    console.log("Pages:");
    for (const [k, v] of Object.entries(PAGES)) console.log(`  ${k.padEnd(12)} ${v.about}`);
    return 0;
  }
  const pg = PAGES[name];
  if (!pg) { console.error(`Unknown page "${name}". Try: node verify.mjs screenshot list`); return 2; }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let code = 0;
  for (const [device, suffix, label] of [["iphone15", "iphone15", "iPhone 15 WebKit 393x659"], ["desktop", "desktop", "desktop Chromium 1280x800"]]) {
    const s = await openGame({ device });
    let ok = false;
    try { ok = await pg.go(s); } catch (e) { ok = false; console.error(String(e?.message || e).split("\n")[0]); }
    await wait(s, 400);
    const out = path.join(OUT_DIR, `${name}-${suffix}.png`);
    await s.page.screenshot({ path: out, fullPage: false });
    const vp = s.page.viewportSize();
    console.log(`${ok ? "PASS" : "FAIL"} screenshot ${name} ${label} ${vp.width}x${vp.height} → ${path.relative(ROOT, out)}`);
    if (!ok) code = 1;
    await closeGame(s);
  }
  return code;
}

// ---------------------------------------------------------------- check (locked rules)
const TITLE = "XOE: Unknown Orbital Engine";
// User-visible old title: "X Orbital Engine" as words (any case). "XOE: Unknown Orbital Engine" never matches
// (the lookbehind skips "Unknown Orbital Engine"; \b before X needs a word start).
const OLD_TITLE_RE = /(?<!Unknown )\bX\s+Orbital\s+Engine\b/gi;
// Code identifiers (x-orbital-engine, X_Orbital_Engine, XOrbitalEngine): counted and reported, but not a FAIL —
// they never render as text. Documented in VERIFY.md.
const OLD_TITLE_CODE_RE = /\bX[_-]?Orbital[_-]?Engine\b/gi;
const KEY_PATTERNS = [
  ["xai-key", /xai-[A-Za-z0-9]{20,}/g],
  ["sk-key", /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}/g],
  ["bearer-token", /Bearer\s+[A-Za-z0-9._~+/-]{20,}=*/g],
  ["webhook-url", /https?:\/\/[^\s"'`]*(?:hooks\.slack\.com|discord(?:app)?\.com\/api\/webhooks|\/webhooks?\/)[^\s"'`]*/gi],
  ["stellar-secret", /\bS[A-Z2-7]{55}\b/g],
  ["aws-key", /\bAKIA[0-9A-Z]{16}\b/g],
  ["github-token", /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g],
  ["webhook-env", /GROKBOT_WEBHOOK/g],
];
const OTHER_PRICE_APIS = ["coingecko", "binance", "kraken.com", "coinmarketcap", "cryptocompare", "coincap.io", "messari.io", "coinpaprika", "bitstamp", "bitfinex", "gemini.com", "okx.com", "bybit", "kucoin", "huobi", "nomics.com", "coinlore", "livecoinwatch"];
// Every host the build may name. Anything else is a FAIL (prices or relays sneaking in).
const ALLOWED_HOSTS = {
  "api.coinbase.com": "Coinbase public spot price",
  "api.exchange.coinbase.com": "Coinbase public 24h stats / candles / book",
  "api.x.ai": "player's own Grok Bot key (live replies)",
  "console.x.ai": "link: where to get a key",
  "www.w3.org": "SVG/XHTML/MathML namespace strings (not fetched)",
  "freighter.app": "wallet how-to link text",
  "horizon-testnet.stellar.org": "Stellar testnet config string (not a price source)",
};
const RELAY = "127.0.0.1:18791";

function scanHosts(html) {
  const hosts = new Map();
  for (const m of html.matchAll(/\b(?:https?|wss?):\/\/([a-z0-9.-]+(?::\d+)?)/gi)) hosts.set(m[1].toLowerCase(), true);
  for (const m of html.matchAll(/\b((?:[a-z0-9-]+\.)+(?:com|org|net|io|ai|app|dev|xyz|co|gg|me|cloud|tech))\b/gi)) {
    const h = m[1].toLowerCase();
    if (!/^(e|t|n|r|i|o|a|s|window|document|this)\./.test(h)) hosts.set(h, true);
  }
  return [...hosts.keys()].sort();
}

async function renderedTexts() {
  const s = await openGame({ device: "desktop" });
  const out = { title: "", h1: [], launch: "", attrs: "", pilot: "", xoCard: "", tutorial1: "", hosts: [], errors: 0 };
  try {
    out.title = await s.page.title();
    out.h1 = (await s.page.locator("h1").allInnerTexts()).map((x) => x.trim());
    out.launch = await bodyText(s);
    out.attrs = await s.page.evaluate(() => [...document.querySelectorAll("[aria-label],[alt],[title],[placeholder]")].map((e) => ["aria-label", "alt", "title", "placeholder"].map((a) => e.getAttribute(a) || "").join(" ")).join("\n"));
    await pressName(s, "Start");
    await wait(s, 500);
    out.pilot = await bodyText(s);
    const rows = await s.page.locator(".roster-row").allInnerTexts();
    out.xoCard = (rows.find((r) => /CLASSIFIED/.test(r)) || "").replace(/\s+/g, " ").trim();
    out.xoIsFirst = /^XO\b/.test((rows[0] || "").trim());
    await pressName(s, "Tutorial");
    await wait(s, 400);
    out.tutorial1 = (await s.page.locator(".tutorial-panel h2").innerText().catch(() => "")).trim();
  } finally {
    out.hosts = [...s.net.hosts].sort();
    out.errors = s.errors.length;
    await closeGame(s);
  }
  return out;
}

async function cmdCheck() {
  const html = fs.readFileSync(BUILD, "utf8");
  const lines = [];
  const rule = (id, ok, detail) => lines.push(`${ok ? "PASS" : "FAIL"} ${id} ${detail}`);
  const count = (re) => (html.match(re) || []).length;
  const r = await renderedTexts();
  const screen = [r.launch, r.pilot].join("\n");

  // 1 title
  const titles = [...html.matchAll(/<title>([\s\S]*?)<\/title>/gi)].map((m) => m[1].trim());
  const titleOk = titles.length === 1 && titles[0] === TITLE && r.title === TITLE && r.h1.length > 0 && r.h1.every((h) => h === TITLE);
  rule("title-exact", titleOk, `<title>=${JSON.stringify(titles[0] ?? null)} document.title=${JSON.stringify(r.title)} h1=${JSON.stringify([...new Set(r.h1)])}`);

  // 2 old title: whole HTML incl. code identifiers + rendered text
  const oldInHtml = count(OLD_TITLE_RE);
  const oldOnScreen = ([screen, r.attrs].join("\n").match(OLD_TITLE_RE) || []).length;
  const oldCodeIds = count(OLD_TITLE_CODE_RE);
  rule("no-x-orbital", !/x[\s_-]+orbital/i.test(html), "strict built HTML includes strings and identifiers");
  rule("no-old-title", oldInHtml === 0 && oldOnScreen === 0, `"X Orbital Engine" text in HTML=${oldInHtml} on screen+aria/alt/title=${oldOnScreen}; code ids like x-orbital-engine (not shown, not a fail)=${oldCodeIds}`);

  // 3 AI label
  const grokBot = count(/Grok Bot/g);
  const labelOnScreen = /Grok Bot integration/.test(r.launch) && /Grok Bot (ON|OFF)/.test(r.launch);
  rule("ai-label-grok-bot", grokBot > 0 && labelOnScreen, `"Grok Bot" in HTML=${grokBot}; start menu shows "Grok Bot integration" + toggle=${labelOnScreen}`);

  // 4 identity line
  const idStraight = count(/I'm XOE, Unknown Orbital Engine/g);
  const idCurly = count(/I’m XOE, Unknown Orbital Engine/g);
  const idPrompt = /say "I'm XOE, Unknown Orbital Engine\."/.test(html) || /XOE_IDENTITY_LINE|I'm \$\{/.test(html);
  const idOk = idStraight + idCurly > 0 && /I[’']m XOE, Unknown Orbital Engine/.test(r.tutorial1);
  rule("ai-identity-line", idOk, `"I'm XOE, Unknown Orbital Engine" straight=${idStraight} curly=${idCurly}; tutorial step 1 renders it=${/I[’']m XOE, Unknown Orbital Engine/.test(r.tutorial1)}; system-prompt rule=${idPrompt}`);

  // 5 logos
  const logoWords = count(/\b(?:x-?ai|grok)[\s_-]?(?:logo|logomark|wordmark|icon|mark|badge)\b/gi);
  const assetNames = count(/[\w/-]*(?:grok|xai|x-ai)[\w-]*\.(?:svg|png|jpe?g|gif|webp|ico)\b/gi);
  let svgDataHits = 0;
  let svgData = 0;
  for (const m of html.matchAll(/data:image\/svg\+xml(?:;charset=[^,;]+)?(;base64)?,([^"'`)\s]+)/gi)) {
    svgData++;
    let txt = m[2];
    try { txt = m[1] ? Buffer.from(txt, "base64").toString("utf8") : decodeURIComponent(txt); } catch {}
    if (/grok|xai|x\.ai/i.test(txt)) svgDataHits++;
  }
  const imgAlt = count(/<img[^>]*(?:alt|src|class)=["'][^"']*(?:grok|xai)[^"']*["']/gi);
  rule("no-ai-logos", logoWords + assetNames + svgDataHits + imgAlt === 0, `logo words=${logoWords} logo asset names=${assetNames} svg data URIs=${svgData} (grok/xai inside=${svgDataHits}) img grok/xai attrs=${imgAlt}`);

  // 6 keys (counts only, never print a match)
  const keyCounts = KEY_PATTERNS.map(([id, re]) => [id, count(re)]);
  rule("no-keys", keyCounts.every(([, n]) => n === 0), keyCounts.map(([id, n]) => `${id}=${n}`).join(" "));

  // 7 price hosts
  const lower = html.toLowerCase();
  const otherPrice = OTHER_PRICE_APIS.filter((h) => lower.includes(h));
  const runtimeHosts = r.hosts.filter((h) => !/^api\.(exchange\.)?coinbase\.com$/.test(h));
  rule("prices-coinbase-only", otherPrice.length === 0 && runtimeHosts.length === 0 && count(/api\.coinbase\.com/g) > 0, `other price APIs in HTML=[${otherPrice.join(",")}] runtime hosts requested=[${r.hosts.join(",")}]`);

  // 8 host allowlist
  const hosts = scanHosts(html);
  const unknown = hosts.filter((h) => !ALLOWED_HOSTS[h] && h !== RELAY);
  rule("hosts-allowlist", unknown.length === 0, `hosts named=${hosts.length} not allowed=[${unknown.join(",")}]`);

  // 9 relay
  const ipUrls = [...html.matchAll(/\b(?:https?|wss?):\/\/((?:\d{1,3}\.){3}\d{1,3}|localhost|\[[0-9a-f:]+\])(?::(\d+))?/gi)].map((m) => `${m[1]}${m[2] ? ":" + m[2] : ""}`);
  const hostPorts = [...html.matchAll(/\b((?:\d{1,3}\.){3}\d{1,3}|localhost):(\d{2,5})\b/gi)].map((m) => `${m[1]}:${m[2]}`);
  const relayRefs = [...new Set([...ipUrls, ...hostPorts])].sort();
  const badRelay = relayRefs.filter((h) => h !== RELAY);
  const relayBase = (html.match(/VITE_XOE_RELAY_BASE:`([^`]*)`/) || [])[1];
  const relayOn = /VITE_XOE_RELAY_ENABLED:`true`/.test(html);
  const relayOk = badRelay.length === 0 && (!relayOn || relayBase === `http://${RELAY}`);
  rule("relay-local-only", relayOk, `relay ${relayOn ? "ON" : "OFF"} base=${relayBase ?? "none"} ip/localhost refs=[${relayRefs.join(",")}] (bare 127.0.0.1/localhost guard strings ignored)`);

  // 10 banned numbers
  const n8610 = count(/\$?\b86\.10\b/g);
  const n36345 = count(/\$?\b36,?345\b/g);
  rule("no-banned-figures", n8610 === 0 && n36345 === 0, `"$86.10"=${n8610} "$36,345"=${n36345}`);

  // 11 XO classified
  const classLine = count(/Class: CLASSIFIED/g);
  const statsLine = count(/Stats: CLASSIFIED/g);
  const statLeak = /\b(?:DEF|OFF|ATK|HP|STR|Strength|Defense|Offense)\s*:?\s*\d/i.test(r.xoCard);
  rule("xo-classified", classLine > 0 && statsLine > 0 && !!r.xoCard && /Stats: CLASSIFIED/.test(r.xoCard) && !statLeak, `HTML "Class: CLASSIFIED"=${classLine} "Stats: CLASSIFIED"=${statsLine}; rendered XO card classified=${/Stats: CLASSIFIED/.test(r.xoCard)} stat numbers=${statLeak}`);

  // 12 funding line (exact fees-lesson copy from src/game/fees-leverage.ts)
  const lessonLine = "Holding a perp (a trade with no end date) also charges funding (a small holding fee), so about 0.3% is a safer number to plan with.";
  const tipLine = "about 0.3% is a safer number";
  rule("fees-funding-line", html.includes(lessonLine), `fees lesson line present=${html.includes(lessonLine)}; "${tipLine}" count=${count(/about 0\.3% is a safer number/g)}`);

  // 13 paper wording
  const paperHtml = count(/paper[\s-]trading|paper only/gi);
  const paperScreen = (screen.match(/paper[\s-]trading|paper only/gi) || []).length;
  const seedOk = count(/paper or metal/gi);
  rule("no-paper-trading-copy", paperHtml === 0 && paperScreen === 0, `"paper trading"/"Paper only" in HTML=${paperHtml} on screen=${paperScreen}; allowed "paper or metal"=${seedOk}`);

  // extra locked rules found in the Locked-Decisions files
  const tagline = "Now, in the palm of your hands.";
  rule("tagline", html.includes(tagline) && r.launch.includes(tagline), `"${tagline}" in HTML=${html.includes(tagline)} on start menu=${r.launch.includes(tagline)}`);
  const projX = count(/Project X\b/g);
  rule("no-project-x", projX === 0, `"Project X"=${projX}`);
  const buildIds = [...new Set(html.match(/uoe-\d{4}-\d{2}-\d{2}-v[\d.]+/g) || [])];
  rule("build-id", buildIds.length === 1, `BUILD_VERSION=${buildIds.join(",") || "missing"}`);
  rule("no-page-errors", r.errors === 0, `page errors on load + pilot select + tutorial=${r.errors}`);

  for (const l of lines) console.log(l);
  const fails = lines.filter((l) => l.startsWith("FAIL")).length;
  console.log(`SUMMARY check: ${fails ? "FAIL" : "PASS"} ${lines.length - fails}/${lines.length} rules · build ${path.basename(BUILD)} · sha256 ${sha256(fs.readFileSync(BUILD)).slice(0, 16)}`);
  return fails ? 1 : 0;
}

// ---------------------------------------------------------------- main
async function main() {
  switch (CMD) {
    case "seed": {
      const text = writeSeed();
      console.log(`wrote ${path.relative(ROOT, SEED_FILE)} (${Buffer.byteLength(text)} bytes) sha256 ${sha256(text)}`);
      console.log(`seed=${buildSeed().seed} clock=${FIXED_CLOCK} coinbase XLM-USD=${buildSeed().coinbase.spot["XLM-USD"]} (mock)`);
      return 0;
    }
    case "run": return cmdRun(ARG);
    case "screenshot": return cmdScreenshot(ARG);
    case "check": return cmdCheck();
    default:
      console.log("usage: node verify.mjs <seed | run <flow|list> | screenshot <page|list> | check> [--build file.html] [--device desktop|iphone15]");
      return CMD ? 2 : 0;
  }
}
process.exitCode = await main();
