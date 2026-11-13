#!/usr/bin/env node
/** Local-only check of the Grok Bot desk coach on the XOE trade desk (rules only, notify only; sim, testnet XOE, no real money). */
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
    const coach = page.locator("[data-testid=pd-coach]")
    const tipId = async () => coach.getAttribute("data-tip")
    const tipText = async () => page.locator("[data-testid=pd-coach-text]").innerText()
    rec.coachVisible = await coach.isVisible()
    rec.label = await coach.locator(".pd-coach-k").innerText()
    rec.ariaLive = await page.locator("[data-testid=pd-coach-text]").getAttribute("aria-live")
    rec.flatTip = await tipId()
    // Order form: wrong-side stop, right-side stop, stop removed.
    await page.getByRole("tab", { name: "Buy", exact: true }).click()
    await page.getByLabel("Add take profit and stop loss").check()
    const mark = Number(await desk.getAttribute("data-mark"))
    await page.getByLabel("Stop loss price").fill(String(+(mark * 1.02).toFixed(3)))
    await wait(s, 200)
    rec.formWrongTip = await tipId()
    await page.getByLabel("Stop loss price").fill(String(+(mark * 0.98).toFixed(3)))
    await wait(s, 200)
    rec.formStopTip = await tipId()
    await page.getByLabel("Stop loss price").fill("")
    await wait(s, 200)
    rec.formClearedTip = await tipId()
    await page.getByLabel("Add take profit and stop loss").uncheck()
    // Open a sim position with no stop, then add and remove a stop.
    await page.getByLabel("Amount in XOE").fill("0.5")
    await page.locator("[data-testid=pd-submit]").click()
    await wait(s, 400)
    rec.noStopTip = await tipId()
    rec.noStopText = await tipText()
    await page.getByRole("tab", { name: "Positions" }).click()
    const m2 = Number(await desk.getAttribute("data-mark"))
    await page.getByLabel("New stop loss price").fill(String(+(m2 * 0.97).toFixed(3)))
    await page.locator("[data-testid=pd-set-bracket]").click()
    await wait(s, 400)
    rec.stopAddedTip = await tipId()
    rec.stopAddedText = await tipText()
    await coach.evaluate((el) => el.scrollIntoView({ block: "center" }))
    await wait(s, 200)
    await page.screenshot({ path: `review/run-coach-${device}.png` })
    rec.coachOverflow = await coach.evaluate((el) => el.scrollWidth > el.clientWidth + 1)
    await page.locator(".pd-lower-tabs").getByRole("tab", { name: /Open orders/ }).click()
    await page.locator(".pd-rows li", { hasText: "SL" }).getByRole("button", { name: "Cancel" }).click()
    await wait(s, 400)
    rec.stopRemovedTip = await tipId()
    rec.changes = rec.flatTip !== rec.formWrongTip && rec.formWrongTip !== rec.formStopTip && rec.formClearedTip === rec.flatTip &&
      rec.noStopTip === "no-stop" && rec.stopAddedTip !== "no-stop" && rec.stopRemovedTip === "no-stop"
    rec.overflowX = await page.evaluate(() => {
      const sheet = document.querySelector(".drawer-sheet")
      return sheet ? sheet.scrollWidth > sheet.clientWidth + 1 : true
    })
    const text = await page.locator(".drawer-sheet").innerText()
    rec.noXrp = !/xrp/i.test(text)
    rec.simLabel = /no real money/i.test(text)
    const bad = !rec.coachVisible || rec.label !== "Grok Bot tip (sim)" || rec.ariaLive !== "polite" || rec.flatTip !== "flat" ||
      rec.formWrongTip !== "form-stop-wrong" || !/^form-(ready|big-risk)$/.test(rec.formStopTip || "") || !rec.changes ||
      rec.coachOverflow || rec.overflowX || !rec.noXrp || !rec.simLabel
    if (bad) failed = true
  } catch (e) {
    rec.failure = String(e)
    failed = true
    await s.page.screenshot({ path: `review/run-coach-${device}-failure.png` }).catch(() => {})
  }
  rec.errors = s.errors
  if (s.errors?.length) failed = true
  await closeGame(s)
  out[device] = rec
  console.log(JSON.stringify(rec))
}
fs.writeFileSync("review/coach.json", JSON.stringify(out, null, 2))
if (failed) process.exitCode = 1
