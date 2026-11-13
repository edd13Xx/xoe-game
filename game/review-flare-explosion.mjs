#!/usr/bin/env node
/** Phone + desktop shots (and a short GIF) of the solar-flare explosion and ambient plasma. Local only. */
import path from "node:path"
import fs from "node:fs"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
process.env.XOE_REVIEW_LIBRARY = "1"
const { openGame, closeGame, setupPilot, phaseOf, closeChapterCard, wait } = await import("./review-v19.mjs")

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(ROOT, "review")
fs.mkdirSync(out, { recursive: true })
const framesDir = path.join(out, "flare-frames")
fs.mkdirSync(framesDir, { recursive: true })

async function waitForBurst(page, ms = 12000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    const n = await page.locator("[data-flare-burst='1']").count()
    if (n > 0) return true
    await page.waitForTimeout(80)
  }
  return false
}

const summary = {}
for (const device of ["portrait", "desktop"]) {
  const s = await openGame({ device, query: "?flare=1" })
  const rec = { device, errors: s.errors }
  try {
    rec.setup = await setupPilot(s)
    await closeChapterCard(s)
    rec.phase = await phaseOf(s)
    await s.page.evaluate(() => window.scrollTo(0, 0))
    const shell = s.page.locator(".mars-world-shell")
    if (await shell.count()) await shell.scrollIntoViewIfNeeded()

    rec.ambientCalm = await s.page.locator("[data-plasma='1']").count()
    if (!(await s.page.locator("[data-flare-burst='1']").count())) {
      await s.page.screenshot({ path: path.join(out, `plasma-ambient-${device}.png`), fullPage: false })
    }

    rec.burst = await waitForBurst(s.page)
    if (rec.burst) {
      await wait(s, 450)
      await s.page.screenshot({ path: path.join(out, `flare-explosion-${device}.png`), fullPage: false })
      if (device === "portrait") {
        for (let i = 0; i < 12; i++) {
          await s.page.screenshot({ path: path.join(framesDir, `f${String(i).padStart(2, "0")}.png`), fullPage: false })
          await wait(s, 180)
        }
      } else {
        await wait(s, 1800)
      }
    }

    await wait(s, 800)
    rec.burstAfter = await s.page.locator("[data-flare-burst='1']").count()
    rec.banner = await s.page.locator("[data-red-day-banner]").count()
    rec.shell = await s.page.locator(".mars-world-shell.is-red-day").count()
    rec.plasma = await s.page.locator("[data-plasma='1']").count()
    await s.page.screenshot({ path: path.join(out, `plasma-red-day-${device}.png`), fullPage: false })
  } catch (e) {
    rec.failure = String(e)
    await s.page.screenshot({ path: path.join(out, `flare-explosion-${device}-failure.png`), fullPage: false }).catch(() => {})
  }
  summary[device] = rec
  await closeGame(s)
}

function makeGif() {
  const frames = fs.readdirSync(framesDir).filter((f) => f.endsWith(".png")).sort()
  if (frames.length < 4) return { ok: false, why: `only ${frames.length} frames` }
  const dest = path.join(out, "flare-explosion-portrait.gif")
  const tries = [
    ["ffmpeg", ["-y", "-framerate", "8", "-i", path.join(framesDir, "f%02d.png"), "-vf", "scale=390:-1:flags=lanczos", "-loop", "0", dest]],
    ["convert", ["-delay", "12", "-loop", "0", ...frames.map((f) => path.join(framesDir, f)), dest]],
    ["magick", ["-delay", "12", "-loop", "0", ...frames.map((f) => path.join(framesDir, f)), dest]],
  ]
  for (const [cmd, args] of tries) {
    const r = spawnSync(cmd, args, { encoding: "utf8" })
    if (r.status === 0 && fs.existsSync(dest)) return { ok: true, cmd, bytes: fs.statSync(dest).size, path: dest }
  }
  return { ok: false, why: "no ffmpeg/convert/magick" }
}
summary.gif = makeGif()
fs.writeFileSync(path.join(out, "flare-explosion.json"), JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
if (Object.values(summary).some((r) => r && r.device && (r.failure || r.phase !== "colony-map" || !r.burst || !r.banner))) {
  process.exitCode = 1
}
