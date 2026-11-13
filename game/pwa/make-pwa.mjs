/**
 * Build the XOE Home Screen app folder from the finished single-file build.
 *   node pwa/make-pwa.mjs <single-file.html> <out-dir> <cache-version>
 * Writes index.html, manifest.webmanifest, sw.js, icons/. Local only; publishing it needs Eddie's OK.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { APPLE_ICON, ICON_FILES, makeManifest } from "./manifest.mjs"

const [src, out, version = "v18"] = process.argv.slice(2)
if (!src || !out) {
  console.error("usage: node pwa/make-pwa.mjs <single-file.html> <out-dir> [cache-version]")
  process.exit(1)
}
mkdirSync(resolve(out, "icons"), { recursive: true })
for (const f of ["icon-180.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png"]) {
  copyFileSync(resolve("pwa/icons", f), resolve(out, "icons", f))
}
writeFileSync(resolve(out, "manifest.webmanifest"), `${JSON.stringify(makeManifest(ICON_FILES), null, 2)}\n`)

// Swap the inlined (data:) icon + manifest for real files, and register the service worker.
let html = readFileSync(src, "utf8")
const swap = (marker, tag) => {
  const re = new RegExp(`<link[^>]*data-xoe-app="${marker}"[^>]*>`)
  const m = html.match(re)
  if (!m) throw new Error(`missing ${marker} link`)
  const at = html.indexOf(m[0])
  html = html.slice(0, at) + tag + html.slice(at + m[0].length)
}
swap("icon", `<link rel="apple-touch-icon" href="${APPLE_ICON}">`)
swap("manifest", `<link rel="manifest" href="manifest.webmanifest">`)
const reg = `<script>if("serviceWorker"in navigator&&location.protocol!=="file:"){addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){})})}</script>\n`
const head = html.indexOf("</head>")
html = html.slice(0, head) + reg + html.slice(head)
writeFileSync(resolve(out, "index.html"), html)

const files = ["./", "index.html", "manifest.webmanifest", ...ICON_FILES.map((i) => i.src), APPLE_ICON]
writeFileSync(
  resolve(out, "sw.js"),
  `/* XOE offline play: cache the game shell. Prices and Grok Bot always use the network (never cached). */
const CACHE = "xoe-${version}"
const FILES = ${JSON.stringify(files)}
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()))
})
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("xoe-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})
self.addEventListener("fetch", (e) => {
  const req = e.request
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return
  e.respondWith(
    caches.match(req, { ignoreSearch: req.mode === "navigate" }).then(
      (hit) => hit || fetch(req).catch(() => (req.mode === "navigate" ? caches.match("index.html") : Response.error())),
    ),
  )
})
`,
)
console.log(`make-pwa: wrote ${out} (cache xoe-${version})`)
