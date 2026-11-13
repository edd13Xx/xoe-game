#!/usr/bin/env node
/** Local-only check of stop (breakout) entry orders on the XOE trade desk (sim, testnet XOE, no real money). */
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
    await page.getByRole("tab", { name: "Buy", exact: true }).click()
    await page.locator("[data-testid=pd-otype-stop]").click()
    rec.stopPressed = await page.locator("[data-testid=pd-otype-stop]").getAttribute("aria-pressed")
    const mark = Number(await desk.getAttribute("data-mark"))
    rec.mark = mark
    await page.getByLabel("Amount in XOE").fill("0.5")
    // Wrong side first: a buy stop below the market must be refused.
    await page.locator("[data-testid=pd-stop-px]").fill((mark * 0.95).toFixed(3))
    await page.locator("[data-testid=pd-submit]").click()
    await wait(s, 200)
    rec.wrongSideMsg = await page.locator(".pd-msg").innerText().catch(() => "")
    const trigger = (mark * 1.05).toFixed(3)
    await page.locator("[data-testid=pd-stop-px]").fill(trigger)
    rec.hint = await page.locator(".pd-hint").innerText().catch(() => "")
    await page.locator("[data-testid=pd-submit]").click()
    await wait(s, 300)
    rec.placedMsg = await page.locator(".pd-msg").innerText().catch(() => "")
    rec.sideAfter = await desk.getAttribute("data-side")
    await page.getByRole("tab", { name: /^Open orders/ }).click()
    await wait(s, 150)
    rec.openRows = await page.locator("[aria-label='Open sim orders'] li").allInnerTexts()
    const seg = page.locator("[data-testid=pd-otype-stop]")
    await seg.evaluate((el) => el.scrollIntoView({ block: "center" }))
    await wait(s, 300)
    rec.segBox = await seg.boundingBox()
    await page.screenshot({ path: `review/run-stop-${device}.png` })
    rec.overflowX = await page.evaluate(() => {
      const sheet = document.querySelector(".drawer-sheet")
      return sheet ? sheet.scrollWidth > sheet.clientWidth + 1 : true
    })
    const text = await page.locator(".drawer-sheet").innerText()
    rec.noXrp = !/xrp/i.test(text)
    rec.simLabel = /no real money/i.test(text)
    const bad =
      rec.stopPressed !== "true" || !/above the market/.test(rec.wrongSideMsg) || !/Stop order placed/.test(rec.placedMsg) || !/waits above/.test(rec.hint) ||
      rec.sideAfter === "long" || !rec.openRows.some((r) => /Buy\s+Stop/.test(r) && r.includes(trigger)) || !rec.segBox || rec.segBox.height < 34 ||
      rec.overflowX || !rec.noXrp || !rec.simLabel
    if (bad) failed = true
  } catch (e) {
    rec.failure = String(e)
    failed = true
    await s.page.screenshot({ path: `review/run-stop-${device}-failure.png` }).catch(() => {})
  }
  rec.errors = s.errors
  if (s.errors?.length) failed = true
  await closeGame(s)
  out[device] = rec
  console.log(JSON.stringify(rec))
}
fs.writeFileSync("review/stop.json", JSON.stringify(out, null, 2))
if (failed) process.exitCode = 1
