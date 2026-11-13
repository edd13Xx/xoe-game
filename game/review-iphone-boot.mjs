#!/usr/bin/env node
/** Diagnose iPhone boot: file:// vs http, storage on/off, JS on/off. Local only. */
import { createServer } from "node:http"
import { readFile, stat } from "node:fs/promises"
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL, fileURLToPath } from "node:url"
import { chromium, webkit, devices } from "playwright"

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const BUILD = path.resolve(process.argv[2] || path.join(ROOT, "dist/index.html"))
// v19 WebKit pass: file:// opens the single-file delivery HTML (what a phone gets from Files); http serves dist/ (the PWA).
const SINGLE = path.resolve(process.argv[3] || path.join(ROOT, "Unknown-Orbital-Engine-XOE-v19-2026-11-10.html"))
const OUT = path.join(ROOT, "review/iphone-boot.json")
const shotDir = path.join(ROOT, "review")
fs.mkdirSync(shotDir, { recursive: true })

async function maybeWebkit() {
  try {
    const b = await webkit.launch({ headless: true })
    return b
  } catch {
    return null
  }
}

async function serve(file) {
  const dir = path.dirname(file)
  const server = createServer(async (req, res) => {
    try {
      const name = decodeURIComponent(new URL(req.url, "http://local").pathname)
      const target = path.resolve(dir, "." + (name === "/" ? "/index.html" : name))
      if (!target.startsWith(dir + path.sep) && target !== file) throw new Error("outside")
      const data = await readFile(target)
      const ext = path.extname(target)
      res.setHeader(
        "content-type",
        ext === ".js"
          ? "text/javascript"
          : ext === ".webmanifest"
            ? "application/manifest+json"
            : ext === ".png"
              ? "image/png"
              : "text/html",
      )
      res.end(data)
    } catch {
      res.statusCode = 404
      res.end("Not found")
    }
  })
  await new Promise((r) => server.listen(0, "127.0.0.1", r))
  const base = `http://127.0.0.1:${server.address().port}`
  return { base, close: () => new Promise((r) => server.close(r)) }
}

function collect(page, bag) {
  page.on("console", (m) => bag.console.push({ type: m.type(), text: m.text() }))
  page.on("pageerror", (e) => bag.pageErrors.push(String(e)))
  page.on("requestfailed", (req) => bag.failed.push(`${req.failure()?.errorText || "fail"} ${req.url()}`))
}

async function snapshot(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s)
    const visible = (el) => {
      if (!el) return false
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      return r.width > 2 && r.height > 2 && s.visibility !== "hidden" && s.display !== "none"
    }
    return {
      ready: document.getElementById("root")?.getAttribute("data-xoe-ready") || null,
      phase: document.body?.dataset?.phase || document.querySelector("[data-phase]")?.getAttribute("data-phase") || null,
      menu: !!q("[data-menu=launch]"),
      start: !!q("button"),
      map: visible(q(".mars-world-shell")),
      minimap: visible(q(".minimap-hud")),
      ship: visible(q(".xo-avatar")),
      companion: visible(q("[data-cast=xoe]")),
      settlers: document.querySelectorAll("[data-cast=settler]").length,
      bootHint: !!q("#xoe-boot-hint"),
      noscript: !!q("noscript"),
      title: document.title,
      rootText: (q("#root")?.innerText || "").slice(0, 240),
    }
  })
}

async function runCase({ browserType, name, url, storage, js, device, afterStart }) {
  const bag = { name, urlKind: url.startsWith("file:") ? "file" : "http", storage, js, console: [], pageErrors: [], failed: [], snapshot: null }
  const launcher = browserType === "webkit" ? webkit : chromium
  let browser
  try {
    browser = await launcher.launch({ headless: true })
  } catch (e) {
    bag.failure = `launch failed: ${e}`
    return bag
  }
  const d = devices[device] || devices["iPhone 15"]
  const context = await browser.newContext({
    ...d,
    javaScriptEnabled: js,
    serviceWorkers: "block",
  })
  if (!storage) {
    await context.addInitScript(() => {
      const boom = () => {
        throw new DOMException("The operation is insecure.", "SecurityError")
      }
      for (const kind of ["localStorage", "sessionStorage"]) {
        try {
          Object.defineProperty(window, kind, { configurable: true, get: boom })
        } catch { /* ignore */ }
      }
      try {
        Object.defineProperty(window, "indexedDB", { configurable: true, get: boom })
      } catch { /* ignore */ }
    })
  }
  const page = await context.newPage()
  collect(page, bag)
  page.on("crash", () => bag.pageErrors.push("page crashed"))
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 })
    await page.waitForTimeout(800)
    bag.snapshot = await snapshot(page)
    if (js && afterStart) {
      const start = page.getByRole("button", { name: "Start", exact: true })
      if (await start.count()) {
        await start.click({ timeout: 5000 }).catch(() => {})
        await page.waitForTimeout(400)
        const ready = page.getByRole("button", { name: "Start when ready" })
        if (await ready.count()) {
          for (const t of ["Female", "Sentinel", "I confirm I have seen the simulation disclaimer."]) {
            const loc = page.getByText(t, { exact: true }).first()
            if (await loc.count()) await loc.click({ force: true }).catch(() => {})
            const nameAttr = t === "Female" ? "player-gender" : t === "Sentinel" ? "player-class" : null
            if (nameAttr) await page.locator(`input[name="${nameAttr}"]`).first().check({ force: true }).catch(() => {})
          }
          const roster = page.locator(".roster-row").first()
          if (await roster.count()) await roster.click().catch(() => {})
          await ready.click({ timeout: 5000 }).catch(() => {})
          await page.waitForTimeout(900)
        }
      }
      bag.afterStart = await snapshot(page)
      const shot = path.join(shotDir, `iphone-boot-${bag.urlKind}-${storage ? "storage" : "nostorage"}-${name}.png`)
      bag.device = device
      await page.screenshot({ path: shot, fullPage: false }).catch(() => {})
      bag.screenshot = shot
    } else if (!js) {
      const shot = path.join(shotDir, `iphone-boot-nojs-${bag.urlKind}.png`)
      await page.screenshot({ path: shot, fullPage: false }).catch(() => {})
      bag.screenshot = shot
    }
  } catch (e) {
    bag.failure = String(e)
  } finally {
    await browser.close().catch(() => {})
  }
  return bag
}

const htmlStat = await stat(BUILD)
const fileUrl = pathToFileURL(fs.existsSync(SINGLE) ? SINGLE : BUILD).href
const { base, close } = await serve(BUILD)
const httpUrl = base + "/"
const hasWebkit = await maybeWebkit()
if (hasWebkit) await hasWebkit.close()

const cases = []
const types = hasWebkit ? ["webkit", "chromium"] : ["chromium"]
for (const type of types) {
  for (const device of type === "webkit" ? ["iPhone 15", "iPhone 15 landscape"] : ["iPhone 15"]) {
    const tag = `${type}${device.includes("landscape") ? "-landscape" : ""}`
    cases.push(runCase({ browserType: type, name: `${tag}-http`, url: httpUrl, storage: true, js: true, device, afterStart: true }))
    cases.push(runCase({ browserType: type, name: `${tag}-file`, url: fileUrl, storage: true, js: true, device, afterStart: true }))
    cases.push(runCase({ browserType: type, name: `${tag}-http-nostorage`, url: httpUrl, storage: false, js: true, device, afterStart: true }))
    cases.push(runCase({ browserType: type, name: `${tag}-file-nostorage`, url: fileUrl, storage: false, js: true, device, afterStart: true }))
  }
}
const nojsType = hasWebkit ? "webkit" : "chromium"
cases.push(runCase({ browserType: nojsType, name: `${nojsType}-nojs-file`, url: fileUrl, storage: true, js: false, device: "iPhone 15", afterStart: false }))
cases.push(runCase({ browserType: nojsType, name: `${nojsType}-nojs-http`, url: httpUrl, storage: true, js: false, device: "iPhone 15", afterStart: false }))

const results = []
for (const c of cases) results.push(await c)
await close()

const report = {
  build: BUILD,
  single: SINGLE,
  bytes: htmlStat.size,
  webkitAvailable: Boolean(hasWebkit),
  results: results.map((r) => ({
    ...r,
    console: r.console.filter((c) => c.type === "error" || c.type === "warning").slice(0, 20),
    pageErrors: r.pageErrors.slice(0, 20),
    failed: r.failed.slice(0, 20),
  })),
}
fs.writeFileSync(OUT, JSON.stringify(report, null, 2))
const bad = report.results.filter((r) => r.failure || r.pageErrors.length || (r.js && r.afterStart && !(r.afterStart.phase === "colony-map" && r.afterStart.map && r.afterStart.minimap && r.afterStart.ship && r.afterStart.companion && r.afterStart.settlers > 0)) || (!r.js && !r.snapshot?.bootHint))
if (bad.length) process.exitCode = 1
console.log(JSON.stringify({ webkitAvailable: report.webkitAvailable, cases: report.results.map((r) => ({ name: r.name, urlKind: r.urlKind, storage: r.storage, js: r.js, failure: r.failure || null, errors: r.pageErrors, after: r.afterStart || r.snapshot })) }, null, 2))
