#!/usr/bin/env node
/** Local-only check of the trailing stop on the XOE trade desk (sim, testnet XOE, no real money). */
import fs from "node:fs"
process.env.XOE_REVIEW_LIBRARY = "1"
const { openGame, closeGame, pressName, wait } = await import("./review-v19.mjs")
const out = {}
let failed = false
const slOf = (txt) => {
  const m = /SL\s+([\d.]+)/.exec(txt)
  return m ? Number(m[1]) : null
}
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
    await page.getByLabel("Amount in XOE").fill("0.5")
    await page.locator("[data-testid=pd-submit]").click()
    await wait(s, 400)
    rec.side = await desk.getAttribute("data-side")
    await page.getByRole("tab", { name: "Positions", exact: true }).click()
    await wait(s, 150)
    const trail = page.locator("[data-testid=pd-trail]")
    rec.trailVisible = await trail.isVisible()
    rec.slBefore = slOf(await page.locator("[data-testid=pd-pos-bracket]").innerText())
    await trail.locator("[data-trail='1']").click()
    await wait(s, 400)
    const mark0 = Number(await desk.getAttribute("data-mark"))
    rec.pressed = await trail.locator("[data-trail='1']").getAttribute("aria-pressed")
    rec.note = await page.locator("[data-testid=pd-trail-note]").innerText().catch(() => "")
    const seq = []
    for (let i = 0; i < 6; i++) {
      seq.push(slOf(await page.locator("[data-testid=pd-pos-bracket]").innerText()))
      await wait(s, 700)
    }
    rec.slSeq = seq
    rec.mark0 = mark0
    rec.marks = await page.locator("[data-snl-chart] [data-mark]").evaluateAll((els) => els.map((e) => e.getAttribute("data-mark"))).catch(() => [])
    rec.monotonic = seq.every((v, i) => v != null && (i === 0 || v >= seq[i - 1] - 1e-9))
    rec.belowMark = seq[0] != null && seq[0] < mark0 * 1.0001 && seq[0] > mark0 * 0.97
    await trail.evaluate((el) => el.scrollIntoView({ block: "center" }))
    await wait(s, 300)
    await page.screenshot({ path: `review/run-trail-${device}.png` })
    rec.pressedAtShot = await trail.locator("[data-trail='1']").getAttribute("aria-pressed")
    rec.offClassAtShot = await trail.locator("[data-trail='off']").getAttribute("class")
    await trail.locator("[data-trail='off']").click()
    await wait(s, 200)
    rec.offMsg = await page.locator(".pd-msg").innerText().catch(() => "")
    rec.overflowX = await page.evaluate(() => {
      const sheet = document.querySelector(".drawer-sheet")
      return sheet ? sheet.scrollWidth > sheet.clientWidth + 1 : true
    })
    const text = await page.locator(".drawer-sheet").innerText()
    rec.noXrp = !/xrp/i.test(text)
    rec.simLabel = /no real money/i.test(text)
    const bad =
      rec.side !== "long" || !rec.trailVisible || rec.slBefore != null || rec.pressed !== "true" || rec.pressedAtShot !== "true" || !/follows XOE up/.test(rec.note) ||
      !rec.monotonic || !rec.belowMark || !/off/i.test(rec.offMsg) || rec.overflowX || !rec.noXrp || !rec.simLabel
    if (bad) failed = true
  } catch (e) {
    rec.failure = String(e)
    failed = true
    await s.page.screenshot({ path: `review/run-trail-${device}-failure.png` }).catch(() => {})
  }
  rec.errors = s.errors
  if (s.errors?.length) failed = true
  await closeGame(s)
  out[device] = rec
  console.log(JSON.stringify(rec))
}
fs.writeFileSync("review/trail.json", JSON.stringify(out, null, 2))
if (failed) process.exitCode = 1
