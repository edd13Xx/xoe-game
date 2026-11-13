#!/usr/bin/env node
/** Local-only shots + checks of the pro-style XOE trade desk (sim, testnet XOE, no real money). */
import fs from "node:fs"
process.env.XOE_REVIEW_LIBRARY = "1"
const { openGame, closeGame, pressName, wait } = await import("./review-v19.mjs")
const tag = process.env.XOE_DESK_TAG || "run-kraken-desk"
const out = {}
let failed = false
const names = { portrait: "portrait", landscape: "landscape", desktop: "desktop" }
for (const device of ["portrait", "landscape", "desktop"]) {
  const s = await openGame({ device })
  const rec = { device }
  try {
    if (!(await pressName(s, "XOE trade desk"))) throw new Error("cannot open trade desk")
    await wait(s, 4500)
    const page = s.page
    const desk = page.locator("[data-testid=pro-desk]")
    await desk.waitFor({ state: "visible", timeout: 5000 })
    rec.header = await page.locator(".pd-head").innerText()
    rec.simLabel = (await page.locator("[data-testid=pd-sim-label]").innerText()).trim()
    rec.candles = await page.locator("[data-snl-chart] .pd-candle").count()
    rec.bodiesTall = await page.locator("[data-snl-chart] .pd-body").evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height >= 1).length)
    rec.chartBox = await page.locator(".pd-chart-box").evaluate((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)] })
    // Timeframes
    rec.tfCandles = {}
    for (const tf of ["5m", "15m", "1h", "1m"]) {
      await page.getByRole("button", { name: tf, exact: true }).first().click()
      await wait(s, 250)
      rec.tfCandles[tf] = await page.locator("[data-snl-chart] .pd-candle").count()
    }
    // Crosshair
    const svg = page.locator("[data-snl-chart]")
    await svg.scrollIntoViewIfNeeded()
    const sb = await svg.boundingBox()
    await page.mouse.click(sb.x + sb.width * 0.45, sb.y + sb.height * 0.4)
    await wait(s, 200)
    rec.crosshair = (await page.locator(".pd-cross").count()) > 0
    // Shot of chart
    if (device === "portrait") {
      await page.locator(".drawer-sheet").evaluate((el) => el.scrollTo(0, 0))
      await wait(s, 200)
      await page.screenshot({ path: `review/${tag}-portrait.png` })
    }
    // Depth toggle
    await page.getByRole("button", { name: "Depth", exact: true }).click()
    await wait(s, 500)
    rec.depth = (await page.locator("[data-depth]").count()) > 0
    rec.depthPaths = await page.locator("[data-depth] path").count()
    if (device === "portrait") await page.screenshot({ path: `review/${tag}-portrait-depth.png` })
    await page.getByRole("button", { name: "Candles", exact: true }).click()
    await wait(s, 300)
    // Book tab on phone portrait
    const bookTab = page.getByRole("tab", { name: "Book", exact: true })
    if (await bookTab.isVisible().catch(() => false)) {
      await bookTab.click()
      await wait(s, 400)
      rec.bookRows = await page.locator("[data-testid=order-book] .ob-row").count()
      await page.screenshot({ path: `review/${tag}-portrait-book.png` })
      await page.getByRole("tab", { name: "Trades", exact: true }).click()
      await wait(s, 300)
      rec.tradeRows = await page.locator("[data-testid=recent-trades] li").count()
      await page.screenshot({ path: `review/${tag}-portrait-trades.png` })
      await page.getByRole("tab", { name: "Chart", exact: true }).click()
      await wait(s, 300)
    } else {
      rec.bookRows = await page.locator("[data-testid=order-book] .ob-row").count()
      rec.tradeRows = await page.locator("[data-testid=recent-trades] li").count()
    }
    // Order form: market buy 50%, then a limit sell
    const cashBefore = await page.locator(".pd-est dd").nth(2).innerText()
    await page.getByRole("button", { name: "50%", exact: true }).click()
    rec.amountAfter50 = await page.getByLabel("Amount in XOE").inputValue()
    await page.locator("[data-testid=pd-submit]").scrollIntoViewIfNeeded()
    await page.locator("[data-testid=pd-submit]").click()
    await wait(s, 300)
    rec.afterBuy = { side: await desk.getAttribute("data-side"), msg: await page.locator(".pd-msg").innerText().catch(() => ""), availBefore: cashBefore }
    await page.getByRole("tab", { name: "Sell", exact: true }).click()
    await page.locator(".pd-order").getByRole("button", { name: "Limit", exact: true }).click()
    await page.getByLabel("Limit price").fill("1")
    await page.locator("[data-testid=pd-submit]").click()
    await wait(s, 200)
    rec.limitGuard = await page.locator(".pd-msg").innerText().catch(() => "")
    await page.locator(".pd-order").getByRole("button", { name: "Market", exact: true }).click()
    // Lower tabs
    for (const t of ["Positions", "Balances", "Fills"]) {
      await page.getByRole("tab", { name: t, exact: true }).click()
      await wait(s, 150)
    }
    await page.getByRole("tab", { name: "Positions", exact: true }).click()
    rec.positionText = (await page.locator(".pd-pos").innerText()).replace(/\n/g, " | ")
    // Final screenshots
    await page.getByRole("tab", { name: "Buy", exact: true }).click()
    if (device === "portrait") {
      await page.locator(".pd-order").evaluate((el) => el.scrollIntoView({ block: "start" }))
      await wait(s, 300)
      await page.screenshot({ path: `review/${tag}-portrait-order.png` })
    } else {
      await page.locator(".drawer-sheet").evaluate((el) => el.scrollTo(0, 0))
      await wait(s, 300)
      await page.screenshot({ path: `review/${tag}-${names[device]}.png` })
      await page.locator(".pd-lower").evaluate((el) => el.scrollIntoView({ block: "end" }))
      await wait(s, 200)
      await page.screenshot({ path: `review/${tag}-${names[device]}-lower.png` })
    }
    const vp = page.viewportSize()
    rec.overflowX = await page.evaluate(() => {
      const sheet = document.querySelector(".drawer-sheet")
      return sheet ? sheet.scrollWidth > sheet.clientWidth + 1 : true
    })
    rec.text = await page.locator(".drawer-sheet").innerText()
    rec.noXrp = !/xrp/i.test(rec.text)
    rec.simLabelOk = /sim.*testnet xoe.*no real money/i.test(rec.simLabel)
    rec.vp = vp
    const bad =
      rec.candles < 30 || rec.bodiesTall < 30 || !rec.crosshair || !rec.depth || rec.depthPaths < 4 || rec.bookRows !== 16 || rec.tradeRows < 5 ||
      rec.overflowX || !rec.noXrp || !rec.simLabelOk || rec.afterBuy.side !== "long" || !/^Limit/.test(rec.limitGuard.replace(/^A limit/, "Limit")) ||
      Object.values(rec.tfCandles).some((n) => n < 20)
    if (bad) failed = true
    delete rec.text
  } catch (e) {
    rec.failure = String(e)
    failed = true
    await s.page.screenshot({ path: `review/${tag}-${device}-failure.png` }).catch(() => {})
  }
  rec.errors = s.errors
  if (s.errors?.length) failed = true
  await closeGame(s)
  out[device] = rec
  console.log(JSON.stringify(rec))
}
fs.writeFileSync("review/kraken-desk.json", JSON.stringify(out, null, 2))
if (failed) process.exitCode = 1
