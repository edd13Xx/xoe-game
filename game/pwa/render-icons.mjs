// Render the XOE app icon SVG to PNGs (local only, headless Chromium).
import { chromium } from "playwright"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
const here = fileURLToPath(new URL(".", import.meta.url))
const svg = readFileSync(`${here}app-icon.svg`, "utf8")
const sizes = [
  ["icon-180.png", 180, 0], // apple-touch-icon
  ["icon-192.png", 192, 0],
  ["icon-512.png", 512, 0],
  ["icon-maskable-512.png", 512, 0.12], // extra safe-zone padding for Android masks
]
const browser = await chromium.launch()
const page = await browser.newPage()
for (const [name, size, pad] of sizes) {
  const inner = Math.round(size * (1 - pad * 2))
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<html><body style="margin:0;background:#0b0d12;display:grid;place-items:center;width:${size}px;height:${size}px">
    <div style="width:${inner}px;height:${inner}px">${svg.replace('width="512" height="512"', `width="${inner}" height="${inner}"`)}</div></body></html>`)
  await page.screenshot({ path: `${here}icons/${name}`, omitBackground: false })
}
await browser.close()
console.log("icons:", sizes.map((s) => s[0]).join(", "))
