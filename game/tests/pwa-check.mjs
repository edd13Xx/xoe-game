// Serve the PWA folder on 127.0.0.1 only, check manifest + service worker + offline reload.
import { chromium } from "playwright"
import http from "node:http"
import { readFile } from "node:fs/promises"
import { extname, join } from "node:path"
const [dir, out] = process.argv.slice(2)
const types = { ".html": "text/html", ".js": "text/javascript", ".webmanifest": "application/manifest+json", ".png": "image/png" }
const server = http.createServer(async (req, res) => {
  const p = new URL(req.url, "http://x").pathname
  try {
    const body = await readFile(join(dir, p === "/" ? "index.html" : p))
    res.writeHead(200, { "content-type": types[extname(p)] ?? "text/html" })
    res.end(body)
  } catch {
    res.writeHead(404).end()
  }
}).listen(18800, "127.0.0.1")
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort())
const page = await ctx.newPage()
await page.goto("http://127.0.0.1:18800/index.html")
await page.evaluate(() => navigator.serviceWorker.ready)
await page.waitForTimeout(800)
const info = await page.evaluate(async () => ({
  title: document.title,
  manifest: await (await fetch(document.querySelector('link[rel="manifest"]').href)).json(),
  apple: document.querySelector('link[rel="apple-touch-icon"]').getAttribute("href"),
  capable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content,
  sw: !!navigator.serviceWorker.controller || (await navigator.serviceWorker.getRegistrations()).length > 0,
}))
await page.screenshot({ path: `${out}/v18-pwa-online.png` })
server.close()
await ctx.setOffline(true)
await page.reload()
await page.getByRole("heading", { name: "Unknown Orbital Engine", includeHidden: true }).first().waitFor({ timeout: 10000 })
await page.screenshot({ path: `${out}/v18-pwa-offline-reload.png` })
console.log(JSON.stringify({ ...info, manifest: { name: info.manifest.name, short_name: info.manifest.short_name, display: info.manifest.display, theme_color: info.manifest.theme_color, icons: info.manifest.icons.length }, offlineReload: "ok" }, null, 2))
await browser.close()
