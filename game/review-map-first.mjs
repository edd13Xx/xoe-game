#!/usr/bin/env node
/** Phone/desktop shots right after the front page: map, minimap, characters. */
import path from "node:path"
import fs from "node:fs"
import { fileURLToPath, pathToFileURL } from "node:url"
process.env.XOE_REVIEW_LIBRARY = "1"
const { openGame, closeGame, setupPilot, phaseOf, closeChapterCard } = await import("./review-v19.mjs")

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(ROOT, "review")
fs.mkdirSync(out, { recursive: true })

const summary = {}
// v19: Chromium portrait/desktop as before, plus real WebKit (Safari engine) iPhone 15 portrait + landscape.
// WebKit opens the single-file HTML (the file a phone gets); dist/index.html links the PWA manifest, which
// WebKit refuses to fetch from file:// (a harmless console error that only matters when it is hosted).
const single = pathToFileURL(path.join(ROOT, "Unknown-Orbital-Engine-XOE-v19-2026-11-10.html")).href
const runs = [
  { key: "portrait", device: "portrait", browserName: "chromium" },
  { key: "desktop", device: "desktop", browserName: "chromium" },
  { key: "webkit-iphone15", device: "iphone15", browserName: "webkit", url: single },
  { key: "webkit-iphone15-landscape", device: "iphone15-landscape", browserName: "webkit", url: single },
]
for (const { key: device, device: dev, browserName, url } of runs) {
  const s = await openGame({ device: dev, browserName, url })
  const rec = { device, errors: s.errors }
  try {
    rec.frontPhase = await phaseOf(s)
    await s.page.screenshot({ path: path.join(out, `map-first-${device}-front.png`), fullPage: false })
    rec.setup = await setupPilot(s)
    // v19: what the player sees right after Start when ready, before any scrolling
    rec.inViewport = await s.page.evaluate(() => {
      const f = (sel) => {
        const el = document.querySelector(sel)
        if (!el) return 0
        const r = el.getBoundingClientRect()
        const ix = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0))
        const iy = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0))
        return r.width * r.height ? Math.round((ix * iy * 100) / (r.width * r.height)) / 100 : 0
      }
      return { map: f(".mars-world-shell"), minimap: f(".minimap-hud"), ship: f(".xo-avatar"), companion: f("[data-cast=xoe]") }
    })
    await closeChapterCard(s)
    rec.phase = await phaseOf(s)
    rec.vis = await s.page.evaluate(() => {
      const vis = (sel) => {
        const el = document.querySelector(sel)
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) }
      }
      return {
        map: vis(".mars-world-shell"),
        minimap: vis(".minimap-hud"),
        ship: vis(".xo-avatar"),
        companion: vis("[data-cast=xoe]"),
        settlers: document.querySelectorAll("[data-cast=settler]").length,
        chapter: !!document.querySelector(".chapter-overlay"),
        deskOpen: !!document.querySelector(".paper-advanced"),
        tradeDock: vis(".live-trade-dock"),
      }
    })
    await s.page.evaluate(() => window.scrollTo(0, 0))
    const shell = s.page.locator(".mars-world-shell")
    if (await shell.count()) await shell.scrollIntoViewIfNeeded()
    await s.page.screenshot({ path: path.join(out, `map-first-${device}-after-front.png`), fullPage: false })
  } catch (e) {
    rec.failure = String(e)
    await s.page.screenshot({ path: path.join(out, `map-first-${device}-failure.png`), fullPage: false }).catch(() => {})
  }
  summary[device] = rec
  await closeGame(s)
}
fs.writeFileSync(path.join(out, "map-first.json"), JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
if (Object.values(summary).some((r) => r.errors?.length || (r.device !== "desktop" && (r.inViewport?.map < 0.85 || r.inViewport?.minimap < 0.99 || r.inViewport?.ship < 0.99 || r.inViewport?.companion < 0.5)) || r.failure || r.phase !== "colony-map" || !r.vis?.map || !r.vis?.minimap || !r.vis?.ship || !r.vis?.companion || r.vis?.settlers < 1 || r.vis?.chapter || r.vis?.deskOpen)) {
  process.exitCode = 1
}
