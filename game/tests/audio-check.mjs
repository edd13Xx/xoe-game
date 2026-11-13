/** v18.2 audio unlock check — WebKit iPhone 15 (393x659), offline. TEST ONLY.
 * Spies on AudioContext.resume, speechSynthesis.speak, audioSession, and the silent <audio> play. */
import { webkit, devices } from "/workspace/xoe-qa/node_modules/playwright/index.mjs"
import { pathToFileURL } from "node:url"
import fs from "node:fs"
const [BUILD, OUT] = process.argv.slice(2)
const browser = await webkit.launch()
const ctx = await browser.newContext({ ...devices["iPhone 15"] })
await ctx.route("**/*", (r) => (/^https?:/.test(r.request().url()) ? r.abort() : r.continue()))
await ctx.addInitScript(() => {
  const log = (window.__audioLog = { resume: [], speak: [], play: 0, ctxStates: [] })
  const AC = window.AudioContext || window.webkitAudioContext
  if (AC) {
    const orig = AC.prototype.resume
    AC.prototype.resume = function () { log.resume.push(String(window.event?.type || "none")); return orig.call(this).then((v) => { log.ctxStates.push(this.state); return v }) }
    const C = AC
    window.__acs = []
    window.AudioContext = function (...a) { const c = new C(...a); window.__acs.push(c); return c }
    window.AudioContext.prototype = C.prototype
  }
  if (window.speechSynthesis) {
    const s = window.speechSynthesis.speak.bind(window.speechSynthesis)
    window.speechSynthesis.speak = (u) => { log.speak.push({ text: (u.text || "").slice(0, 40), vol: u.volume, lang: u.lang, ev: String(window.event?.type || "none") }); try { s(u) } catch {} }
  }
  const p = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function () { log.play++; return p.call(this).catch(() => {}) }
})
const page = await ctx.newPage()
const res = {}
await page.goto(pathToFileURL(BUILD).href)
await page.waitForTimeout(1000)
const chip = () => page.evaluate(() => { const c = document.querySelector(".xo-menu-overlay .sound-chip") || document.querySelector(".sound-chip"); return c ? { text: c.textContent.trim(), cls: c.className } : null })
res.chipBefore = await chip()
await page.screenshot({ path: `${OUT}/v18.2-audio-before-tap.png` })
const start = page.locator("button", { hasText: /^Start$/ }).first()
const b = await start.boundingBox()
await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
await page.waitForTimeout(1200)
res.chipAfter = await chip()
res.log = await page.evaluate(() => ({ ...window.__audioLog, acStates: (window.__acs || []).map((c) => c.state), audioSession: navigator.audioSession?.type ?? "n/a" }))
await page.screenshot({ path: `${OUT}/v18.2-audio-after-tap.png` })
// tap the chip -> muted, again -> on
const sc = (await page.locator(".xo-menu-overlay .sound-chip").count()) ? page.locator(".xo-menu-overlay .sound-chip").first() : page.locator(".sound-chip").first()
if (await sc.count()) {
  await sc.tap(); await page.waitForTimeout(300); res.chipMuted = await chip()
  await sc.tap(); await page.waitForTimeout(300); res.chipOnAgain = await chip()
}
res.mutedStored = await page.evaluate(() => localStorage.getItem("xoe.soundMuted.v1"))
fs.writeFileSync(`${OUT}/v18.2-audio-check.json`, JSON.stringify(res, null, 2))
console.log(JSON.stringify(res, null, 1))
await browser.close()
