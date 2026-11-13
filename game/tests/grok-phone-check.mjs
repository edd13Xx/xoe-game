/**
 * v18.1: live Grok with a player key on an iPhone-sized WebKit page served from an https origin.
 * api.x.ai is MOCKED (page.route); the key is fake. No real key, no real xAI call.
 *   node tests/grok-phone-check.mjs <build.html> <out-dir> <label>
 */
import { webkit, devices } from "/workspace/xoe-qa/node_modules/playwright/index.mjs"
import fs from "node:fs"

const [build, out, label = "run"] = process.argv.slice(2)
const html = fs.readFileSync(build, "utf8")
const FAKE = "xai-FAKE-test-key-0000000000"
const ORIGIN = "https://xoe-phone-test.example/"
const res = { label, scenarios: {} }

const ONLY = process.env.SCEN ? process.env.SCEN.split(",") : null
async function run(name, xai) {
  if (ONLY && !ONLY.includes(name)) return
  const browser = await webkit.launch()
  const ctx = await browser.newContext({ ...devices["iPhone 15"] })
  const page = await ctx.newPage()
  const r = { xaiCalls: 0, localRelayCalls: 0, authOk: true }
  await ctx.route("**/*", async (route) => {
    const u = route.request().url()
    if (u.startsWith(ORIGIN)) return route.fulfill({ status: 200, contentType: "text/html", body: html })
    if (/127\.0\.0\.1|localhost/.test(u)) { r.localRelayCalls++; return route.abort() }
    if (u.startsWith("https://api.x.ai/")) {
      r.xaiCalls++
      try { const b = JSON.parse(route.request().postData() || "{}"); r.systemPrompt ??= (b.messages || []).find((m) => m.role === "system")?.content?.slice(0, 200) } catch {}
      if ((route.request().headers().authorization || "") !== `Bearer ${FAKE}`) r.authOk = false
      return xai(route, r.xaiCalls)
    }
    return route.abort()
  })
  await page.goto(ORIGIN)
  await page.waitForTimeout(1500)
  const box = page.locator("input[aria-label='xAI API key']").first()
  await box.fill(FAKE)
  await page.locator("button", { hasText: /Save and test/i }).first().click()
  await page.waitForTimeout(name === "slow-20s" ? 23000 : 2500)
  r.saveStatus = await page.evaluate(() => [...document.querySelectorAll("[role=status], .grok-status, .fine")].map((e) => e.textContent).filter((t) => /Grok|xAI|key/i.test(t || "")).slice(-2).join(" | "))
  await page.screenshot({ path: `${out}/${label}-${name}-save.png` })
  await page.reload()
  await page.waitForTimeout(1200)
  r.keySavedAfterReload = await page.evaluate((k) => (localStorage.getItem("xoe.grokConnect.v1") || "").includes(k), FAKE)
  r.keyBoxAfterReload = await page.locator("input[aria-label='xAI API key']").count()
  // ask from the Ask XOE panel (same brain as the Voice button)
  r.ask = await page.evaluate(async () => {
    const mod = window.__xoeBrainForQa
    return mod ? "hook" : "ui"
  })
  const before = r.xaiCalls
  // open pause menu -> Ask XOE
  const pause = page.locator("button", { hasText: /^(Pause|Menu)$/ }).first()
  if (await pause.count()) await pause.click().catch(() => {})
  await page.waitForTimeout(400)
  const askItem = page.locator("button, summary", { hasText: /^Ask XOE$/ }).first()
  if (await askItem.count()) await askItem.click().catch(() => {})
  await page.waitForTimeout(400)
  const q = page.locator("[aria-label='Ask XOE question']").first()
  r.askPanel = (await q.count()) > 0
  if (r.askPanel) {
    await q.fill("What is leverage?")
    await page.locator(".ask-grok-panel button.primary, section button.touch-btn.primary", { hasText: /Ask/ }).first().click().catch(async () => {
      await q.press("Enter")
    })
    await page.waitForTimeout(name === "slow-20s" ? 23000 : 2500)
    r.askReply = await page.evaluate(() => {
      const d = document.querySelector(".ask-grok-reply")
      return d ? { brain: d.getAttribute("data-brain"), text: d.textContent.slice(0, 400) } : null
    })
    r.panelLive = await page.evaluate(() => document.querySelector(".test-grok .live-indicator")?.textContent?.trim() || "")
    await page.screenshot({ path: `${out}/${label}-${name}-ask.png` })
    // one-tap Test Grok Bot in the panel
    const tb = page.locator(".drawer-sheet .test-grok-btn, .ask-grok-panel .test-grok-btn").last()
    r.testButtons = await page.locator(".test-grok-btn").count()
    if (await tb.count()) {
      await tb.click().catch((e) => { r.testClickError = String(e).slice(-600) })
      await page.waitForTimeout(name === "slow-20s" ? 23000 : 2500)
      r.testButton = await page.evaluate(() => document.querySelector(".test-grok-result")?.textContent?.trim() || "")
      r.panelLiveAfterTest = await page.evaluate(() => document.querySelector(".test-grok .live-indicator")?.textContent?.trim() || "")
    }
    // close the menu and read the in-game header subtitle
    await page.keyboard.press("Escape").catch(() => {})
    await page.waitForTimeout(300)
    r.headerText = await page.evaluate(() => document.querySelector(".play-topbar-id")?.textContent?.trim() || document.querySelector(".xo-menu-head")?.textContent?.trim() || "")
  }
  r.xaiCallsFromAsk = r.xaiCalls - before
  res.scenarios[name] = r
  await browser.close()
}

const ok = (route) => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ choices: [{ message: { content: "OK from mocked Grok. Leverage multiplies moves both ways." } }] }) })
await run("ok", ok)
await run("slow-20s", async (route) => { await new Promise((r) => setTimeout(r, 20000)); return ok(route) })
await run("no-credits-402-plain", (route) => route.fulfill({ status: 402, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ error: "Payment required" }) }))
await run("no-credits-403", (route) => route.fulfill({ status: 403, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ code: "permission-denied", error: "Your team has no credits or licenses yet. Purchase them at https://console.x.ai." }) }))
fs.writeFileSync(`${out}/${label}${ONLY ? "-" + ONLY.join("+") : ""}-grok-phone.json`, JSON.stringify(res, null, 2))
console.log(JSON.stringify(res, null, 1))
