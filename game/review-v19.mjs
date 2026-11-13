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
async function openGame({ device = "desktop", xai = null, seed = loadSeed(), query = "", browserName = process.env.XOE_BROWSER || "chromium", url = null, serviceWorkers = "block", recordDir = null, viewport = null } = {}) {
  if (!url && !fs.existsSync(BUILD)) throw new Error(`build not found: ${BUILD}`);
  const lib = await pw();
  const phone = device !== "desktop";
  // v19 WebKit pass: browserName "webkit" uses Playwright's real WebKit engine (Safari's engine).
  // "iphone15" / "iphone15-landscape" use Playwright's "iPhone 15" descriptors (393x659 / 734x320, touch, Safari UA).
  const engine = browserName === "webkit" ? lib.webkit : lib.chromium;
  const browser = await engine.launch({ headless: true });
  const iphone = device === "iphone15" ? lib.devices["iPhone 15"] : device === "iphone15-landscape" ? lib.devices["iPhone 15 landscape"] : null;
  const rec = recordDir ? { recordVideo: { dir: recordDir, size: viewport || { width: 1280, height: 800 } } } : {};
  const context = iphone
    ? await browser.newContext({ ...iphone, reducedMotion: "no-preference", serviceWorkers })
    : phone
    ? await browser.newContext({ viewport: device === "landscape" ? {width:844,height:390} : {width:390,height:844}, hasTouch:true, isMobile:browserName !== "firefox", deviceScaleFactor:1, reducedMotion: "no-preference", serviceWorkers })
    : await browser.newContext({ viewport: viewport || { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: "no-preference", serviceWorkers, ...rec });
  const net = { coinbase: 0, xai: 0, blocked: [], hosts: new Set() };
  await context.route(/^(https?|wss?):/, async (route) => {
    const url = route.request().url();
    // Local review server only (http://127.0.0.1:<port>) serves the built dist/ PWA; never a public host.
    if (/^http:\/\/127\.0\.0\.1(:\d+)?\//.test(url)) return route.continue();
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
  await page.goto((url || pathToFileURL(BUILD).href) + query, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(900);
  const s = { browser, context, page, net, errors, phone, device, browserName };
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
    if (ph === "colony-map") break;
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
  const res = { bought: false, sold: false, label: false, paperWord: false, hasDock: false };
  const body = await bodyText(s);
  res.label = /sim price|testnet|no real money/i.test(body);
  res.paperWord = /paper trading|paper only/i.test(body);
  res.hasDock = await s.page.locator(".live-trade-dock").isVisible().catch(() => false);
  if ((await phaseOf(s)) === "colony-map") {
    await closeTradeResult(s);
    return res;
  }
  const buy = s.page.getByRole("button", { name: /Buy XOE/i });
  if (await press(s, buy)) { res.bought = true; await wait(s, 1200); }
  const sell = s.page.getByRole("button", { name: /Sell XOE/i });
  if (await press(s, sell)) { res.sold = true; await wait(s, 400); }
  await dismissReminder(s);
  await closeTradeResult(s);
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

async function closeTradeResult(s) {
  for (let i = 0; i < 5; i++) {
    const close = s.page.locator(".trade-result-close, [aria-label='Close trade result']");
    if (!(await close.count())) break;
    await close.first().click({ force: true }).catch(() => {});
    await wait(s, 150);
  }
}

async function closeChapterCard(s) {
  const ch = s.page.locator(".chapter-overlay");
  if (await ch.isVisible().catch(() => false)) await press(s, ch.getByRole("button", { name: "Continue", exact: true }));
  await wait(s, 400);
  await dismissReminder(s);
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



// User-visible old title: "X Orbital Engine" as words (any case). "XOE: Unknown Orbital Engine" never matches
// (the lookbehind skips "Unknown Orbital Engine"; \b before X needs a word start).

// Code identifiers (x-orbital-engine, X_Orbital_Engine, XOrbitalEngine): counted and reported, but not a FAIL —
// they never render as text. Documented in VERIFY.md.

// Every host the build may name. Anything else is a FAIL (prices or relays sneaking in).

// ---------------------------------------------------------------- main

if (!process.env.XOE_REVIEW_LIBRARY) {
const reviewDevices=(process.env.REVIEW_DEVICES||"desktop,portrait,landscape").split(",");
const results=process.env.REVIEW_DEVICES && fs.existsSync('review/runtime-v19.json') ? JSON.parse(fs.readFileSync('review/runtime-v19.json','utf8')).filter(r=>!reviewDevices.includes(r.device)) : [];
for (const device of reviewDevices) {
 const s=await openGame({device}); const r={device,steps:[],errors:[],network:{}};
 const shot=async(name)=>{ await s.page.screenshot({path:path.join(ROOT,'review',`${device}-${name}.png`),fullPage:false}) };
 try {
  await s.page.evaluate(()=>window.scrollTo(0,0)); await shot('front');
  r.launch=await s.page.evaluate(()=>({viewport:[innerWidth,innerHeight],width:document.documentElement.scrollWidth,nav:performance.getEntriesByType('navigation').map(n=>({dom:n.domContentLoadedEventEnd,load:n.loadEventEnd})),targets:[...document.querySelectorAll('button,input[type=password],input[type=range]')].filter(el=>el.getBoundingClientRect().width&&el.getBoundingClientRect().height).map(el=>({label:el.textContent?.trim().slice(0,40)||el.getAttribute('aria-label')||el.type,w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height}))}));
  await pressName(s,'FAQ');await wait(s,100);
  r.faq={questions:await s.page.locator('[data-faq-panel] [data-faq-question]').count(),askButtons:await s.page.locator('[data-faq-panel] .faq-ask').count(),groups:await s.page.locator('[data-faq-panel] .faq-section h3').allTextContents()};
  await s.page.locator('.drawer-close').focus();await s.page.keyboard.press('Shift+Tab');
  r.faq.backwardWrap=await s.page.evaluate(()=>document.activeElement?.tagName==='SUMMARY');
  r.faq.keyboardContained=true;for(let i=0;i<45;i++){await s.page.keyboard.press('Tab');if(!await s.page.evaluate(()=>!!document.querySelector('.drawer-sheet')?.contains(document.activeElement)))r.faq.keyboardContained=false}
  await shot('faq');
  const firstQuestion=s.page.locator('[data-faq-panel] [data-faq-question]').first();
  await press(s,firstQuestion.locator('summary'));await press(s,firstQuestion.locator('.faq-ask'));await wait(s,100);
  r.faq.prefill=await s.page.getByRole('textbox',{name:'Ask XOE question'}).inputValue();
  await shot('faq-ask');await pressName(s,'Close');await wait(s,100);
  await s.page.emulateMedia({reducedMotion:'reduce'});await wait(s,50);
  r.reducedCover=await s.page.locator('.orbital-cover .orbital-star,.orbital-cover .orbital-xo').evaluateAll(nodes=>nodes.length>0&&nodes.every(n=>getComputedStyle(n).animationName==='none'));
  await s.page.evaluate(()=>document.querySelector('.xo-menu-sheet')?.scrollTo(0,0));await shot('front-reduced-motion');await s.page.emulateMedia({reducedMotion:'no-preference'});
  r.setup=await setupPilot(s); await shot('setup-story');
  r.story=await walkStory(s);
  r.practice=await practiceDesk(s);
  r.map=await toMap(s); await closeChapterCard(s); await closeTradeResult(s);
  await s.page.evaluate(()=>window.scrollTo(0,0)); await shot('map');
  r.layout=await s.page.evaluate(()=>({height:innerHeight,docH:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth,map:[...document.querySelectorAll('.mars-world-shell,.live-trade-dock,.enter-prompt,.enter-chip')].map(el=>({class:el.className,rect:el.getBoundingClientRect().toJSON()}))}));
  r.coverage=await s.page.evaluate(()=>{
   const shell=document.querySelector('.mars-world-shell'),box=shell?.getBoundingClientRect();if(!box)return null;
   const rects=[...shell.querySelectorAll('.minimap-hud,.map-econ,.map-trade,.enter-prompt,.map-fight-btn')].map(el=>el.getBoundingClientRect()).filter(r=>r.width&&r.height).map(r=>({l:Math.max(box.left,r.left),r:Math.min(box.right,r.right),t:Math.max(box.top,r.top),b:Math.min(box.bottom,r.bottom)})).filter(r=>r.r>r.l&&r.b>r.t);
   const xs=[...new Set(rects.flatMap(r=>[r.l,r.r]))].sort((a,b)=>a-b);let area=0;
   for(let i=1;i<xs.length;i++){const ys=rects.filter(r=>r.l<xs[i]&&r.r>xs[i-1]).map(r=>[r.t,r.b]).sort((a,b)=>a[0]-b[0]);let total=0,end=-Infinity;for(const [lo,hi] of ys){total+=Math.max(0,hi-Math.max(lo,end));end=Math.max(end,hi)}area+=(xs[i]-xs[i-1])*total}
   let panelOverlapCount=0;for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const a=rects[i],b=rects[j];if(Math.min(a.r,b.r)-Math.max(a.l,b.l)>.5&&Math.min(a.b,b.b)-Math.max(a.t,b.t)>.5)panelOverlapCount++}
   return {share:area/(box.width*box.height),panelOverlapCount,rectangles:rects,includes:'mini-map + economy HUD + trade HUD + Enter; chapter dialog dismissed'}
  });
  r.mapControls=await s.page.evaluate(()=>{
   const buttons=[...document.querySelectorAll('.mars-world-shell button')].map(el=>({label:el.getAttribute('aria-label')||el.textContent?.trim(),rect:el.getBoundingClientRect().toJSON()})).filter(b=>b.rect.width&&b.rect.height);
   const overlaps=[];for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++){const a=buttons[i],b=buttons[j];if(Math.min(a.rect.right,b.rect.right)-Math.max(a.rect.left,b.rect.left)>.5&&Math.min(a.rect.bottom,b.rect.bottom)-Math.max(a.rect.top,b.rect.top)>.5)overlaps.push([a.label,b.label])}
   return {buttons,overlaps,undersized:buttons.filter(b=>b.rect.width<47.99||b.rect.height<47.99)}
  });
  r.frames=await s.page.evaluate(()=>new Promise(resolve=>{const intervals=[];let prev=performance.now(),begin=prev;function tick(now){intervals.push(now-prev);prev=now;if(now-begin>=2000){const v=intervals.slice(1).sort((a,b)=>a-b);resolve({count:v.length,p95:v[Math.floor(v.length*.95)],over34:v.filter(x=>x>34).length})}else requestAnimationFrame(tick)}requestAnimationFrame(tick)}));
  if(r.map){
   await pressName(s,'Full Map'); await wait(s,300); await shot('full-map');
   r.destinations=await s.page.locator('.full-map-dome').allTextContents();
   await press(s,s.page.locator('[data-dome=wallet]'));
   await wait(s,6000);
   r.enter=await s.page.locator('.enter-prompt').allTextContents();
   r.entered=await press(s,s.page.locator(s.phone ? '.enter-chip' : '.enter-prompt button').first()); await wait(s,500);
   await shot('lesson'); r.lessonPhase=await phaseOf(s);
   r.gates=await s.page.locator('.arcade-gate-node').allTextContents();
   if(r.lessonPhase==='colony-lesson'){
    await pressGate(s,'Keys / access'); await wait(s,2200);
    r.afterGate=await bodyText(s);
    await pressName(s,'Back to colony map'); await wait(s,300);
   }
   r.chapterOne=[(await bodyText(s)).match(/\d+\/10 saved/)?.[0]];
   for(const [id,gate] of [['keys','Refuse. Never share'],['blocks','Hard to rewrite past']]){
    if(await phaseOf(s)!=='colony-map')break;
    await pressName(s,'Full Map');await press(s,s.page.locator(`[data-dome=${id}]`));await wait(s,6000);
    await press(s,s.page.locator(s.phone?'.enter-chip':'.enter-prompt button').first());await wait(s,300);
    await pressGate(s,gate);await wait(s,2400);
    r.chapterOne.push((await bodyText(s)).match(/\d+\/10 saved/)?.[0]||await phaseOf(s));
   }
   r.progression=(await bodyText(s)).match(/Pilot Lv \d+/)?.[0];
   if(await phaseOf(s)==='colony-map'){
    await pressName(s,'Skirmish fight'); await wait(s,200);
    await s.page.locator('.colony-fight-overlay .fight-field').scrollIntoViewIfNeeded();
    await s.page.locator('.colony-fight-overlay .fight-field').waitFor({timeout:7000});
    await shot('shield');
    r.fightBefore=await s.page.locator('.colony-fight-overlay .fight-hud').innerText();
    await openPause(s); const frozen=await s.page.locator('.colony-fight-overlay .fight-hud').innerText(); await wait(s,1400);
    r.pauseStable=frozen===await s.page.locator('.colony-fight-overlay .fight-hud').innerText();
    await pressName(s,'Resume'); await wait(s,100);
    r.fightResumed=await s.page.locator('.colony-fight-overlay .fight-hud').innerText();
    if(!s.phone){const tick=s.page.locator('.fight-tick').first();if(await tick.count()){await tick.focus();const id=await tick.getAttribute('aria-label');await s.page.keyboard.press('Enter');r.tickKeyboardRemoved=!(await s.page.getByRole('button',{name:id,exact:true}).count())}}
    const enemy=s.page.locator('.fight-enemy').first();if(await enemy.count()){await enemy.dispatchEvent('pointerdown',{pointerId:5,pointerType:s.phone?'touch':'mouse',bubbles:true});await wait(s,6000);await s.page.locator('.colony-fight-overlay .fight-field').dispatchEvent('pointerup',{pointerId:5,bubbles:true})}
    await shot('fight'); r.fightFinal=await s.page.locator('.colony-fight-overlay .fight-hud').innerText();
   }
  }
 } catch(e){r.failure=String(e);await shot('failure').catch(()=>{})}
 r.errors=s.errors;r.network={...s.net,hosts:[...s.net.hosts]};results.push(r);
 fs.writeFileSync(path.join(ROOT,'review/runtime-v19.json'),JSON.stringify(results,null,2));
 await closeGame(s);
}
console.log(JSON.stringify(results,null,2));
if(results.some(r=>r.failure||!r.reducedCover||!r.map||r.pauseStable!==true||r.errors.length||r.network.blocked.length||r.faq?.questions!==31||r.faq?.askButtons!==31||!r.faq?.prefill||!r.faq?.backwardWrap||!r.faq?.keyboardContained||r.coverage?.panelOverlapCount||r.mapControls?.overlaps.length||r.mapControls?.undersized.length||(r.device!=="desktop"&&r.coverage?.share>=.306)))process.exitCode=1;

}
export { openGame, closeGame, wait, press, pressName, phaseOf, bodyText, setupPilot, walkStory, practiceDesk, toMap, closeChapterCard, pressGate, dismissReminder, openPause };
