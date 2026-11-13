// Captures screenshots + a screen recording of the live TESTNET demo flow (needs `npm start` running on :4400).
// Uses Playwright from ../game/node_modules. Sends real testnet transactions (attest + claim) for the next open colony.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(new URL("../../game/package.json", import.meta.url));
const { chromium } = require("playwright");
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "media");
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.DEMO_URL || "http://127.0.0.1:4400";
const browser = await chromium.launch();
const wait = (p, ms) => p.waitForTimeout(ms);

// ---- desktop: recorded run
const dctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: OUT, size: { width: 1280, height: 800 } } });
const d = await dctx.newPage();
await d.goto(BASE); await d.waitForFunction(() => document.getElementById("bal").textContent !== "…"); await wait(d, 3500);
await d.screenshot({ path: path.join(OUT, "desktop-1-start.png") });
const before = await d.textContent("#bal");
await d.click("#simBtn");
await d.waitForSelector("[data-claim]", { timeout: 60000 }); await wait(d, 1500);
await d.screenshot({ path: path.join(OUT, "desktop-2-attested.png") });
await wait(d, 1500);
await d.click("[data-claim]");
await d.waitForFunction((b) => document.getElementById("bal").textContent !== b, before, { timeout: 90000 }); await wait(d, 2500);
await d.screenshot({ path: path.join(OUT, "desktop-3-claimed.png") });
await wait(d, 2500);
const after = await d.textContent("#bal");
console.log("balance", before, "->", after);
const vpath = await d.video().path(); await dctx.close();
fs.renameSync(vpath, path.join(OUT, "demo-flow.webm"));

// ---- phone (portrait) screenshots
const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await pctx.newPage();
await p.goto(BASE); await p.waitForFunction(() => document.getElementById("bal").textContent !== "…"); await wait(p, 3000);
await p.screenshot({ path: path.join(OUT, "phone-1-demo-top.png") });
await p.evaluate(() => document.getElementById("toast").scrollIntoView()); await p.evaluate(() => window.scrollTo(0, 780)); await wait(p, 500);
await p.screenshot({ path: path.join(OUT, "phone-2-demo-chain.png") });
const g = await pctx.newPage(); await g.goto(BASE + "/game/"); await wait(g, 3500);
await g.screenshot({ path: path.join(OUT, "phone-3-game.png") });
await browser.close();
