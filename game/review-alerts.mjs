#!/usr/bin/env node
/** Local-only check of sim price alerts on the XOE trade desk (sim, testnet XOE, no real money). */
import fs from "node:fs"
process.env.XOE_REVIEW_LIBRARY = "1"
const { openGame, closeGame, pressName, wait } = await import("./review-v19.mjs")
const out = {}
let failed = false
let far = 0
for (const device of ["portrait", "landscape", "desktop"]) {
  const s = await openGame({ device })
  const rec = { device }
  try {
    if (!(await pressName(s, "XOE trade desk"))) throw new Error("cannot open trade desk")
    await wait(s, 2500)
    const page = s.page
    const desk = page.locator("[data-testid=pro-desk]")
    await desk.waitFor({ state: "visible", timeout: 5000 })
    await page.getByRole("tab", { name: /^Alerts/ }).click()
    await wait(s, 150)
    const input = page.getByLabel("Alert price")
    // Guard: empty input
    await page.locator("[data-testid=pd-alert-add]").click()
    rec.guard = await page.locator(".pd-alerts .pd-msg").innerText().catch(() => "")
    // A level far above (stays live) and one just below/above the mark that must fire.
    const mark = Number(await desk.getAttribute("data-mark"))
    // A level inside the visible candle range, toward the farther 24h extreme, so it stays live.
    const ticks = (await page.locator("[data-snl-chart] text.pd-axis").evaluateAll((els) => els.map((e) => (e.textContent ?? "").trim()))).filter((t) => /^\d+\.\d+$/.test(t)).map(Number).sort((a, b) => a - b)
    const tLo = ticks[1] ?? mark, tHi = ticks[ticks.length - 2] ?? mark
    far = Math.abs(tHi - mark) > Math.abs(mark - tLo) ? tHi : tLo
    await input.fill((mark + (far - mark) * 0.9).toFixed(3))
    await page.locator("[data-testid=pd-alert-add]").click()
    await wait(s, 150)
    rec.setMsg = await page.locator(".pd-alerts .pd-msg").innerText().catch(() => "")
    rec.tabLabel = await page.getByRole("tab", { name: /^Alerts/ }).innerText()
    rec.chartAlertMarks = await page.locator("[data-snl-chart] [data-mark=alert]").count().catch(() => 0)
    if (device === "portrait") {
      await page.locator("[data-testid=pd-alerts]").evaluate((el) => el.scrollIntoView({ block: "center" }))
      await wait(s, 250)
      await page.screenshot({ path: "review/run-alerts-portrait.png" })
    }
    // Close alerts that the next tick must hit: one 0.1% above and one 0.1% below the mark.
    const m2 = Number(await desk.getAttribute("data-mark"))
    await input.fill((m2 * 1.001).toFixed(3))
    await page.locator("[data-testid=pd-alert-add]").click()
    await input.fill((m2 * 0.999).toFixed(3))
    await page.locator("[data-testid=pd-alert-add]").click()
    const toast = page.locator("[data-testid=pd-alert-toast]")
    rec.fired = await toast.waitFor({ state: "visible", timeout: 45000 }).then(() => true).catch(() => false)
    rec.toast = rec.fired ? await toast.innerText() : ""
    rec.hitRows = await page.locator("[data-alert-state=hit]").count()
    rec.liveRows = await page.locator("[data-alert-state=live]").count()
    if (device === "portrait" && rec.fired) {
      await page.locator(".drawer-sheet").evaluate((el) => el.scrollTo(0, 0))
      await wait(s, 200)
      await page.screenshot({ path: "review/run-alerts-portrait-toast.png" })
    } else if (device !== "portrait") {
      await page.screenshot({ path: `review/run-alerts-${device}.png` })
    }
    rec.overflowX = await page.evaluate(() => {
      const sheet = document.querySelector(".drawer-sheet")
      return sheet ? sheet.scrollWidth > sheet.clientWidth + 1 : true
    })
    const text = await page.locator(".drawer-sheet").innerText()
    rec.noXrp = !/xrp/i.test(text)
    rec.simLabel = /no real money/i.test(text)
    const bad = !/above 0/.test(rec.guard) || !/Alert set/.test(rec.setMsg) || !(Math.abs(far - mark) > mark * 0.004) || !/Alerts \(1\)/.test(rec.tabLabel) ||
      rec.chartAlertMarks < 1 || !rec.fired || !/sim/.test(rec.toast) || rec.hitRows < 1 || rec.liveRows < 1 ||
      rec.overflowX || !rec.noXrp || !rec.simLabel
    if (bad) failed = true
  } catch (e) {
    rec.failure = String(e)
    failed = true
    await s.page.screenshot({ path: `review/run-alerts-${device}-failure.png` }).catch(() => {})
  }
  rec.errors = s.errors
  if (s.errors?.length) failed = true
  await closeGame(s)
  out[device] = rec
  console.log(JSON.stringify(rec))
}
fs.writeFileSync("review/alerts.json", JSON.stringify(out, null, 2))
if (failed) process.exitCode = 1
