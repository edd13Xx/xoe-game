#!/usr/bin/env node
/** Phone/desktop shots of a forced solar-flare red day. Local only. */
import path from "node:path"
import fs from "node:fs"
import { fileURLToPath } from "node:url"
process.env.XOE_REVIEW_LIBRARY = "1"
const { openGame, closeGame, setupPilot, phaseOf, closeChapterCard, wait, pressName, press } = await import("./review-v19.mjs")

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(ROOT, "review")
fs.mkdirSync(out, { recursive: true })

async function waitForDrop(page, start, minPct = 0.08, ms = 24000) {
  const t0 = Date.now()
  let last = start
  while (Date.now() - t0 < ms) {
    last = await page.evaluate(() => {
      const el = document.querySelector(".live-trade-price, .live-ticker, [data-red-day='1']")
      const text = document.body.innerText
      const m = text.match(/\$(\d+\.\d{3})/)
      return m ? Number(m[1]) : null
    })
    const banner = await page.locator("[data-red-day-banner]").count()
    if (banner && last != null && start && (start - last) / start >= minPct) return { last, ok: true }
    await page.waitForTimeout(400)
  }
  return { last, ok: false }
}

const summary = {}
for (const device of ["portrait", "desktop"]) {
  const s = await openGame({ device, query: "?flare=1" })
  const rec = { device, errors: s.errors }
  try {
    rec.setup = await setupPilot(s)
    await closeChapterCard(s)
    rec.phase = await phaseOf(s)
    rec.startPrice = await s.page.evaluate(() => {
      const m = document.body.innerText.match(/\$(\d+\.\d{3})/)
      return m ? Number(m[1]) : null
    })
    rec.drop = await waitForDrop(s.page, rec.startPrice)
    rec.banner = await s.page.locator("[data-red-day-banner]").count()
    rec.redDay = await s.page.locator("[data-red-day='1']").count()
    rec.shell = await s.page.locator(".mars-world-shell.is-red-day").count()
    await s.page.evaluate(() => window.scrollTo(0, 0))
    const shell = s.page.locator(".mars-world-shell")
    if (await shell.count()) await shell.scrollIntoViewIfNeeded()
    await s.page.screenshot({ path: path.join(out, `red-day-${device}-map.png`), fullPage: false })
    if (!(await press(s, s.page.getByRole("button", { name: /Open SNL paper trade desk|Desk/i }).first()))) {
      await pressName(s, "XOE trade desk")
    }
    await wait(s, 800)
    const chart = s.page.locator(".snl-chart, .snl-terminal").first()
    if (await chart.count()) await chart.scrollIntoViewIfNeeded()
    rec.deskOpen = await s.page.locator(".snl-terminal, .paper-advanced").count()
    await s.page.screenshot({ path: path.join(out, `red-day-${device}-desk.png`), fullPage: false })
  } catch (e) {
    rec.failure = String(e)
    await s.page.screenshot({ path: path.join(out, `red-day-${device}-failure.png`), fullPage: false }).catch(() => {})
  }
  summary[device] = rec
  await closeGame(s)
}
fs.writeFileSync(path.join(out, "red-day.json"), JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
if (Object.values(summary).some((r) => r.failure || r.phase !== "colony-map" || !r.banner || !r.shell || !r.drop?.ok || !r.deskOpen)) {
  process.exitCode = 1
}
