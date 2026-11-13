#!/usr/bin/env node
/** Local-only check of the drawn enemy craft, HP bars, lock-on reticle and targeting beam in a skirmish fight. */
import fs from "node:fs"
process.env.XOE_REVIEW_LIBRARY = "1"
const { openGame, closeGame, pressName, wait, setupPilot, toMap, closeChapterCard } = await import("./review-v19.mjs")
const out = {}
let failed = false
for (const device of ["portrait", "landscape", "desktop"]) {
  const s = await openGame({ device })
  const rec = { device }
  try {
    await setupPilot(s); await toMap(s); await closeChapterCard(s)
    if (!(await pressName(s, "Skirmish fight")) && !(await pressName(s, "Fight"))) throw new Error("cannot open skirmish fight")
    const page = s.page
    const field = page.locator(".colony-fight-overlay .fight-field")
    await field.waitFor({ timeout: 7000 })
    await field.scrollIntoViewIfNeeded()
    await wait(s, 400)
    const ships = page.locator(".colony-fight-overlay .fight-enemy-ship")
    rec.ships = await ships.count()
    rec.kinds = await ships.evaluateAll((els) => els.map((e) => e.getAttribute("data-enemy-kind")))
    rec.crafts = await page.locator(".colony-fight-overlay .fight-enemy-ship svg.fight-enemy-craft").count()
    rec.hpBars = await page.locator(".colony-fight-overlay .fight-enemy-hp > span").count()
    rec.names = await ships.evaluateAll((els) => els.map((e) => e.textContent?.replace(/\s+/g, " ").trim()))
    rec.oldFlatBoxes = await ships.evaluateAll((els) => els.filter((e) => getComputedStyle(e).backgroundColor !== "rgba(0, 0, 0, 0)").length)
    const first = ships.first()
    const hpBefore = await first.locator(".fight-enemy-hp-text").innerText()
    await first.dispatchEvent("pointerdown", { pointerId: 7, pointerType: s.phone ? "touch" : "mouse", bubbles: true })
    let beam = 0, reticle = 0
    for (let i = 0; i < 20 && !(beam && reticle); i++) {
      await wait(s, 60)
      beam = beam || (await page.locator(".colony-fight-overlay .fight-beam line").count())
      reticle = reticle || (await page.locator(".colony-fight-overlay .fight-reticle").count())
      if (beam && reticle && i > 2) break
    }
    rec.beamSeen = beam > 0
    rec.reticleSeen = reticle > 0
    await page.screenshot({ path: `review/run-craft-${device}.png` })
    await wait(s, 900)
    await field.dispatchEvent("pointerup", { pointerId: 7, bubbles: true })
    const hpAfter = await first.locator(".fight-enemy-hp-text").innerText().catch(() => "gone")
    rec.hpBefore = hpBefore
    rec.hpAfter = hpAfter
    rec.damaged = hpAfter === "gone" || hpAfter !== hpBefore
    rec.overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    rec.xrp = /\bXRP\b/.test(await page.locator("body").innerText())
    const ok = rec.ships >= 1 && rec.crafts === rec.ships && rec.hpBars === rec.ships && rec.oldFlatBoxes === 0 && rec.beamSeen && rec.reticleSeen && rec.damaged && !rec.overflowX && !rec.xrp
    rec.pass = ok
    if (!ok) failed = true
  } catch (e) {
    rec.error = String(e?.message || e)
    failed = true
  } finally {
    out[device] = rec
    await closeGame(s)
  }
}
fs.writeFileSync("review/craft.json", JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))
process.exit(failed ? 1 : 0)
