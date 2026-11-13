#!/usr/bin/env node
/** Local-only check of the ZOE-style boost dash in a skirmish fight: input per device, afterimages, speed lines,
 * thruster flare, cooldown ring, reduced motion (dash works, no afterimages/speed lines), no overflow, no XRP text. */
import fs from "node:fs"
process.env.XOE_REVIEW_LIBRARY = "1"
const { openGame, closeGame, pressName, wait, setupPilot, toMap, closeChapterCard } = await import("./review-v19.mjs")
const out = {}
let failed = false
const SEL = ".colony-fight-overlay"
const BAD = /\bXRP\b/i

async function fx(page) {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel)
    const field = root?.querySelector(".fight-field")
    const body = root?.querySelector(".xo-dash-body")
    const btn = root?.querySelector("button.dash-btn")
    return {
      dashing: field?.getAttribute("data-dashing") === "1",
      afterimages: root?.querySelectorAll('[data-dash-fx="afterimage"]').length ?? 0,
      speedlines: root?.querySelectorAll('[data-dash-fx="speedlines"] span').length ?? 0,
      flare: root?.querySelectorAll('[data-dash-fx="flare"]').length ?? 0,
      bodyMoved: body ? getComputedStyle(body).transform !== "none" && getComputedStyle(body).transform !== "matrix(1, 0, 0, 1, 0, 0)" : false,
      ready: btn?.getAttribute("data-dash-ready") === "1",
      disabled: !!btn?.disabled,
      cooling: !!root?.querySelector(".dash-ring-fill.is-cooling"),
    }
  }, SEL)
}

async function waitFor(page, pred, ms = 1200) {
  let last = await fx(page)
  for (let t = 0; t < ms && !pred(last); t += 40) {
    await page.waitForTimeout(40)
    last = await fx(page)
  }
  return last
}

for (const device of ["portrait", "landscape", "desktop"]) {
  const s = await openGame({ device })
  const rec = { device }
  try {
    await setupPilot(s); await toMap(s); await closeChapterCard(s)
    if (!(await pressName(s, "Skirmish fight")) && !(await pressName(s, "Fight"))) throw new Error("cannot open skirmish fight")
    const page = s.page
    const field = page.locator(`${SEL} .fight-field`)
    await field.waitFor({ timeout: 7000 })
    await field.scrollIntoViewIfNeeded()
    await wait(s, 300)
    const btn = page.getByRole("button", { name: "Dash / Shield (boost dash, dodge)", exact: true })
    rec.buttonVisible = await btn.isVisible()
    rec.ringInButton = await btn.locator("svg.dash-ring").count()
    const box = await field.boundingBox()
    // Pick an empty spot on the field (left side, below XO's line of fire is fine: enemies sit right).
    const x = Math.round(box.x + box.width * 0.08), y = Math.round(box.y + box.height * 0.2)
    const ptype = s.phone ? "touch" : "mouse"
    rec.before = await fx(page)
    if (device === "portrait") {
      rec.input = "double-tap"
      for (let i = 0; i < 2; i++) {
        await field.dispatchEvent("pointerdown", { pointerId: 11 + i, pointerType: ptype, clientX: x, clientY: y, bubbles: true })
        await field.dispatchEvent("pointerup", { pointerId: 11 + i, pointerType: ptype, clientX: x, clientY: y, bubbles: true })
        await page.waitForTimeout(90)
      }
    } else if (device === "landscape") {
      rec.input = "swipe"
      await field.dispatchEvent("pointerdown", { pointerId: 21, pointerType: ptype, clientX: x, clientY: y, bubbles: true })
      await page.waitForTimeout(90)
      await field.dispatchEvent("pointerup", { pointerId: 21, pointerType: ptype, clientX: x + 90, clientY: y + 4, bubbles: true })
    } else {
      rec.input = "Shift"
      await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : null))
      await page.keyboard.press("Shift")
    }
    rec.during = await waitFor(page, (f) => f.dashing && f.afterimages > 0 && f.bodyMoved)
    await page.waitForTimeout(60)
    await page.screenshot({ path: `review/run-dash-${device}.png` })
    rec.afterDash = await waitFor(page, (f) => !f.dashing, 1500)
    rec.recharged = await waitFor(page, (f) => f.ready && !f.disabled, 3200)
    // Reduced motion: dash still works, no afterimages / speed lines / flare.
    await page.emulateMedia({ reducedMotion: "reduce" })
    await wait(s, 150)
    await btn.click()
    rec.reduced = await waitFor(page, (f) => f.dashing, 800)
    await page.emulateMedia({ reducedMotion: "no-preference" })
    rec.overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    const text = await page.locator("body").innerText()
    const html = await page.content()
    rec.xrp = BAD.test(text) || BAD.test(html)
    const d = rec.during
    const ok =
      rec.buttonVisible && rec.ringInButton === 1 && rec.before.ready && !rec.before.dashing &&
      d.dashing && d.afterimages === 3 && d.speedlines > 0 && d.flare === 1 && d.bodyMoved && !d.ready && d.disabled && d.cooling &&
      !rec.afterDash.dashing && rec.recharged.ready &&
      rec.reduced.dashing && rec.reduced.afterimages === 0 && rec.reduced.speedlines === 0 && rec.reduced.flare === 0 &&
      !rec.overflowX && !rec.xrp
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
fs.writeFileSync("review/dash.json", JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))
process.exit(failed ? 1 : 0)
