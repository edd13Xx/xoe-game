#!/usr/bin/env node
/** Local-only check of EMA 9 / EMA 21 / VWAP chart lines on the XOE trade desk (sim candles, testnet XOE, no real money). */
import fs from "node:fs"
process.env.XOE_REVIEW_LIBRARY = "1"
const { openGame, closeGame, pressName, wait } = await import("./review-v19.mjs")
const out = {}
let failed = false
for (const device of ["portrait", "landscape", "desktop"]) {
  const s = await openGame({ device })
  const rec = { device }
  try {
    if (!(await pressName(s, "XOE trade desk"))) throw new Error("cannot open trade desk")
    await wait(s, 3000)
    const page = s.page
    const desk = page.locator("[data-testid=pro-desk]")
    await desk.waitFor({ state: "visible", timeout: 5000 })
    const chart = page.locator("svg[data-snl-chart]")
    const btn = page.getByRole("button", { name: "Show EMA 9, EMA 21 and VWAP lines" })
    rec.btnVisible = await btn.isVisible()
    rec.btnPressed = await btn.getAttribute("aria-pressed")
    rec.indOn = await chart.getAttribute("data-indicators")
    rec.paths = await page.locator(".pd-ind path").evaluateAll((ps) => ps.map((p) => (p.getAttribute("d") || "").length))
    rec.legend = await page.locator(".pd-ohlc").innerText()
    rec.trend = await page.locator(".pd-trend").getAttribute("data-trend")
    rec.aria = await chart.getAttribute("aria-label")
    await chart.scrollIntoViewIfNeeded()
    await page.screenshot({ path: `review/run-indicators-${device}.png` })
    rec.toolbarOverflow = await page.locator(".pd-chart-panel .pd-toolbar").evaluate((el) => el.scrollWidth > el.clientWidth + 1)
    rec.btnBox = await btn.boundingBox()
    await btn.click()
    await wait(s, 200)
    rec.offState = await chart.getAttribute("data-indicators")
    rec.offPaths = await page.locator(".pd-ind path").count()
    await btn.click()
    await wait(s, 200)
    rec.backOn = await chart.getAttribute("data-indicators")
    rec.overflowX = await page.evaluate(() => {
      const sheet = document.querySelector(".drawer-sheet")
      return sheet ? sheet.scrollWidth > sheet.clientWidth + 1 : true
    })
    const text = await page.locator(".drawer-sheet").innerText()
    rec.noXrp = !/xrp/i.test(text)
    rec.simLabel = /no real money/i.test(text)
    const bad = !rec.btnVisible || rec.btnPressed !== "true" || rec.indOn !== "1" || rec.paths.length !== 3 || rec.paths.some((n) => n < 20) ||
      !/EMA 9/.test(rec.legend) || !/VWAP/.test(rec.legend) || !/EMA 21/.test(rec.aria || "") || rec.offState !== "0" || rec.offPaths !== 0 ||
      rec.backOn !== "1" || rec.toolbarOverflow || rec.overflowX || !rec.noXrp || !rec.simLabel || (rec.btnBox && rec.btnBox.height < 34)
    if (bad) failed = true
  } catch (e) {
    rec.failure = String(e)
    failed = true
    await s.page.screenshot({ path: `review/run-indicators-${device}-failure.png` }).catch(() => {})
  }
  rec.errors = s.errors
  if (s.errors?.length) failed = true
  await closeGame(s)
  out[device] = rec
  console.log(JSON.stringify(rec))
}
fs.writeFileSync("review/indicators.json", JSON.stringify(out, null, 2))
if (failed) process.exitCode = 1
