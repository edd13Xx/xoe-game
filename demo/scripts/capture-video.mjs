// Records the REAL running game and demo page with Playwright video (no mockups) into separate scene clips.
// Needs the demo server running on :4400 (`npm start`). Scenes:
//   s0 intro (demo page) · s1 phone: mech game (fly, colony lesson, skirmish fight) · s2 desk: paper-trading desk, RSI/EMA, timeframes
//   s3 near: Grok coach on the demo page, then the NEAR testnet flow (attest -> claim -> XOE minted). The testnet transactions are real
//   (testnet only, play money). The xAI key stays on the server; this script never reads or prints it.
// Usage: node capture-video.mjs [scene ...]   (default: all)   Output: $VIDEO_WORK (default /tmp/xoe-video/clips)
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
const here = path.dirname(fileURLToPath(import.meta.url));
process.env.XOE_REVIEW_LIBRARY = "1";
const L = await import(path.join(here, "../../game/review-v19.mjs"));
const { openGame, closeGame, wait, press, pressName, phaseOf, setupPilot, toMap, closeChapterCard, dismissReminder, pressGate } = L;
const BASE = process.env.DEMO_URL || "http://127.0.0.1:4400";
const CLIPS = process.env.VIDEO_WORK || "/tmp/xoe-video/clips";
fs.mkdirSync(CLIPS, { recursive: true });

const OVERLAY = () => {
  const boot = () => {
    if (document.getElementById("xoe-vid-ui")) return;
    const root = document.createElement("div"); root.id = "xoe-vid-ui";
    root.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647";
    const cap = document.createElement("div"); cap.id = "xoe-cap";
    cap.style.cssText = "position:absolute;left:50%;transform:translateX(-50%);max-width:88%;padding:9px 18px;border-radius:12px;background:rgba(8,6,24,.86);border:1px solid rgba(167,139,250,.6);color:#fff;font:600 21px/1.25 system-ui,sans-serif;text-align:center;display:none;box-shadow:0 4px 18px rgba(0,0,0,.5)";
    const cur = document.createElement("div"); cur.id = "xoe-cur";
    cur.style.cssText = "position:absolute;width:20px;height:20px;border-radius:50%;border:3px solid #fff;background:rgba(124,92,255,.55);box-shadow:0 0 10px rgba(0,0,0,.6);transform:translate(-50%,-50%);left:-50px;top:-50px;transition:left .38s ease-out,top .38s ease-out,transform .1s";
    root.append(cap, cur); document.documentElement.appendChild(root);
    addEventListener("mousemove", (e) => { cur.style.left = e.clientX + "px"; cur.style.top = e.clientY + "px"; }, true);
    addEventListener("mousedown", () => { cur.style.transform = "translate(-50%,-50%) scale(.6)"; }, true);
    addEventListener("mouseup", () => { cur.style.transform = "translate(-50%,-50%) scale(1)"; }, true);
  };
  if (document.documentElement) boot(); else addEventListener("DOMContentLoaded", boot);
};
// Captions live on the top page; `pos` is "bottom" (default) or "top".
async function cap(s, text, pos = "bottom") {
  await s.page.evaluate(([t, p]) => {
    const el = window.top.document.getElementById("xoe-cap"); if (!el) return;
    if (!t) { el.style.display = "none"; return; }
    el.textContent = t; el.style.display = "block";
    el.style.top = p === "top" ? "10px" : "auto"; el.style.bottom = p === "top" ? "auto" : "22px";
    if (window.innerWidth < 500) el.style.font = "600 16px/1.25 system-ui,sans-serif";
  }, [text, pos]).catch(() => {});
}
async function scene(name, { url, viewport = { width: 1280, height: 720 } }) {
  const s = await openGame({ device: "desktop", url, viewport, recordDir: path.join(CLIPS, name) });
  await s.context.addInitScript(OVERLAY);
  await s.page.reload({ waitUntil: "domcontentloaded" }); await wait(s, 700);
  s.name = name; s.t0 = Date.now(); s.mark = (label) => console.log(`[${name}] ${((Date.now() - s.t0) / 1000).toFixed(1)}s ${label}`);
  return s;
}
async function end(s) {
  const v = await s.page.video().path(); await closeGame(s);
  const out = path.join(CLIPS, `${s.name}.webm`); fs.renameSync(v, out);
  console.log("clip", out, ((Date.now() - s.t0) / 1000).toFixed(1) + "s"); return out;
}
// The cursor dot eases to each new position (CSS transition), so one move + a short wait reads as a glide on the video.
const glide = async (s, x, y) => { await s.page.mouse.move(x, y); await wait(s, 430); };
async function clickEl(s, loc) {
  await loc.hover(); await wait(s, 430);
  await loc.click();
}

// ---------------------------------------------------------------- s0: demo page intro
async function s0() {
  const s = await scene("s0-intro", { url: BASE + "/" });
  await wait(s, 500);
  await cap(s, "XOE × NEAR · mech game + paper-trading simulator that teaches", "bottom");
  await s.page.waitForFunction(() => document.getElementById("bal")?.textContent !== "…", null, { timeout: 15000 }).catch(() => {});
  await wait(s, 3600);
  await end(s);
}

// ---------------------------------------------------------------- s1: phone-sized mech game (real game, 400x720)
async function s1() {
  const s = await scene("s1-phone", { url: BASE + "/game/", viewport: { width: 400, height: 720 } });
  const P = s.page;
  await cap(s, "XOE: Unknown Orbital Engine", "top"); await wait(s, 1800);
  const start = P.getByRole("button", { name: "Start", exact: true });
  await clickEl(s, start); await wait(s, 300);
  await setupPilot(s); await toMap(s); await closeChapterCard(s);
  await pressName(s, "Close trade result"); await dismissReminder(s); await closeChapterCard(s); await wait(s, 500);
  s.mark("map");
  await cap(s, "Tap the map to fly the mech", "top");
  for (const [x, y] of [[300, 420], [200, 330], [110, 440]]) { await glide(s, x, y, 12); await P.mouse.click(x, y); await wait(s, 1000); }
  await cap(s, "Open the map and fly to a colony dome", "top");
  await clickEl(s, P.getByRole("button", { name: /^Map$|Full Map/ }).first(), 10); await wait(s, 1200);
  await clickEl(s, P.locator('[data-dome="wallet"]').first(), 10); await wait(s, 5500); await dismissReminder(s);
  await P.locator("button").filter({ hasText: /^×$/ }).first().click({ timeout: 1500 }).catch(() => {});
  await wait(s, 400);
  await cap(s, "Enter a colony: the lesson is a flight", "top");
  const enter = P.locator(".enter-prompt button, button").filter({ hasText: /^Enter/ }).first();
  await enter.waitFor({ state: "visible", timeout: 8000 }).catch(async (e) => { await P.screenshot({ path: path.join(CLIPS, "debug-enter.png") }); throw e; });
  await clickEl(s, enter, 10); await wait(s, 1300);
  const lane = P.locator(".arcade-gate-node").first(); await lane.scrollIntoViewIfNeeded(); await wait(s, 1800);
  s.mark("lesson");
  await cap(s, "Fly into the right gate (Keys / access)", "top");
  await pressGate(s, "Keys / access"); await wait(s, 3200);
  s.mark("gate done " + (await phaseOf(s)));
  await dismissReminder(s); await closeChapterCard(s); await pressName(s, "Close trade result");
  // Skirmish fight
  await P.evaluate(() => window.scrollTo(0, 0)); await wait(s, 500);
  await cap(s, "Skirmish: hold on an enemy to lock on and fire", "top");
  if (!(await pressName(s, "Fight"))) await pressName(s, "Skirmish fight");
  await wait(s, 1500);
  const ships = P.locator(".colony-fight-overlay .fight-enemy-ship");
  s.mark("fight ships " + (await ships.count()));
  const field = P.locator(".colony-fight-overlay .fight-field");
  for (let i = 0; i < 6 && (await ships.count()) > 0; i++) {
    const b = await ships.first().boundingBox(); if (!b) break;
    await glide(s, b.x + b.width / 2, b.y + b.height / 2, 10);
    await P.mouse.down(); await wait(s, 1100); await P.mouse.up(); await wait(s, 150);
  }
  s.mark("fight done");
  await wait(s, 600);
  await cap(s, "");
  await end(s);
}

// ---------------------------------------------------------------- s2: the paper-trading desk (real game, desktop)
async function s2() {
  const s = await scene("s2-desk", { url: BASE + "/game/" });
  const P = s.page;
  await setupPilot(s); await toMap(s); await closeChapterCard(s);
  await pressName(s, "Close trade result"); await dismissReminder(s); await closeChapterCard(s);
  const deskBtn = P.getByRole("button", { name: /Open SNL paper trade desk/ }).first();
  await deskBtn.scrollIntoViewIfNeeded(); await clickEl(s, deskBtn); await wait(s, 1800);
  await P.locator("[data-testid=pro-desk]").waitFor({ state: "visible", timeout: 8000 });
  await cap(s, "Trading-bot simulator: paper desk on the simulated XOE price (sim · testnet · no real money)");
  await wait(s, 3000); s.mark("desk open");
  // Chart: timeframes, EMA, RSI 14, and the coach reading them (flat: no safety tip outranks the signal read)
  await cap(s, "RSI 14 and EMA 9 / 21 on the chart. The coach reads them and calls the signal (sim)");
  s.mark("coach: " + (await P.locator("[data-testid=pd-coach-text]").innerText()));
  await wait(s, 3200);
  await cap(s, "Chart timeframes: 1m · 5m · 15m · 30m · 1h · 4h · 1D · 1W · 1M");
  const row = P.locator("[data-testid=pd-timeframes]");
  for (const id of ["5m", "15m", "1h", "4h", "1W", "1mo"]) {
    await clickEl(s, row.locator(`[data-tf="${id}"]`)); await wait(s, 1300);
    s.mark("tf " + id + " rsi " + (await P.locator("[data-testid=pd-rsi-readout]").getAttribute("data-rsi")) + " | " + (await P.locator("[data-testid=pd-coach-text]").innerText()).slice(0, 70));
  }
  await clickEl(s, row.locator('[data-tf="5m"]')); await wait(s, 1500);
  // Market order fills
  await cap(s, "Market order fills instantly on the paper book (sim)");
  const amt = P.getByLabel("Amount in XOE"); await clickEl(s, amt); await amt.fill("0.5"); await wait(s, 300);
  await clickEl(s, P.locator("[data-testid=pd-submit]")); await wait(s, 1500);
  s.mark("market fill: " + (await P.locator(".pd-msg").first().innerText().catch(() => "")));
  // Limit order from the book
  await cap(s, "Tap a book level to fill the price, then place a limit order (sim)");
  const bookTab = P.locator(".pd-tabs").getByRole("tab", { name: "Book", exact: true });
  if (await bookTab.isVisible().catch(() => false)) await bookTab.click();
  await wait(s, 400);
  const bid = P.locator("[data-testid=order-book] .ob-row.bid").nth(2);
  if (await bid.count()) { await clickEl(s, bid); await wait(s, 900); await clickEl(s, P.locator("[data-testid=pd-submit]")); await wait(s, 1400); }
  s.mark("limit: " + (await P.locator(".pd-msg").first().innerText().catch(() => "")));
  const posTab = P.locator(".pd-lower-tabs").getByRole("tab", { name: /Positions/ });
  if (await posTab.count()) { await posTab.click().catch(() => {}); await wait(s, 1200); }
  await cap(s, "");
  await end(s);
}

// ---------------------------------------------------------------- s3: Grok coach on the demo page, then the NEAR testnet flow
async function s3() {
  const s = await scene("s3-near", { url: BASE + "/" });
  const P = s.page;
  await s.page.waitForFunction(() => document.getElementById("bal")?.textContent !== "…", null, { timeout: 15000 });
  const fr = P.frames().find((f) => f.url().includes("/game/"));
  const g = { ...s, page: fr, phone: false };
  await setupPilot(g); await wait(s, 600);
  await cap(s, "Demo page: the game runs in the page, the coach is a live Grok call from the server (sim)");
  await fr.getByRole("button", { name: /Open SNL paper trade desk/ }).first().click(); await wait(s, 1200);
  await P.evaluate(() => window.scrollTo(0, 140));
  for (let i = 0; i < 16; i++) { if ((await fr.locator("[data-testid=pd-coach]").getAttribute("data-source").catch(() => "")) === "grok") break; await wait(s, 500); }
  s.mark("coach source " + (await fr.locator("[data-testid=pd-coach]").getAttribute("data-source").catch(() => "")) + ": " + (await fr.locator("[data-testid=pd-coach-text]").innerText().catch(() => "")));
  await wait(s, 4200);
  // NEAR testnet flow
  await P.evaluate(() => window.scrollTo(0, 0)); await wait(s, 400);
  await cap(s, "NEAR testnet · play money: a colony win is attested on-chain");
  const before = await P.textContent("#bal");
  await clickEl(s, P.locator("#simBtn")); 
  await P.waitForSelector("[data-claim]", { timeout: 60000 }); await wait(s, 1800);
  s.mark("attested, balance " + before);
  await cap(s, "The player claims, and the rewards contract mints testnet XOE (NEP-141)");
  await clickEl(s, P.locator("[data-claim]").first());
  await P.waitForFunction((b) => document.getElementById("bal").textContent !== b, before, { timeout: 90000 });
  await wait(s, 3200);
  s.mark("claimed, balance " + (await P.textContent("#bal")));
  await cap(s, "Colony win attested → claimed → XOE minted on NEAR testnet");
  await wait(s, 2600);
  await cap(s, "");
  await end(s);
}

const all = { s0, s1, s2, s3 };
const want = process.argv.slice(2); const run = want.length ? want : Object.keys(all);
for (const k of run) await all[k]();
