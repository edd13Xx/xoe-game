#!/usr/bin/env node
/** v19 night run: map tokens/colony names under the HUD fade; nothing faded is in the open; nothing covered stays bright. */
import path from "node:path"
import fs from "node:fs"
import { fileURLToPath } from "node:url"
process.env.XOE_REVIEW_LIBRARY = "1"
const { openGame, closeGame, setupPilot, closeChapterCard } = await import("./review-v19.mjs")
const ROOT = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(ROOT, "review")
const summary = {}
const audit = () => {
  const wrap = document.querySelector(".mars-world-shell")
  const sel = ".minimap-hud, .map-open-btn, .map-econ, .map-fight-btn, .map-trade, .map-fly-hint, .map-founder"
  const huds = [...wrap.querySelectorAll(sel)].map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.height)
  let faded = 0, covered = 0, mismatch = []
  for (const el of wrap.querySelectorAll(".world-ticker, .world-dome .dome-name")) {
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2
    const hit = huds.some((h) => (cx >= h.left && cx <= h.right && cy >= h.top && cy <= h.bottom) ||
      (Math.max(0, Math.min(r.right, h.right) - Math.max(r.left, h.left)) * Math.max(0, Math.min(r.bottom, h.bottom) - Math.max(r.top, h.top))) / (r.width * r.height || 1) > 0.15)
    const isName = el.classList.contains("dome-name")
    const cls = isName ? el.parentElement.classList.contains("name-under-hud") : el.classList.contains("under-hud")
    if (hit) covered++
    if (cls) faded++
    if (hit !== cls) mismatch.push({ text: el.textContent.trim().slice(0, 24), hit, cls })
  }
  return { covered, faded, mismatch }
}
for (const device of ["portrait", "landscape"]) {
  const s = await openGame({ device })
  const rec = { device, errors: s.errors, samples: [] }
  try {
    await setupPilot(s)
    await closeChapterCard(s)
    const box = await s.page.locator(".mars-world-shell").boundingBox()
    const taps = [[0.5, 0.75], [0.85, 0.6], [0.2, 0.3], [0.7, 0.2], [0.4, 0.85]]
    for (const [fx, fy] of taps) {
      await s.page.mouse.click(box.x + box.width * fx, box.y + box.height * fy)
      await s.page.waitForTimeout(1600)
      rec.samples.push(await s.page.evaluate(audit))
    }
    await s.page.screenshot({ path: path.join(out, `hud-occlusion-${device}.png`) })
  } catch (e) { rec.failure = String(e) }
  summary[device] = rec
  await closeGame(s)
}
fs.writeFileSync(path.join(out, "hud-occlusion.json"), JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
const recs = Object.values(summary)
if (recs.some((r) => r.failure || r.errors?.length || r.samples.some((x) => x.mismatch.length)) || !recs.some((r) => r.samples.some((x) => x.faded > 0))) process.exitCode = 1
