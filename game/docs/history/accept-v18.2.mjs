import { mkdirSync, renameSync, writeFileSync } from "node:fs"
import { chromium } from "playwright"

const baseUrl = process.env.XENO_URL ?? "http://127.0.0.1:4317"
const outDir = process.env.XENO_ARTIFACTS ?? "/opt/cursor/artifacts"
mkdirSync(outDir, { recursive: true })

const blocked = []
const errors = []

function track(context) {
  context.on("request", (request) => {
    const raw = request.url()
    if (raw.startsWith("data:") || raw.startsWith("blob:")) return
    let host = ""
    try {
      host = new URL(raw).hostname
    } catch {
      blocked.push(raw)
      return
    }
    if (host !== "127.0.0.1" && host !== "localhost") blocked.push(raw)
  })
}

async function enterLocalLaunch(page, shotName) {
  await page.getByRole("heading", { name: "XOE: Unknown Orbital Engine", exact: true, includeHidden: true }).waitFor()
  await page.getByText("Now, in the palm of your hands.", { exact: true }).waitFor()
  await page.getByText("Local preview on this computer. Not a public website. No account.").waitFor()
  const front = page.locator("svg.front-page, img.front-page")
  await front.first().waitFor()
  const info = await front.first().evaluate((el) => {
    const rect = el.getBoundingClientRect()
    const isSvg = el.tagName.toLowerCase() === "svg"
    return {
      isSvg,
      cover: el.getAttribute("data-cover") || "",
      label: el.getAttribute("aria-label") || el.getAttribute("alt") || "",
      width: rect.width,
      height: rect.height,
      vb: isSvg ? el.getAttribute("viewBox") : "",
    }
  })
  if (!info.isSvg && !info.label) errors.push("front cover missing")
  if (info.isSvg && info.cover !== "x-orbital-engine-v6") errors.push(`cover data ${info.cover}`)
  if (info.isSvg && !/XOE: Unknown Orbital Engine/i.test(info.label)) errors.push("cover aria-label missing title")
  if (info.width < 100 || info.height < 80) errors.push(`front cover size ${info.width}x${info.height}`)
  const spriteInfo = await page.locator("img.xoe-sprite").evaluate((img) => {
    const rect = img.getBoundingClientRect()
    const float = img.closest(".xoe-float")?.getBoundingClientRect()
    return {
      w: img.naturalWidth,
      h: img.naturalHeight,
      renderedW: rect.width,
      renderedH: rect.height,
      viewportWidth: window.innerWidth,
      floatW: float?.width ?? 0,
      floatH: float?.height ?? 0,
      box: img.closest("aside")?.getAttribute("aria-label") ?? "",
      plasma: document.querySelectorAll(".xoe-plasma").length,
    }
  })
  if (spriteInfo.w !== 16 || spriteInfo.h !== 16 || spriteInfo.box !== "XOE") {
    errors.push(`front sprite ${spriteInfo.w}x${spriteInfo.h} in ${spriteInfo.box}`)
  }
  const expectedSprite = spriteInfo.viewportWidth <= 420 ? 128 : 192
  if (Math.abs(spriteInfo.renderedW - expectedSprite) >= 1 || Math.abs(spriteInfo.renderedH - expectedSprite) >= 1) {
    errors.push(`front sprite rendered ${spriteInfo.renderedW}x${spriteInfo.renderedH}, expected ${expectedSprite}`)
  }
  if (spriteInfo.floatW + 1 < spriteInfo.renderedW || spriteInfo.floatH + 1 < spriteInfo.renderedH) {
    errors.push(`float clips sprite ${spriteInfo.floatW}x${spriteInfo.floatH} around ${spriteInfo.renderedW}x${spriteInfo.renderedH}`)
  }
  if (spriteInfo.plasma !== 0) errors.push(`plasma overlays ${spriteInfo.plasma}`)
  if ((await page.getByRole("option", { name: "XOE" }).count()) !== 0) {
    errors.push("roster was mounted on the launch screen")
  }
  const aspect = info.width / info.height
  if (!Number.isFinite(aspect) || Math.abs(aspect - 480 / 446) > 0.08) {
    errors.push(`front image displayed aspect ${aspect}`)
  }
  if (info.width < 280 || info.height < 260) errors.push("front image is too small to show the whole picture")
  if ((await page.locator("body").innerText()).includes("Choose your pilot")) {
    errors.push("roster was visible before local launch")
  }
  if (shotName) await page.screenshot({ path: `${outDir}/${shotName}`, fullPage: true })
  await page.getByRole("button", { name: "Start" }).click()
  await page.getByText("Choose your pilot. XOE is the official mascot of Unknown Orbital Engine using Grok bot. Select XOE to confirm it, or choose another character.", { exact: true }).waitFor()
  const xoeCount = await page.getByRole("option", { name: "XOE" }).count()
  if (xoeCount !== 1) errors.push(`XOE roster entries: ${xoeCount}`)
  const xoeText = await page.getByRole("option", { name: "XOE" }).innerText()
  if (!xoeText.includes("Sentinel")) errors.push("XOE is not presented as Sentinel")
  if (!xoeText.includes("XOE can be confirmed") && !(await page.locator("body").innerText()).includes("XOE can be confirmed without a rename.")) {
    errors.push("XOE confirm-without-rename line missing")
  }
}

async function continueTimes(page, count) {
  for (let i = 0; i < count; i += 1) {
    await page.getByRole("button", { name: "Continue" }).click()
  }
}

async function paperClicks(page, actions) {
  for (const action of actions) {
    const name = action === "buy" ? "Buy XOE" : "Sell XOE"
    await page.getByRole("button", { name }).click()
  }
}

function decodePng(dataUrl) {
  const marker = "base64,"
  const index = dataUrl.indexOf(marker)
  return Buffer.from(dataUrl.slice(index + marker.length), "base64")
}

async function saveXoeStage(page, label) {
  await page.locator("canvas.stage[data-xoe-box]").waitFor()
  const shot = await page.locator("canvas.stage").evaluate((canvas) => {
    const raw = canvas.dataset.xoeBox ?? ""
    const [x, y, w, h] = raw.split(",").map(Number)
    const crop = document.createElement("canvas")
    crop.width = w
    crop.height = h
    const cropCtx = crop.getContext("2d")
    cropCtx.drawImage(canvas, x, y, w, h, 0, 0, w, h)
    const zoom = document.createElement("canvas")
    zoom.width = w * 3
    zoom.height = h * 3
    const zoomCtx = zoom.getContext("2d")
    zoomCtx.imageSmoothingEnabled = true
    zoomCtx.drawImage(crop, 0, 0, zoom.width, zoom.height)
    const pixels = cropCtx.getImageData(0, 0, w, h).data
    let cyan = 0
    let visible = 0
    for (let i = 0; i < pixels.length; i += 4) {
      const red = pixels[i]
      const green = pixels[i + 1]
      const blue = pixels[i + 2]
      const alpha = pixels[i + 3]
      if (alpha > 40) visible += 1
      if (alpha > 40 && green > 150 && blue > 150 && red < 190) cyan += 1
    }
    return {
      stage: canvas.toDataURL("image/png"),
      crop: crop.toDataURL("image/png"),
      zoom: zoom.toDataURL("image/png"),
      cyan,
      visible,
    }
  })
  if (shot.visible < 500) errors.push(`${label} in-game XOE figure is missing`)
  if (shot.cyan < 80) errors.push(`${label} in-game XOE figure has no readable cyan weapon pixels (${shot.cyan})`)
  writeFileSync(`${outDir}/xeno_xoe_weapons_ingame_stage_${label}.png`, decodePng(shot.stage))
  writeFileSync(`${outDir}/xeno_xoe_weapons_ingame_sprite_${label}.png`, decodePng(shot.crop))
  writeFileSync(`${outDir}/xeno_xoe_weapons_ingame_sprite_zoom_${label}.png`, decodePng(shot.zoom))
}

async function confirmStart(page, options = {}) {
  await page.getByRole("heading", { name: "XOE: Unknown Orbital Engine", exact: true }).waitFor()
  const nameBox = page.getByRole("textbox", { name: "Name" })
  if ((await nameBox.inputValue()) !== "XOE") errors.push("default name was not XOE")
  const begin = page.getByRole("button", { name: "Start when ready" })
  if (await begin.isEnabled()) errors.push("start was enabled before required choices")
  await page.getByRole("option", { name: options.character ?? "XOE" }).click()
  if (options.name) await nameBox.fill(options.name)
  if (options.na) await page.getByRole("checkbox", { name: "NA", exact: true }).check()
  else await page.getByRole("radio", { name: options.gender ?? "Female", exact: true }).check()
  await page.getByRole("radio", { name: options.className ?? "Sentinel" }).check()
  await page.getByRole("checkbox", { name: /simulation disclaimer/i }).check()
  if (!(await begin.isEnabled())) errors.push("start stayed disabled after required choices")
  await begin.click()
}

const browser = await chromium.launch({ headless: true })

const desktop = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: outDir, size: { width: 1280, height: 800 } },
})
track(desktop)
await desktop.route("**/*", (route) => {
  const host = new URL(route.request().url()).hostname
  if (host !== "127.0.0.1" && host !== "localhost") {
    blocked.push(route.request().url())
    return route.abort()
  }
  return route.continue()
})
const page = await desktop.newPage()
page.on("pageerror", (error) => errors.push(String(error)))
await page.goto(baseUrl, { waitUntil: "domcontentloaded" })
await enterLocalLaunch(page, "project-x-front-desktop.png")
await page.getByRole("heading", { name: "XOE: Unknown Orbital Engine", exact: true }).waitFor()
await page.getByText("Choose your pilot. XOE is the official mascot of Unknown Orbital Engine using Grok bot. Select XOE to confirm it, or choose another character.", { exact: true }).waitFor()
await page.getByText("Recon is for experienced players only.", { exact: true }).waitFor()
await page.getByText("Pilot", { exact: true }).waitFor()
await page.getByText("X O E", { exact: true }).waitFor()
if ((await page.getByRole("textbox", { name: "Name" }).inputValue()) !== "XOE") errors.push("name field was not XOE")
if ((await page.title()) !== "XOE: Unknown Orbital Engine") errors.push(`title was ${await page.title()}`)
const rosterText = await page.locator("body").innerText()
if (/\bXeno\b/.test(rosterText) || /zeno/i.test(rosterText)) {
  errors.push("roster still shows Xeno or Zeno")
}
await page.screenshot({ path: `${outDir}/xeno_xo_rename_roster_desktop.png`, fullPage: true })
await page.screenshot({ path: `${outDir}/xeno_xoe_stylized_desktop.png`, fullPage: true })
{
  const box = await page.getByRole("option", { name: "XOE" }).boundingBox()
  if (box) await page.screenshot({ path: `${outDir}/project-x-roster-sprite-desktop.png`, clip: box })
}
await page.locator("summary").filter({ hasText: /^Voice settings$/ }).click()
await page.getByText("Pilot, you can change this voice in Voice settings or reset it to the browser default.").waitFor()
await page.getByRole("button", { name: "Reset to browser default" }).waitFor()
await page.getByRole("textbox", { name: "Message" }).fill("hello")
await page.getByRole("button", { name: "Send to Grok" }).click()
await page.getByText("Grok unavailable/not configured").waitFor()
await page.screenshot({ path: `${outDir}/xeno_voice_settings_desktop.png`, fullPage: true })
const desktopText = await page.locator("body").innerText()
if (desktopText.includes("Official pilot roster") || desktopText.includes("Welcome to Project X")) {
  errors.push("old roster header is still visible")
}
if (desktopText.includes("Provisional name") || desktopText.includes("Adult pilot")) {
  errors.push("provisional name label still visible")
}
await page.screenshot({ path: `${outDir}/xeno_gate_disabled_desktop.png`, fullPage: true })
await page.getByRole("option", { name: "Mara Venn" }).click()
await page.getByRole("radio", { name: "Female", exact: true }).check()
await page.getByRole("radio", { name: "Male", exact: true }).check()
await page.getByRole("checkbox", { name: "NA", exact: true }).check()
await page.screenshot({ path: `${outDir}/xeno_na_mara_desktop.png`, fullPage: true })
await page.getByRole("option", { name: "Elias Cho" }).click()
await page.getByRole("option", { name: "Nia Okonkwo" }).click()
await page.screenshot({ path: `${outDir}/xeno_roster_nia_desktop.png`, fullPage: true })
await page.getByRole("option", { name: "XOE" }).click()
await page.getByRole("radio", { name: "Female", exact: true }).check()
await page.getByRole("radio", { name: "Sentinel" }).check()
await page.getByRole("checkbox", { name: /simulation disclaimer/i }).check()
await page.screenshot({ path: `${outDir}/xeno_gate_enabled_desktop.png`, fullPage: true })
await page.getByRole("button", { name: "Start when ready" }).click()
await page.getByRole("heading", { name: "You wake in the battle" }).waitFor()
try {
  await page.waitForFunction(() => document.querySelector("canvas.stage")?.dataset.xoePresentation === "combat", null, { timeout: 3000 })
} catch {
  errors.push("wake is not using the combat still")
}
await page.getByText("You wake in a battle already involving XOE. Drones are closing in to kill you. Danger is sensed.").waitFor()
await page.getByText("Name: XOE. XOE is pronounced Zoe.").waitFor()
await page.getByText("XOE: Unknown Orbital Engine", { exact: true }).first().waitFor()
await saveXoeStage(page, "wake")
const wakeText = await page.locator("body").innerText()
if (/\bXeno\b/.test(wakeText) || /\bZeno\b/i.test(wakeText)) {
  errors.push("wake still shows Xeno or Zeno")
}
await page.screenshot({ path: `${outDir}/xeno_xo_story_wake_desktop.png`, fullPage: true })
await page.screenshot({ path: `${outDir}/xeno_xo_rename_wake_desktop.png`, fullPage: true })
await page.screenshot({ path: `${outDir}/xeno_xoe_weapons_ingame_desktop.png`, fullPage: true })
await page.getByRole("button", { name: "Continue" }).click()
await page.getByText("XOE's original pilot is missing. Not dead.").waitFor()
const wakePath = await page.locator("body").innerText()
if (/\bXeno\b/.test(wakePath) || /\bZeno\b/i.test(wakePath)) {
  errors.push("opening story still shows Xeno or Zeno")
}
await continueTimes(page, 3)
await page.getByRole("button", { name: "Skip cinematic" }).click()
await page.getByRole("heading", { name: "Practice paused" }).waitFor()
await page.getByRole("button", { name: "Bubble text on screen" }).waitFor()
await page.getByRole("button", { name: "Audio only, no dialogue text" }).waitFor()
await page.getByRole("button", { name: "Connect to Grok" }).waitFor()
await page.screenshot({ path: `${outDir}/xeno_xoe_paused_desktop.png`, fullPage: true })
await page.getByRole("button", { name: "Connect to Grok" }).click()
await page.getByText("Not connected / integration not configured").waitFor()
await page.getByRole("button", { name: "Decline Grok" }).click()
await page.getByRole("button", { name: "Resume practice" }).click()
await page.getByRole("heading", { name: "Paper trade" }).waitFor()
if ((await page.locator("canvas.stage").getAttribute("data-xoe-presentation")) !== "sprite") {
  errors.push("paper trading is not using the sprite")
}
await page.getByRole("button", { name: "Buy XOE" }).click()
await page.getByText("Paper cash 900. Paper position 1.").waitFor()
await page.getByRole("button", { name: "Restart practice" }).click()
await page.getByText("Paper cash 1000. Paper position 0.").waitFor()
await page.screenshot({ path: `${outDir}/xeno_xoe_board_desktop.png`, fullPage: true })
await paperClicks(page, ["buy", "sell", "buy", "sell"])
await page.getByText("Paper result 40.").waitFor()
await page.getByText("Paper mark = 1040 + (0 × 120) = 1040.").waitFor()
await page.screenshot({ path: `${outDir}/xeno_xoe_paper_result_desktop.png`, fullPage: true })
await page.getByRole("button", { name: "Continue story" }).click()
await page.getByRole("heading", { name: "Near loss" }).waitFor()
try {
  await page.waitForFunction(() => document.querySelector("canvas.stage")?.dataset.xoeShield === "staged", null, { timeout: 3000 })
} catch {
  errors.push("near-loss did not stage the shield flare")
}
await page.screenshot({ path: `${outDir}/project-x-shield-near-loss-desktop.png`, fullPage: true })
await page.getByRole("button", { name: "Continue" }).click()
await page.getByRole("heading", { name: "SIS" }).waitFor()
await page.screenshot({ path: `${outDir}/xeno_xoe_sis_desktop.png`, fullPage: true })
await page.getByRole("button", { name: "Enter the terrace" }).click()
await page.getByRole("heading", { name: "Planet X terrace" }).waitFor()
await page.getByText("Pad 3 across, 5 down").waitFor()
await page.getByRole("button", { name: "Move right" }).click()
await page.getByText("Pad 4 across, 5 down").waitFor()
for (let step = 0; step < 8; step += 1) await page.getByRole("button", { name: "Move right" }).click()
for (let step = 0; step < 4; step += 1) await page.getByRole("button", { name: "Move down" }).click()
await page.getByText("Pad 12 across, 9 down").waitFor()
await page.getByRole("button", { name: "Inspect sealed hatch" }).click()
await page.getByText("Underground story areas stay sealed.").waitFor()
await page.getByText("Unmarked density in the spinward fog").waitFor()
await page.getByText("Boss marked: no").waitFor()
await page.getByText("Not computed").waitFor()
await page.getByRole("button", { name: "Deposit" }).count().then((count) => {
  if (count !== 0) errors.push(`deposit buttons: ${count}`)
})
const body = await page.locator("body").innerText()
if (body.includes("XENOCOIN") || /\bBTC\b/.test(body) || /\bKAS\b/.test(body) || body.includes("Casper")) {
  errors.push("ticker or reward-asset name appeared in the UI")
}
if (/\bXeno\b/.test(body) || /\bZeno\b/i.test(body)) {
  errors.push("terrace still shows Xeno or Zeno")
}
if (body.includes("escape-machine")) { // v18.2: dev canon notes are no longer player-visible
  errors.push("terrace escape note was not named XOE")
}
await page.screenshot({ path: `${outDir}/xeno_xo_story_terrace_desktop.png`, fullPage: true })
await saveXoeStage(page, "terrace")
await page.screenshot({ path: `${outDir}/xeno_xoe_weapons_terrace_desktop.png`, fullPage: true })
await page.screenshot({ path: `${outDir}/xeno_xoe_terrace_desktop.png`, fullPage: true })
const video = page.video()
await desktop.close()
if (video) renameSync(await video.path(), `${outDir}/xeno_xoe_flow.webm`)

const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  reducedMotion: "reduce",
})
track(mobile)
await mobile.route("**/*", (route) => {
  const host = new URL(route.request().url()).hostname
  if (host !== "127.0.0.1" && host !== "localhost") {
    blocked.push(route.request().url())
    return route.abort()
  }
  return route.continue()
})
const phone = await mobile.newPage()
phone.on("pageerror", (error) => errors.push(String(error)))
await phone.goto(baseUrl, { waitUntil: "domcontentloaded" })
await enterLocalLaunch(phone, "project-x-front-mobile.png")
await phone.getByRole("heading", { name: "XOE: Unknown Orbital Engine", exact: true }).waitFor()
await phone.getByText("Choose your pilot. XOE is the official mascot of Unknown Orbital Engine using Grok bot. Select XOE to confirm it, or choose another character.", { exact: true }).waitFor()
await phone.getByText("Recon is for experienced players only.", { exact: true }).waitFor()
if ((await phone.getByRole("textbox", { name: "Name" }).inputValue()) !== "XOE") errors.push("mobile name field was not XOE")
if ((await phone.title()) !== "XOE: Unknown Orbital Engine") errors.push(`mobile title was ${await phone.title()}`)
const phoneRoster = await phone.locator("body").innerText()
if (/\bXeno\b/.test(phoneRoster) || /zeno/i.test(phoneRoster)) {
  errors.push("mobile roster still shows Xeno or Zeno")
}
await phone.screenshot({ path: `${outDir}/xeno_xo_rename_roster_mobile.png`, fullPage: true })
await phone.screenshot({ path: `${outDir}/xeno_xoe_stylized_mobile.png`, fullPage: true })
{
  const box = await phone.getByRole("option", { name: "XOE" }).boundingBox()
  if (box) await phone.screenshot({ path: `${outDir}/project-x-roster-sprite-mobile.png`, clip: box })
}
await phone.locator("summary").filter({ hasText: /^Voice settings$/ }).click()
await phone.getByText("Pilot, you can change this voice in Voice settings or reset it to the browser default.").waitFor()
await phone.screenshot({ path: `${outDir}/xeno_voice_settings_mobile.png`, fullPage: true })
if ((await phone.locator("main").getAttribute("data-reduced-motion")) !== "true") {
  errors.push("reduced motion was not applied")
}
await phone.screenshot({ path: `${outDir}/xeno_gate_disabled_mobile.png`, fullPage: true })
await phone.getByRole("option", { name: "Mara Venn" }).click()
await phone.getByRole("checkbox", { name: "NA", exact: true }).check()
await phone.screenshot({ path: `${outDir}/xeno_na_mara_mobile.png`, fullPage: true })
await phone.getByRole("option", { name: "Elias Cho" }).click()
await phone.getByRole("radio", { name: "Male", exact: true }).check()
await phone.getByRole("option", { name: "Nia Okonkwo" }).click()
await phone.screenshot({ path: `${outDir}/xeno_roster_nia_mobile.png`, fullPage: true })
await phone.getByRole("option", { name: "XOE" }).click()
await confirmStart(phone, { name: "Ren", character: "Elias Cho", gender: "Male", className: "Striker" })
await continueTimes(phone, 4)
await phone.getByRole("button", { name: "Play cinematic" }).click()
await phone.getByRole("heading", { name: "Cinematic" }).waitFor()
await phone.getByRole("button", { name: "Next panel" }).click()
await phone.getByText("XOE answers on its own.").waitFor()
const cinematicText = await phone.locator("body").innerText()
if (/\bXeno\b/.test(cinematicText) || /\bZeno\b/i.test(cinematicText)) {
  errors.push("cinematic still shows Xeno or Zeno")
}
await phone.screenshot({ path: `${outDir}/xeno_xo_story_cinematic_mobile.png`, fullPage: true })
await phone.screenshot({ path: `${outDir}/xeno_xoe_cinematic_mobile.png`, fullPage: true })
await phone.getByRole("button", { name: "Skip cinematic" }).click()
await phone.getByRole("button", { name: "Resume practice" }).click()
await phone.getByRole("button", { name: "Sell XOE" }).click()
await phone.getByText("Paper position -1.").waitFor()
await phone.getByText("-1 × 110").waitFor()
await phone.screenshot({ path: `${outDir}/xeno_xoe_paper_mobile.png`, fullPage: true })
await phone.getByRole("button", { name: "Exit paper practice" }).click()
await phone.getByRole("heading", { name: "Near loss" }).waitFor()
await phone.screenshot({ path: `${outDir}/xeno_xoe_exit_mobile.png`, fullPage: true })
await phone.getByRole("button", { name: "Continue" }).click()
await phone.getByRole("button", { name: "Enter the terrace" }).click()
await phone.getByRole("button", { name: "Move up" }).click()
await phone.getByText("Pad 3 across, 5 down").waitFor()
await phone.getByRole("button", { name: "Move right" }).click()
await phone.getByText("Pad 4 across, 5 down").waitFor()
const phoneTerrace = await phone.locator("body").innerText()
if (/\bXeno\b/.test(phoneTerrace) || /\bZeno\b/i.test(phoneTerrace)) {
  errors.push("mobile terrace still shows Xeno or Zeno")
}
if (phoneTerrace.includes("escape-machine")) { // v18.2: dev canon notes are no longer player-visible
  errors.push("mobile terrace escape note was not named XOE")
}
await phone.screenshot({ path: `${outDir}/xeno_xo_story_terrace_mobile.png`, fullPage: true })
await phone.screenshot({ path: `${outDir}/xeno_xoe_terrace_mobile.png`, fullPage: true })
const phoneXoe = await mobile.newPage()
phoneXoe.on("pageerror", (error) => errors.push(String(error)))
await phoneXoe.goto(baseUrl, { waitUntil: "domcontentloaded" })
await enterLocalLaunch(phoneXoe)
await confirmStart(phoneXoe, { character: "XOE", gender: "Female", className: "Sentinel" })
await phoneXoe.getByRole("heading", { name: "You wake in the battle" }).waitFor()
try {
  await phoneXoe.waitForFunction(() => document.querySelector("canvas.stage")?.dataset.xoePresentation === "combat", null, { timeout: 3000 })
} catch {
  errors.push("mobile wake is not using the combat still")
}
await phoneXoe.getByText("You wake in a battle already involving XOE. Drones are closing in to kill you. Danger is sensed.").waitFor()
const phoneWake = await phoneXoe.locator("body").innerText()
if (/\bXeno\b/.test(phoneWake) || /\bZeno\b/i.test(phoneWake)) {
  errors.push("mobile wake still shows Xeno or Zeno")
}
await saveXoeStage(phoneXoe, "wake_mobile")
await phoneXoe.screenshot({ path: `${outDir}/xeno_xo_story_wake_mobile.png`, fullPage: true })
await phoneXoe.screenshot({ path: `${outDir}/xeno_xoe_weapons_ingame_mobile.png`, fullPage: true })
await phoneXoe.close()
await mobile.close()
await browser.close()

if (blocked.length > 0 || errors.length > 0) {
  console.error(JSON.stringify({ blocked, errors }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  url: baseUrl,
  desktop: "XOE disclaimer gate, paper result 40, fixed route to sealed hatch",
  mobile: "optional name and character, short position, touch route",
  blockedExternalRequests: 0,
  pageErrors: 0,
}, null, 2))
