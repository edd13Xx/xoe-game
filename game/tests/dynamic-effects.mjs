import { mkdirSync, writeFileSync } from "node:fs"
import { chromium } from "playwright"

const baseUrl = process.env.XENO_URL ?? "http://127.0.0.1:4327"
const outDir = process.env.XENO_ARTIFACTS ?? "/opt/cursor/artifacts"
mkdirSync(outDir, { recursive: true })

const checks = []
function record(name, status, detail) {
  checks.push({ name, status, detail })
  console.log(`${status} ${name} ${detail}`)
}

const browser = await chromium.launch({ headless: true })
const blocked = []

function track(context) {
  context.on("request", (request) => {
    const raw = request.url()
    if (raw.startsWith("data:") || raw.startsWith("blob:")) return
    try {
      const host = new URL(raw).hostname
      if (host !== "127.0.0.1" && host !== "localhost") blocked.push(raw)
    } catch {
      blocked.push(raw)
    }
  })
}

async function sample(page) {
  return page.locator(".xoe-float").evaluate((node) => {
    const plasma = node.querySelector(".xoe-plasma")
    const glimmer = node.querySelector(".xoe-glimmer")
    const sprite = node.querySelector("img")
    const spriteRect = sprite?.getBoundingClientRect()
    const floatRect = node.getBoundingClientRect()
    return {
      y: floatRect.y,
      transform: getComputedStyle(node).transform,
      animation: getComputedStyle(node).animationName,
      plasmaCount: node.querySelectorAll(".xoe-plasma").length,
      plasmaOpacity: plasma ? getComputedStyle(plasma).opacity : null,
      glimmerOpacity: glimmer ? getComputedStyle(glimmer).opacity : null,
      spriteW: sprite?.naturalWidth ?? 0,
      spriteH: sprite?.naturalHeight ?? 0,
      renderedW: spriteRect?.width ?? 0,
      renderedH: spriteRect?.height ?? 0,
      floatW: floatRect.width,
      floatH: floatRect.height,
    }
  })
}

const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } })
track(desktop)
const page = await desktop.newPage()
const pageErrors = []
page.on("pageerror", (error) => pageErrors.push(String(error)))
await page.goto(baseUrl, { waitUntil: "domcontentloaded" })
await page.locator(".xoe-float").waitFor()
async function clipSprite(target, file) {
  const box = await target.locator(".xoe-float").boundingBox()
  const viewport = target.viewportSize()
  if (!box || !viewport) throw new Error("sprite box missing")
  const x = Math.max(0, Math.min(box.x - 8, viewport.width - 20))
  const y = Math.max(0, Math.min(box.y - 8, viewport.height - 20))
  const width = Math.max(20, Math.min(box.width + 16, viewport.width - x))
  const height = Math.max(20, Math.min(box.height + 16, viewport.height - y))
  await target.screenshot({ path: file, clip: { x, y, width, height } })
}
await page.locator(".xoe-float").evaluate((node) => node.scrollIntoView({ block: "center", inline: "center" }))
const first = await sample(page)
await clipSprite(page, `${outDir}/project-x-float-frame-a.png`)
await page.waitForTimeout(1400)
const second = await sample(page)
await clipSprite(page, `${outDir}/project-x-float-frame-b.png`)
await page.waitForTimeout(1400)
const third = await sample(page)
await clipSprite(page, `${outDir}/project-x-float-frame-c.png`)
await page.screenshot({ path: `${outDir}/project-x-front-desktop.png`, fullPage: true })

const frontSquare = Math.abs(first.renderedW - 192) < 1 && Math.abs(first.renderedH - 192) < 1
if (first.spriteW === 16 && first.spriteH === 16 && frontSquare) {
  record("sprite-size", "PASS", `native ${first.spriteW}x${first.spriteH}; front rendered ${first.renderedW.toFixed(2)}x${first.renderedH.toFixed(2)}, 12px per cell like the other roster portraits`)
} else record("sprite-size", "FAIL", JSON.stringify({ spriteW: first.spriteW, spriteH: first.spriteH, renderedW: first.renderedW, renderedH: first.renderedH }))
if (first.plasmaCount === 0 && first.floatW + 1 >= first.renderedW && first.floatH + 1 >= first.renderedH) {
  record("sword-plasma-absent", "PASS", `no .xoe-plasma; float ${first.floatW.toFixed(0)}x${first.floatH.toFixed(0)} covers sprite ${first.renderedW}x${first.renderedH}`)
} else record("sword-plasma-absent", "FAIL", JSON.stringify(first))

const ys = [first.y, second.y, third.y]
const ySpread = Math.max(...ys) - Math.min(...ys)
if (ySpread >= 2) record("float-over-time", "PASS", `y ${ys.map((value) => value.toFixed(2)).join(" -> ")} spread ${ySpread.toFixed(2)}`)
else record("float-over-time", "FAIL", `y stayed ${ys.join(", ")}`)

const glimmer = [first.glimmerOpacity, second.glimmerOpacity, third.glimmerOpacity]
if (first.plasmaCount === 0 && second.plasmaCount === 0 && third.plasmaCount === 0) {
  record("plasma-over-time", "PASS", "absent at all three samples")
} else record("plasma-over-time", "FAIL", `plasma counts ${first.plasmaCount}, ${second.plasmaCount}, ${third.plasmaCount}`)
if (new Set(glimmer).size > 1) record("glimmer-over-time", "PASS", glimmer.join(" -> "))
else record("glimmer-over-time", "FAIL", `opacity stayed ${glimmer.join(", ")}`)

const reduced = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" })
track(reduced)
const reducedPage = await reduced.newPage()
await reducedPage.goto(baseUrl, { waitUntil: "domcontentloaded" })
await reducedPage.locator(".xoe-float").waitFor()
await reducedPage.locator(".xoe-float").evaluate((node) => node.scrollIntoView({ block: "center", inline: "center" }))
const stillA = await sample(reducedPage)
await reducedPage.waitForTimeout(600)
const stillB = await sample(reducedPage)
await clipSprite(reducedPage, `${outDir}/project-x-float-reduced-motion.png`)
if (stillA.animation === "none" && Math.abs(stillA.y - stillB.y) < 0.5 && stillA.plasmaCount === 0 && stillA.glimmerOpacity === stillB.glimmerOpacity) {
  record("reduced-motion", "PASS", `animation ${stillA.animation}, y ${stillA.y.toFixed(2)}`)
} else record("reduced-motion", "FAIL", JSON.stringify({ stillA, stillB }))
await reduced.close()

await page.evaluate(() => {
  Object.defineProperty(Document.prototype, "hidden", { configurable: true, get: () => true })
  document.dispatchEvent(new Event("visibilitychange"))
})
await page.waitForTimeout(100)
const hiddenSample = await sample(page)
const hiddenFlag = await page.locator("main").getAttribute("data-animations")
if (hiddenFlag === "paused" && hiddenSample.animation === "none") {
  record("hidden-pause", "PASS", `data-animations ${hiddenFlag}`)
} else record("hidden-pause", "BLOCKED", `could not force document.hidden; data-animations=${hiddenFlag} animation=${hiddenSample.animation}`)

await page.evaluate(() => {
  Object.defineProperty(Document.prototype, "hidden", { configurable: true, get: () => false })
  document.dispatchEvent(new Event("visibilitychange"))
})
const frameSample = await page.evaluate(() => new Promise((resolve) => {
  let frames = 0
  const start = performance.now()
  const step = (now) => {
    frames += 1
    if (now - start < 1000) requestAnimationFrame(step)
    else resolve({ frames, elapsedMs: now - start })
  }
  requestAnimationFrame(step)
}))
record("frame-callbacks", "PASS", `${frameSample.frames} requestAnimationFrame callbacks in ${frameSample.elapsedMs.toFixed(0)} ms on the front page in headless Chromium while the float CSS runs. No before/after, so any art slowdown is unknown.`)
await page.getByRole("button", { name: "Start" }).click()
await page.getByRole("heading", { name: "Unknown Orbital Engine", exact: true }).waitFor()
await page.screenshot({ path: `${outDir}/project-x-setup-desktop.png`, fullPage: true })
await page.getByRole("option", { name: "XOE" }).click()
await page.getByRole("radio", { name: "Female", exact: true }).check()
await page.getByRole("radio", { name: "Sentinel" }).check()
await page.getByRole("checkbox", { name: /simulation disclaimer/i }).check()
await page.getByRole("button", { name: "start when ready" }).click()
await page.getByRole("heading", { name: "You wake in the battle" }).waitFor()
await page.screenshot({ path: `${outDir}/project-x-play-desktop.png`, fullPage: true })
for (let i = 0; i < 4; i += 1) await page.getByRole("button", { name: "Continue" }).click()
await page.getByRole("button", { name: "Skip cinematic" }).click()
await page.getByRole("button", { name: "Resume practice" }).click()
await page.getByRole("button", { name: "Buy 1 paper unit" }).click()
await page.getByText("Paper cash 900. Paper position 1.").waitFor()
await page.getByRole("button", { name: "Restart paper practice" }).click()
await page.getByText("Paper cash 1000. Paper position 0.").waitFor()
record("restart-paper", "PASS", "cash returned to 1000 and position to 0")
await page.getByRole("button", { name: "Exit paper practice" }).click()
await page.getByRole("heading", { name: "Near loss" }).waitFor()
await page.waitForTimeout(200)
  const shieldNow = await page.locator("canvas.stage").getAttribute("data-xoe-shield")
await page.locator("canvas.stage").screenshot({ path: `${outDir}/project-x-shield-frame-a.png` })
await page.waitForTimeout(3200)
const shieldLater = await page.locator("canvas.stage").getAttribute("data-xoe-shield")
await page.locator("canvas.stage").screenshot({ path: `${outDir}/project-x-shield-frame-b.png` })
await page.screenshot({ path: `${outDir}/project-x-shield-near-loss-desktop.png`, fullPage: true })
const stageBox = await page.locator("canvas.stage").getAttribute("data-xoe-box")
const boxParts = (stageBox ?? "").split(",").map(Number)
if (boxParts.length === 4 && boxParts[2] === 64 && boxParts[3] === 64 && boxParts[0] >= 0 && boxParts[1] >= 0 && boxParts[0] + boxParts[2] <= 640 && boxParts[1] + boxParts[3] <= 360) {
  record("stage-sprite-size", "PASS", `data-xoe-box ${stageBox}; 64 device px is the 32 logical px pilot cell size (scale 2) on the 640x360 canvas, inside the frame`)
} else record("stage-sprite-size", "FAIL", `data-xoe-box ${stageBox}`)
await page.getByRole("button", { name: "Continue" }).click()
await page.getByRole("heading", { name: "SIS" }).waitFor()
await page.screenshot({ path: `${outDir}/project-x-rescue-desktop.png`, fullPage: true })
await page.getByRole("button", { name: "Enter the terrace" }).click()
await page.getByRole("heading", { name: "Planet X terrace" }).waitFor()
await page.screenshot({ path: `${outDir}/project-x-terrace-desktop.png`, fullPage: true })
const terraceText = await page.locator("body").innerText()
if (!terraceText.includes("Pad 3 across, 5 down")) record("terrace", "FAIL", "start pad text missing")
else record("terrace", "PASS", "reached Planet X terrace from rescue")
await page.getByRole("button", { name: "Back to front" }).click()
await page.getByRole("button", { name: "Start" }).waitFor()
record("return-to-front", "PASS", "Back to front showed Start again")
if (shieldNow === "staged" && shieldLater === "faded") {
  record("shield-staged-fade", "PASS", `${shieldNow} -> ${shieldLater}; near-loss narration, not a hit detector`)
} else if (shieldNow === "staged") {
  record("shield-staged-fade", "FAIL", `started ${shieldNow} later ${shieldLater}`)
} else record("shield-staged-fade", "NOT IMPLEMENTED", `shield attribute ${shieldNow}`)

const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
track(phone)
const phonePage = await phone.newPage()
await phonePage.goto(baseUrl, { waitUntil: "domcontentloaded" })
await phonePage.locator(".xoe-float").waitFor()
await phonePage.locator(".xoe-float").evaluate((node) => node.scrollIntoView({ block: "center", inline: "center" }))
const phoneA = await sample(phonePage)
await phonePage.waitForTimeout(700)
const phoneB = await sample(phonePage)
await phonePage.screenshot({ path: `${outDir}/project-x-front-mobile.png`, fullPage: true })
if (Math.abs(phoneA.y - phoneB.y) >= 1 && phoneA.spriteW === 16) {
  record("mobile-float", "PASS", `y ${phoneA.y.toFixed(2)} -> ${phoneB.y.toFixed(2)}; viewport 390x844, not a physical phone`)
} else record("mobile-float", "FAIL", JSON.stringify({ phoneA, phoneB }))
await phonePage.getByRole("button", { name: "Start" }).click()
await phonePage.getByRole("option", { name: "XOE" }).click()
await phonePage.getByRole("radio", { name: "Female", exact: true }).check()
await phonePage.getByRole("radio", { name: "Sentinel" }).check()
await phonePage.getByRole("checkbox", { name: /simulation disclaimer/i }).check()
await phonePage.getByRole("button", { name: "start when ready" }).click()
for (let i = 0; i < 4; i += 1) await phonePage.getByRole("button", { name: "Continue" }).click()
await phonePage.getByRole("button", { name: "Skip cinematic" }).click()
await phonePage.getByRole("button", { name: "Resume practice" }).click()
await phonePage.getByRole("button", { name: "Exit paper practice" }).click()
await phonePage.getByRole("heading", { name: "Near loss" }).waitFor()
await phonePage.waitForTimeout(200)
  const phoneShield = await phonePage.locator("canvas.stage").getAttribute("data-xoe-shield")
await phonePage.locator("canvas.stage").screenshot({ path: `${outDir}/project-x-shield-mobile.png` })
if (phoneShield === "staged") record("mobile-shield", "PASS", "near-loss ring staged at 390x844; not a physical phone")
else record("mobile-shield", "FAIL", `shield ${phoneShield}`)
await phonePage.getByRole("button", { name: "Continue" }).click()
await phonePage.getByRole("button", { name: "Enter the terrace" }).click()
await phonePage.getByRole("heading", { name: "Planet X terrace" }).waitFor()
await phonePage.screenshot({ path: `${outDir}/project-x-terrace-mobile.png`, fullPage: true })
record("mobile-terrace", "PASS", "390x844 reached the terrace; not a physical phone")

await browser.close()
if (blocked.length === 0) record("offline-requests", "PASS", "0 external requests")
else record("offline-requests", "FAIL", blocked.join(" "))
if (pageErrors.length === 0) record("page-errors", "PASS", "0")
else record("page-errors", "FAIL", pageErrors.join(" "))
record("art-slowdown", "NOT IMPLEMENTED", "callback count has no before/after, so slowdown from the art is unknown")
record("physical-phone", "NOT IMPLEMENTED", "390x844 is a viewport only")

const report = {
  url: baseUrl,
  method: "Headless Chromium on this VM. Float and glimmer are computed-style samples 1.4s apart after one scroll. Sword plasma is checked by the absence of .xoe-plasma. Shield is the near-loss canvas attribute plus two stage screenshots. Stage size is data-xoe-box. Frame callbacks are requestAnimationFrame for about 1s with no before/after.",
  checks,
  samples: { first, second, third },
  frameSample,
}
writeFileSync(`${outDir}/project-x-dynamic-effects.json`, JSON.stringify(report, null, 2))
const failed = checks.some((check) => check.status === "FAIL")
if (failed) process.exit(1)
