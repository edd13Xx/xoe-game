#!/usr/bin/env node
/** Local-only check of the P/L trade journal tab on the XOE trade desk (sim, testnet XOE, no real money). */
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
    await page.getByRole("tab", { name: "P/L", exact: true }).click()
    await wait(s, 150)
    rec.emptyText = (await page.locator("[data-testid=pd-pnl]").innerText()).slice(0, 80)
    for (let round = 0; round < 2; round++) {
      const market = page.getByRole("tab", { name: "Market", exact: true })
      if (await market.isVisible().catch(() => false)) await market.click()
      await page.getByRole("tab", { name: "Buy", exact: true }).click()
      await page.getByLabel("Amount in XOE").fill("0.5")
      await page.locator("[data-testid=pd-submit]").click()
      await wait(s, 1500)
      await page.getByRole("tab", { name: "Positions", exact: true }).click()
      await wait(s, 150)
      await page.getByRole("button", { name: "Close position" }).click()
      await wait(s, 400)
    }
    rec.side = await desk.getAttribute("data-side")
    await page.getByRole("tab", { name: "Fills", exact: true }).click()
    await wait(s, 150)
    rec.fills = (await page.locator(".pd-rows").innerText()).replace(/\n/g, " | ")
    await page.getByRole("tab", { name: "P/L", exact: true }).click()
    await wait(s, 200)
    const pnl = page.locator("[data-testid=pd-pnl]")
    rec.trades = await pnl.locator("[data-pnl-trades]").innerText()
    rec.net = await pnl.locator("[data-pnl-net]").innerText()
    rec.curve = await pnl.locator(".pd-pnl-curve polyline").count()
    await pnl.evaluate((el) => el.scrollIntoView({ block: "center" }))
    await wait(s, 300)
    await page.screenshot({ path: `review/run-pnl-${device}.png` })
    rec.overflowX = await page.evaluate(() => {
      const sheet = document.querySelector(".drawer-sheet")
      return sheet ? sheet.scrollWidth > sheet.clientWidth + 1 : true
    })
    const text = await page.locator(".drawer-sheet").innerText()
    rec.noXrp = !/xrp/i.test(text)
    rec.simLabel = /no real money/i.test(text)
    const bad = rec.trades !== "2" || rec.curve !== 1 || !/net/.test(rec.fills) || rec.side !== "flat" || rec.overflowX || !rec.noXrp || !rec.simLabel || !/No fills yet/.test(rec.emptyText)
    if (bad) failed = true
  } catch (e) {
    rec.failure = String(e)
    failed = true
    await s.page.screenshot({ path: `review/run-pnl-${device}-failure.png` }).catch(() => {})
  }
  rec.errors = s.errors
  if (s.errors?.length) failed = true
  await closeGame(s)
  out[device] = rec
  console.log(JSON.stringify(rec))
}
fs.writeFileSync("review/pnl.json", JSON.stringify(out, null, 2))
if (failed) { console.error("review-pnl: FAIL"); process.exit(1) }
console.log("review-pnl: PASS")
