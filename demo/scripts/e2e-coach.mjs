// End-to-end check of the Grok coach path through the real game build, WITHOUT any real xAI key or network:
//   mock xAI server <- demo server (XAI_API_KEY=mock) <- demo page <- game iframe (XOE trade desk coach)
// Case A (key set): coach panel shows "Grok Bot coach (sim)" with the mock text.
// Case B (no key):  coach panel keeps the rule-based tip ("Grok Bot tip (sim)"). Never touches the testnet.
import http from "node:http";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(new URL("../../game/package.json", import.meta.url));
const { chromium } = require("playwright");

const MOCK_TEXT = "Mock Grok: keep your stop small and your size smaller.";
let sawAuth = null, sawBody = null;
const mock = http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
    sawAuth = req.headers.authorization; sawBody = JSON.parse(b || "{}");
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { content: MOCK_TEXT } }] }));
  });
}).listen(4501, "127.0.0.1");

const startDemo = (port, env) => new Promise((ok) => {
  const p = spawn("node", ["server.mjs"], { cwd: new URL("..", import.meta.url).pathname, env: { ...process.env, PORT: String(port), XAI_API_KEY: "", ...env } });
  p.stdout.on("data", (d) => /on http/.test(String(d)) && ok(p));
});

async function run(port) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`http://127.0.0.1:${port}/`);
  const frame = page.frameLocator("#game");
  await frame.getByRole("button", { name: "XOE trade desk", exact: true }).click();
  const coach = frame.locator("[data-testid=pd-coach]");
  await coach.waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(3500); // 700 ms debounce + mock round trip
  const out = { source: await coach.getAttribute("data-source"), label: await coach.locator(".pd-coach-k").innerText(), text: await frame.locator("[data-testid=pd-coach-text]").innerText(), pill: await page.locator("#coachPill").innerText() };
  await page.screenshot({ path: new URL(`../../media/coach-${out.source}.png`, import.meta.url).pathname });
  await browser.close();
  return out;
}

let failed = false;
try {
  const withKey = await startDemo(4502, { XAI_API_KEY: "mock-key", XAI_BASE_URL: "http://127.0.0.1:4501" });
  const a = await run(4502); withKey.kill();
  console.log("A (key set)", JSON.stringify(a));
  assert.equal(a.source, "grok"); assert.equal(a.text, MOCK_TEXT); assert.equal(a.label, "Grok Bot coach (sim)");
  assert.equal(sawAuth, "Bearer mock-key"); assert.match(sawBody.messages[1].content, /state: planning-order/);
  const noKey = await startDemo(4503, {});
  const b = await run(4503); noKey.kill();
  console.log("B (no key) ", JSON.stringify(b));
  assert.equal(b.source, "rules"); assert.equal(b.label, "Grok Bot tip (sim)"); assert.match(b.pill, /off/);
  console.log("PASS");
} catch (e) { failed = true; console.error("FAIL", e.message); }
mock.close(); process.exit(failed ? 1 : 0);
