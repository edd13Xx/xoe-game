#!/usr/bin/env node
/** Local check of the chart timeframe row on the XOE trade desk (sim, testnet XOE, no real money). */
import fs from "node:fs"
import assert from "node:assert/strict"
process.env.XOE_REVIEW_LIBRARY = "1"
const { openGame, closeGame, pressName, wait } = await import("./review-v19.mjs")
const OUT = process.env.TF_MEDIA_DIR || "review"
fs.mkdirSync(OUT, { recursive: true })
const IDS = ["1m", "5m", "15m", "30m", "1h", "4h", "1D", "1W", "1mo"]
const NAMES = ["1 minute", "5 minutes", "15 minutes", "30 minutes", "1 hour", "4 hours", "1 day", "1 week", "1 month"]
const shotAt = { portrait: "4h", landscape: "1W", desktop: "1mo" }
const results = []
for (const device of ["portrait", "landscape", "desktop"]) {
  const s = await openGame({ device })
  const rec = { device, frames: {} }
  try {
    assert.equal(await pressName(s, "XOE trade desk"), true)
    await wait(s, 3000)
    const page = s.page
    await page.locator("[data-testid=pro-desk]").waitFor({ state: "visible", timeout: 5000 })
    const tabs = page.locator(".pd-tabs")
    const showPanel = async (name) => { const t = tabs.getByRole("tab", { name, exact: true }); if (await t.isVisible().catch(() => false)) await t.click() }
    await showPanel("Chart")
    const row = page.locator("[data-testid=pd-timeframes]")
    assert.equal(await row.getAttribute("aria-label"), "Chart timeframe")
    const btns = row.locator("button")
    assert.equal(await btns.count(), IDS.length)
    for (let i = 0; i < IDS.length; i++) {
      const b = btns.nth(i)
      assert.equal(await b.getAttribute("aria-label"), NAMES[i])
      const box = await b.boundingBox()
      assert.ok(box.height >= 43.5 && box.width >= 43.5, `${device} ${IDS[i]} target ${box.width}x${box.height}`)
    }
    rec.rowWidth = (await row.boundingBox()).width
    rec.overflowX = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
    assert.equal(rec.overflowX, false, `${device} page overflows horizontally`)
    for (let i = 0; i < IDS.length; i++) {
      await btns.nth(i).click()
      await wait(s, 250)
      assert.equal(await btns.nth(i).getAttribute("aria-pressed"), "true")
      assert.equal(await row.locator("[aria-pressed=true]").count(), 1)
      const candles = await page.locator(".pd-candle").count()
      assert.ok(candles >= 8, `${device} ${IDS[i]} only ${candles} candles`)
      const ind = await page.locator(".pd-ind path").count()
      const label = await page.locator("svg[data-snl-chart]").getAttribute("aria-label")
      rec.frames[IDS[i]] = { candles, indicatorPaths: ind, axisSample: await page.locator("svg[data-snl-chart] text.pd-axis").last().innerText().catch(() => "") }
      assert.equal(ind, 3, `${device} ${IDS[i]} EMA/VWAP lines`)
      assert.match(label, /EMA 9/)
      if (IDS[i] === shotAt[device]) {
        await row.evaluate((el) => el.scrollIntoView({ block: "center" }))
        await wait(s, 200)
        await page.screenshot({ path: `${OUT}/chart-timeframes-${device}-${IDS[i] === "1mo" ? "1M" : IDS[i]}.png` })
      }
    }
    // Price tap-to-fill still works on a long frame, and the coach is still there.
    await btns.nth(IDS.indexOf("4h")).click()
    await showPanel("Book")
    const bid = page.locator("[data-testid=order-book]").locator(".ob-row.bid").nth(2)
    const px = (await bid.locator(".ob-px").innerText()).trim()
    await bid.click()
    await wait(s, 150)
    assert.equal(await page.getByLabel("Limit price").inputValue(), px.replace(/,/g, ""), `${device} tap-to-fill`)
    rec.tapToFill = true
    assert.equal(await page.locator("[data-testid=pd-coach]").count(), 1)
    rec.coach = await page.locator("[data-testid=pd-coach]").getAttribute("data-source")
    rec.errors = []
  } catch (e) { rec.errors = [String(e.message || e)] }
  await closeGame(s)
  results.push(rec)
  console.log(JSON.stringify(rec))
}
fs.writeFileSync(`${OUT}/timeframes-v19.json`, JSON.stringify(results, null, 2))
if (results.some((r) => r.errors.length)) { console.error("FAIL"); process.exit(1) }
console.log("PASS")
