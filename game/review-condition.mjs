#!/usr/bin/env node
/** Local-only check of XO condition energy lines + ring radar in a skirmish fight: condition label and canvas tone,
 * radar blips = alive enemies, radar does not cover the hull text, no overflow, reduced motion, no XRP text. */
import fs from "node:fs"
process.env.XOE_REVIEW_LIBRARY = "1"
const { openGame, closeGame, pressName, wait, setupPilot, toMap, closeChapterCard } = await import("./review-v19.mjs")
const out = {}
let failed = false
const SEL = ".colony-fight-overlay"
const BAD = /\bXRP\b/i
const overlap = (a, b) => !!a && !!b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

for (const device of ["portrait", "landscape", "desktop"]) {
  const s = await openGame({ device })
  const rec = { device }
  try {
    await setupPilot(s); await toMap(s); await closeChapterCard(s)
    if (!(await pressName(s, "Skirmish fight")) && !(await pressName(s, "Fight"))) throw new Error("cannot open skirmish fight")
    const page = s.page
    await page.locator(`${SEL} .fight-field`).waitFor({ timeout: 7000 })
    await page.locator(`${SEL} .fight-hud`).scrollIntoViewIfNeeded()
    await wait(s, 1100)
    const read = () => page.evaluate((sel) => {
      const root = document.querySelector(sel)
      const radar = root?.querySelector("svg.fight-radar")
      return {
        condition: root?.querySelector(".xo-condition")?.getAttribute("data-condition") ?? null,
        conditionText: root?.querySelector(".xo-condition")?.textContent?.trim() ?? "",
        canvasTone: root?.querySelector(".fight-xo-sprite")?.getAttribute("data-condition") ?? null,
        radar: !!radar,
        radarLabel: radar?.getAttribute("aria-label") ?? "",
        blips: radar?.querySelectorAll(".radar-blip").length ?? 0,
        alive: root?.querySelectorAll(".fight-enemy").length ?? 0,
      }
    }, SEL)
    rec.state = await read()
    rec.radarBox = await page.locator(`${SEL} svg.fight-radar`).boundingBox()
    rec.hullBox = await page.locator(`${SEL} .fight-hud > p.fine`).first().boundingBox()
    rec.radarCoversHull = overlap(rec.radarBox, rec.hullBox)
    await page.screenshot({ path: `review/run-condition-${device}.png` })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await wait(s, 200)
    rec.reduced = await read()
    await page.emulateMedia({ reducedMotion: "no-preference" })
    rec.overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    rec.xrp = BAD.test(await page.locator("body").innerText()) || BAD.test(await page.content())
    const st = rec.state
    const ok = st.radar && st.condition === "stable" && st.canvasTone === "stable" && /Condition Stable/.test(st.conditionText) &&
      st.alive > 0 && st.blips === st.alive && /Ring radar: \d+ contact/.test(st.radarLabel) &&
      !rec.radarCoversHull && rec.reduced.radar && rec.reduced.canvasTone === "stable" && !rec.overflowX && !rec.xrp
    rec.pass = !!ok
    if (!ok) failed = true
  } catch (e) {
    rec.error = String(e?.message || e)
    failed = true
  } finally {
    out[device] = rec
    await closeGame(s)
  }
}
fs.writeFileSync("review/condition.json", JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))
process.exit(failed ? 1 : 0)
