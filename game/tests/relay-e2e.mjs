/**
 * v18 game <-> local phone relay <-> fake Grok Bot (all on 127.0.0.1). No real webhook, no real keys.
 *   node tests/relay-e2e.mjs <build.html> <out-dir>
 * Needs /workspace/xoe-phone-relay/scripts/run-local.sh running.
 */
import { chromium } from "playwright"
import { pathToFileURL } from "node:url"
import { mkdirSync } from "node:fs"

const [build, out] = process.argv.slice(2)
mkdirSync(out, { recursive: true })
const url = pathToFileURL(build).href
const results = []
const browser = await chromium.launch()

async function run(name, { tester = "xoe-local-test", grokOn = true, blockRelay = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const relayCalls = []
  ctx.on("request", (r) => {
    if (r.url().includes("127.0.0.1:18791")) relayCalls.push(`${r.method()} ${new URL(r.url()).pathname}`)
  })
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort()) // nothing off this computer
  if (blockRelay) await ctx.route(/127\.0\.0\.1:18791/, (r) => r.abort())
  await ctx.addInitScript(([t, on]) => {
    localStorage.setItem("xoe.voiceReminder.v1", JSON.stringify({ dontRemind: true }))
    if (t) localStorage.setItem("xoe.relayTesterCode.v1", t)
    localStorage.setItem("xoe.grokConnect.v1", JSON.stringify({ enabled: on, apiKey: "" }))
  }, [tester, grokOn])
  const page = await ctx.newPage()
  await page.goto(url)
  await page.getByRole("button", { name: "Ask XOE" }).first().click()
  await page.getByLabel("Ask XOE question").fill("How do I earn XOE coins?")
  await page.getByRole("button", { name: "Ask", exact: true }).click()
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${out}/v18-relay-${name}-waiting.png` })
  const reply = page.locator(".ask-grok-reply")
  await reply.waitFor({ timeout: 30_000 })
  const source = await reply.getAttribute("data-brain")
  const text = (await reply.innerText()).replace(/\s+/g, " ")
  await page.screenshot({ path: `${out}/v18-relay-${name}.png` })
  results.push({ name, source, relayCalls: relayCalls.length, sample: text.slice(0, 140) })
  await ctx.close()
}

await run("grok-bot-reply")
await run("grok-off", { grokOn: false })
await run("no-tester-code", { tester: "" })
await run("relay-down", { blockRelay: true })
await run("bad-tester-code", { tester: "wrong-code" })
await browser.close()
console.log(JSON.stringify(results, null, 2))
const want = { "grok-bot-reply": "grok-bot", "grok-off": "backup-ai", "no-tester-code": "backup-ai", "relay-down": "backup-ai", "bad-tester-code": "backup-ai" }
const bad = results.filter((r) => r.source !== want[r.name] || ((r.name === "grok-off" || r.name === "no-tester-code") && r.relayCalls > 0))
if (bad.length) {
  console.error("FAIL", bad)
  process.exit(1)
}
console.log(`PASS ${results.length}/${results.length}`)
