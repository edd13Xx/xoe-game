#!/usr/bin/env node
/** Local-only check of risk-based sizing on the XOE trade desk (sim, testnet XOE, no real money). */
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
    await page.getByLabel("Add take profit and stop loss").check()
    const risk = page.locator("[data-testid=pd-risk]")
    rec.riskVisible = await risk.isVisible()
    rec.disabledWithoutSl = await risk.locator("[data-risk='1']").isDisabled()
    rec.noteNoSl = await page.locator("[data-testid=pd-risk-note]").innerText()
    const mark = Number(await desk.getAttribute("data-mark"))
    const sl = +(mark * 0.98).toFixed(3)
    await page.getByLabel("Stop loss price").fill(String(sl))
    await wait(s, 200)
    await risk.locator("[data-risk='1']").click()
    await wait(s, 200)
    rec.amount = Number(await page.getByLabel("Amount in XOE").inputValue())
    rec.note = await page.locator("[data-testid=pd-risk-note]").innerText()
    const m = /\(([\d.]+)% of sim equity\)/.exec(rec.note)
    rec.pct = m ? Number(m[1]) : null
    rec.pctOk = rec.pct != null && rec.pct > 0 && rec.pct <= 1.15
    await risk.evaluate((el) => el.scrollIntoView({ block: "center" }))
    await wait(s, 200)
    await page.screenshot({ path: `review/run-risk-${device}.png` })
    await page.getByLabel("Stop loss price").fill(String(+(mark * 1.02).toFixed(3)))
    await wait(s, 200)
    rec.wrongSideDisabled = await risk.locator("[data-risk='1']").isDisabled()
    rec.overflowX = await page.evaluate(() => {
      const sheet = document.querySelector(".drawer-sheet")
      return sheet ? sheet.scrollWidth > sheet.clientWidth + 1 : true
    })
    const text = await page.locator(".drawer-sheet").innerText()
    rec.noXrp = !/xrp/i.test(text)
    rec.simLabel = /no real money/i.test(text)
    const bad = !rec.riskVisible || !rec.disabledWithoutSl || !/Set a stop loss/.test(rec.noteNoSl) || !(rec.amount > 0) || !rec.pctOk ||
      !rec.wrongSideDisabled || rec.overflowX || !rec.noXrp || !rec.simLabel
    if (bad) failed = true
  } catch (e) {
    rec.failure = String(e)
    failed = true
    await s.page.screenshot({ path: `review/run-risk-${device}-failure.png` }).catch(() => {})
  }
  rec.errors = s.errors
  if (s.errors?.length) failed = true
  await closeGame(s)
  out[device] = rec
  console.log(JSON.stringify(rec))
}
fs.writeFileSync("review/risk.json", JSON.stringify(out, null, 2))
if (failed) process.exitCode = 1
