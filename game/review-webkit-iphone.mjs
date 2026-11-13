#!/usr/bin/env node
/**
 * v19 WebKit (Safari engine) iPhone review. Local only: a 127.0.0.1 server for dist/ (the PWA) and
 * file:// for the single-file HTML. Mocked prices, no keys, nothing published.
 *
 * Flow per case: front page -> Start -> pilot setup -> Start when ready, then WITHOUT scrolling checks that
 * the colony map, minimap, XO craft, XOE companion and settlers are on screen (inside the viewport),
 * that the map pixels are not blank, and that there were no page errors.
 * Cases: iPhone 15 portrait + landscape x http (dist/) + file:// (single HTML) x fresh first play
 * (voice reminder showing) + returning player (reminder off).
 */
import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
process.env.XOE_REVIEW_LIBRARY = "1"
const { openGame, closeGame, setupPilot, phaseOf, wait } = await import("./review-v19.mjs")

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(ROOT, "dist")
const SINGLE = path.join(ROOT, process.env.XOE_SINGLE_HTML || "Unknown-Orbital-Engine-XOE-v19-2026-11-10.html")
const OUT = path.join(ROOT, "review")
const BROWSER = process.env.XOE_BROWSER || "webkit"
fs.mkdirSync(OUT, { recursive: true })

const MIME = { ".js": "text/javascript", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".html": "text/html; charset=utf-8", ".json": "application/json" }
async function serve(dir) {
  const server = createServer(async (req, res) => {
    try {
      const name = decodeURIComponent(new URL(req.url, "http://local").pathname)
      const target = path.resolve(dir, "." + (name.endsWith("/") ? name + "index.html" : name))
      if (!target.startsWith(dir + path.sep)) throw new Error("outside")
      const data = await readFile(target)
      res.setHeader("content-type", MIME[path.extname(target)] || "application/octet-stream")
      res.end(data)
    } catch {
      res.statusCode = 404
      res.end("Not found")
    }
  })
  await new Promise((r) => server.listen(0, "127.0.0.1", r))
  return { base: `http://127.0.0.1:${server.address().port}/`, close: () => new Promise((r) => server.close(r)) }
}

function seedFor(kind) {
  const seed = JSON.parse(fs.readFileSync(path.join(ROOT, "qa/verify/seed.json"), "utf8"))
  if (kind === "fresh") {
    // first play: the voice reminder is due, exactly like a new iPhone visitor
    const ls = { ...seed.localStorage }
    delete ls["xoe.voiceReminder.v1"]
    seed.localStorage = ls
  }
  return seed
}

async function onScreen(page) {
  return page.evaluate(() => {
    const vw = innerWidth, vh = innerHeight
    const box = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      const visible = r.width > 2 && r.height > 2 && s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05
      const ix = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0))
      const iy = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0))
      const inView = r.width * r.height ? (ix * iy) / (r.width * r.height) : 0
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), visible, inView: Math.round(inView * 100) / 100 }
    }
    const shell = document.querySelector(".mars-world-shell")
    const sr = shell?.getBoundingClientRect()
    const centerIn = (el) => {
      if (!el || !sr) return false
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2
      return r.width > 1 && cx >= Math.max(0, sr.left) && cx <= Math.min(vw, sr.right) && cy >= Math.max(0, sr.top) && cy <= Math.min(vh, sr.bottom)
    }
    const settlers = [...document.querySelectorAll("[data-cast=settler]")]
    const mini = document.querySelector(".minimap-hud canvas, canvas.minimap-hud-canvas")
    let miniPixels = null
    try {
      if (mini) {
        const d = mini.getContext("2d").getImageData(0, 0, mini.width, mini.height).data
        let lit = 0
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0 && d[i] + d[i + 1] + d[i + 2] > 60) lit++
        miniPixels = { w: mini.width, h: mini.height, litShare: Math.round((lit / (d.length / 4)) * 1000) / 1000 }
      }
    } catch (e) {
      miniPixels = { error: String(e) }
    }
    return {
      viewport: [vw, vh],
      visualViewport: window.visualViewport ? [Math.round(visualViewport.width), Math.round(visualViewport.height)] : null,
      scrollY: Math.round(scrollY),
      docH: document.documentElement.scrollHeight,
      docW: document.documentElement.scrollWidth,
      map: box(shell),
      minimap: box(document.querySelector(".minimap-hud")),
      ship: { ...box(document.querySelector(".xo-avatar")), inMap: centerIn(document.querySelector(".xo-avatar")) },
      companion: { ...box(document.querySelector("[data-cast=xoe]")), inMap: centerIn(document.querySelector("[data-cast=xoe]")) },
      settlers: settlers.length,
      settlersOnScreen: settlers.filter(centerIn).length,
      miniPixels,
      reminder: !!document.querySelector("[data-voice-reminder='1']"),
      chapter: !!document.querySelector(".chapter-overlay"),
      ua: navigator.userAgent,
    }
  })
}

/** Decode the on-screen map area in the page and measure that it is not a blank fill. */
async function mapPixels(page, rect) {
  if (!rect) return null
  const vp = page.viewportSize()
  const x = Math.max(0, rect.x), y = Math.max(0, rect.y)
  const w = Math.min(vp.width, rect.x + rect.w) - x, h = Math.min(vp.height, rect.y + rect.h) - y
  if (w < 4 || h < 4) return { w, h, blank: true }
  const buf = await page.screenshot({ clip: { x, y, width: w, height: h }, scale: "css" })
  return page.evaluate(async (b64) => {
    const img = new Image()
    img.src = "data:image/png;base64," + b64
    await img.decode()
    const c = document.createElement("canvas")
    c.width = img.width
    c.height = img.height
    const g = c.getContext("2d")
    g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, c.width, c.height).data
    const colors = new Set()
    let sum = 0, sum2 = 0, n = 0, bright = 0
    for (let i = 0; i < d.length; i += 16) {
      const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
      sum += l; sum2 += l * l; n++
      if (l > 40) bright++
      colors.add(((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4))
    }
    const mean = sum / n
    const sd = Math.sqrt(Math.max(0, sum2 / n - mean * mean))
    return { w: img.width, h: img.height, distinctColors: colors.size, lumaMean: Math.round(mean), lumaSd: Math.round(sd), brightShare: Math.round((bright / n) * 1000) / 1000, blank: colors.size < 40 || sd < 8 }
  }, buf.toString("base64"))
}

function verdict(v, px) {
  const why = []
  if (!v.map?.visible || v.map.inView < 0.85) why.push(`map not on screen (inView ${v.map?.inView})`)
  if (!v.minimap?.visible || v.minimap.inView < 0.99) why.push("minimap not on screen")
  if (!v.ship?.visible || !v.ship.inMap) why.push("XO craft not on screen")
  if (!v.companion?.visible || !v.companion.inMap) why.push("XOE companion not on screen")
  if (v.settlersOnScreen < 1) why.push("no settlers on screen")
  if (!px || px.blank) why.push("map pixels blank")
  if (v.miniPixels && !v.miniPixels.error && v.miniPixels.litShare < 0.01) why.push("minimap canvas blank")
  if (v.docW > v.viewport[0] + 1) why.push(`horizontal overflow ${v.docW} > ${v.viewport[0]}`)
  return why
}

const { base, close } = await serve(DIST)
const fileUrl = pathToFileURL(SINGLE).href
const only = process.env.XOE_CASES ? process.env.XOE_CASES.split(",") : null
const cases = []
for (const device of ["iphone15", "iphone15-landscape"])
  for (const via of ["http", "file"])
    for (const player of ["fresh", "returning"]) cases.push({ device, via, player })

const results = []
for (const c of cases) {
  const tag = `${BROWSER}-${c.device}-${c.via}-${c.player}`
  if (only && !only.some((o) => tag.includes(o))) continue
  const s = await openGame({ device: c.device, browserName: BROWSER, url: c.via === "http" ? base : fileUrl, seed: seedFor(c.player), serviceWorkers: c.via === "http" ? "allow" : "block" })
  const rec = { tag, ...c }
  try {
    rec.front = { phase: await phaseOf(s), startVisible: await s.page.getByRole("button", { name: "Start", exact: true }).isVisible().catch(() => false) }
    await s.page.screenshot({ path: path.join(OUT, `${BROWSER}-${c.device}-${c.via}-${c.player}-front.png`) })
    rec.setup = await setupPilot(s)
    await wait(s, 900)
    rec.phase = await phaseOf(s)
    // as the player first sees it: no scrolling and no taps after Start when ready
    rec.firstView = await onScreen(s.page)
    rec.firstPixels = await mapPixels(s.page, rec.firstView.map)
    rec.firstWhy = verdict(rec.firstView, rec.firstPixels)
    const shot = path.join(OUT, `${BROWSER}-${c.device}-${c.via}-${c.player}-map.png`)
    await s.page.screenshot({ path: shot })
    rec.screenshot = shot
    if (c.via === "http") {
      rec.serviceWorker = await s.page.evaluate(async () => {
        if (!("serviceWorker" in navigator)) return "unsupported"
        try {
          return await Promise.race([navigator.serviceWorker.ready.then(() => "ready"), new Promise((res) => setTimeout(() => res("not-ready-3s"), 3000))])
        } catch (e) { return String(e) }
      })
      rec.manifest = await s.page.evaluate(() => document.querySelector("link[rel=manifest]")?.getAttribute("href") || null)
    }
  } catch (e) {
    rec.failure = String(e)
    await s.page.screenshot({ path: path.join(OUT, `${BROWSER}-${c.device}-${c.via}-${c.player}-failure.png`) }).catch(() => {})
  }
  rec.errors = s.errors.filter((e) => !/Service Worker registration blocked/.test(e))
  results.push(rec)
  await closeGame(s)
  console.log(tag, rec.phase, rec.failure || "", rec.firstWhy?.length ? "FAIL: " + rec.firstWhy.join("; ") : "ok", rec.errors.length ? rec.errors : "")
}
await close()
const report = { browser: BROWSER, single: SINGLE, dist: DIST, at: new Date().toString(), results }
fs.writeFileSync(path.join(OUT, `${BROWSER}-iphone.json`), JSON.stringify(report, null, 2))
const failed = results.filter((r) => r.failure || r.phase !== "colony-map" || r.firstWhy?.length || r.errors.length)
console.log(`${BROWSER} iPhone review: ${results.length - failed.length}/${results.length} pass`)
if (failed.length) process.exitCode = 1
