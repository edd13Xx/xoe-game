/**
 * Post-process Vite singlefile output so it runs from file:// on mobile Safari.
 * Classic <script> in <head> runs before #root; move it to end of <body>.
 * IMPORTANT: do not use String.replace with a string replacement — the bundle
 * contains "$&" (Preact), which replace() would expand to the matched text.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { APPLE_ICON, makeManifest } from "../pwa/manifest.mjs"

const distHtml = resolve("dist/index.html")
if (!existsSync(distHtml)) {
  console.error("make-standalone: dist/index.html missing — run vite build first")
  process.exit(1)
}

let html = readFileSync(distHtml, "utf8")
const match = html.match(/<script[^>]*>([\s\S]*?)<\/script>/)
if (!match) {
  console.error("make-standalone: no script block found")
  process.exit(1)
}

const scriptBody = match[1]
html = html.replace(match[0], "")
html = html.replace(/<link rel="icon"[^>]*>\s*/i, "")

// v18: Home Screen icon + manifest, inlined so the single file stays one file.
// (A service worker can't live inside one HTML file; see pwa/make-pwa.mjs for the app folder.)
const dataPng = (rel) => `data:image/png;base64,${readFileSync(resolve("pwa", rel)).toString("base64")}`
const manifest = makeManifest([{ src: dataPng("icons/icon-192.png"), sizes: "192x192", type: "image/png", purpose: "any" }])
const appLinks =
  `<link rel="apple-touch-icon" href="${dataPng(APPLE_ICON)}" data-xoe-app="icon">\n` +
  `<link rel="manifest" href="data:application/manifest+json;base64,${Buffer.from(JSON.stringify(manifest)).toString("base64")}" data-xoe-app="manifest">\n`
const titleEnd = html.indexOf("</title>")
if (titleEnd < 0) {
  console.error("make-standalone: no </title>")
  process.exit(1)
}
html = `${html.slice(0, titleEnd + 8)}\n${appLinks}${html.slice(titleEnd + 8)}`

const close = "</body>"
const at = html.lastIndexOf(close)
if (at < 0) {
  console.error("make-standalone: no </body>")
  process.exit(1)
}
html = `${html.slice(0, at)}<script>\n${scriptBody}\n</script>\n${html.slice(at)}`
writeFileSync(distHtml, html)

// sanity: Preact "$&" must survive
if (!html.includes("-$&") && html.includes("Me.test")) {
  console.warn("make-standalone: warning — expected -$& marker missing after write")
}
if (html.includes("-</body>`).toLowerCase()")) {
  console.error("make-standalone: corrupted $& → </body> in bundle")
  process.exit(1)
}
console.log("make-standalone: classic end-of-body script ready for file://")
