process.env.XOE_REVIEW_LIBRARY = "1"
const fs = await import("node:fs")
const path = await import("node:path")
const { fileURLToPath } = await import("node:url")
const { openGame, closeGame, wait, setupPilot, walkStory, toMap, closeChapterCard, pressName, press, phaseOf, openPause } = await import("./review-v19.mjs")

// A short's sim P/L must move the right way: positive when XOE is below entry, negative above it.
// (The sim price is a random walk, so a profit within the wait is not guaranteed.)
function shortPnlOk(p) {
  if (!p || p.side !== "short" || !Number.isFinite(p.upnl)) return false
  if (p.upnl > 0) return true
  const edge = Number(p.entry) - Number(p.mark)
  return Math.abs(p.upnl) < 1e-9 ? Math.abs(edge) < 0.01 : Math.sign(p.upnl) === Math.sign(edge)
}

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(ROOT, "review")

async function resumePractice(s) {
  if ((await phaseOf(s)) === "practice-pause") {
    await pressName(s, "Resume practice")
    await wait(s, 400)
  }
}

async function waitForShortProfit(s, ms = 24000) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    const info = await s.page.locator("[data-snl='1']").first().evaluate((el) => ({
      side: el.getAttribute("data-side"),
      upnl: Number(el.getAttribute("data-upnl") || 0),
      mark: el.getAttribute("data-mark"),
      entry: el.getAttribute("data-entry"),
    }))
    if (info.side === "short" && info.upnl > 0) return info
    await wait(s, 400)
  }
  return s.page.locator("[data-snl='1']").first().evaluate((el) => ({
    side: el.getAttribute("data-side"),
    upnl: Number(el.getAttribute("data-upnl") || 0),
    mark: el.getAttribute("data-mark"),
    entry: el.getAttribute("data-entry"),
    timeout: true,
  }))
}

// v19 is map-first and the trade desk is the pro desk (Buy/Sell + Market). Open a sim short there;
// fall back to the old SNL "Short" button when it is on screen. Paper only, testnet XOE, no real money.
async function openShort(s) {
  const page = s.page
  const oldShort = page.getByRole("button", { name: /^Short$/ }).first()
  if (!(await oldShort.isVisible().catch(() => false)) && !(await page.locator("[data-testid=pro-desk]").isVisible().catch(() => false))) {
    if (!(await pressName(s, "XOE trade desk"))) {
      await openPause(s)
      await pressName(s, "XOE trade desk")
    }
    await wait(s, 1500)
  }
  let clicked = false
  if (await page.locator("[data-testid=pro-desk]").isVisible().catch(() => false)) {
    await page.locator(".pd-order").getByRole("tab", { name: "Sell", exact: true }).click()
    await page.locator(".pd-order").getByRole("button", { name: "Market", exact: true }).click()
    await page.getByLabel("Amount in XOE").fill("0.5")
    const go = page.locator("[data-testid=pd-submit]")
    await go.scrollIntoViewIfNeeded()
    clicked = await press(s, go)
  } else {
    await oldShort.scrollIntoViewIfNeeded()
    clicked = await press(s, oldShort)
  }
  await wait(s, 300)
  const profit = await waitForShortProfit(s)
  const side = profit.side
  const targets = await s.page.evaluate(() =>
    [...document.querySelectorAll(".snl-actions .touch-btn, .play-topbar-actions .touch-btn, .play-topbar-actions .pause-btn")].map((el) => {
      const r = el.getBoundingClientRect()
      return { label: el.textContent?.trim().slice(0, 24), w: r.width, h: r.height }
    }),
  )
  const title = await s.page.evaluate(() => {
    const h1 = document.querySelector(".play-topbar-id h1")
    if (!h1) return null
    const full = h1.querySelector(".play-title-full")
    const shortEl = h1.querySelector(".play-title-short")
    const cs = (el) => (el ? getComputedStyle(el).display : "missing")
    const r = h1.getBoundingClientRect()
    const actions = document.querySelector(".play-topbar-actions")?.getBoundingClientRect()
    const overlap = actions ? Math.min(r.right, actions.right) - Math.max(r.left, actions.left) > 0 && Math.min(r.bottom, actions.bottom) - Math.max(r.top, actions.top) > 1 : false
    return {
      visible: h1.innerText.trim(),
      accessible: h1.getAttribute("aria-label"),
      fullDisplay: cs(full),
      shortDisplay: cs(shortEl),
      h1Height: r.height,
      overlapActions: overlap,
    }
  })
  const chart = await s.page.locator("[data-snl-chart='1']").count()
  return { clicked, side, profit, chart, targets, title, undersized: targets.filter((t) => t.w < 48 || t.h < 48) }
}

async function shotPractice(device, file) {
  const s = await openGame({ device })
  const info = { device, screen: "practice" }
  try {
    info.setup = await setupPilot(s)
    info.story = await walkStory(s)
    await resumePractice(s)
    info.snl = await openShort(s)
    await s.page.locator("[data-snl='1']").first().evaluate((el) => el.scrollIntoView({ block: "start" }))
    await s.page.screenshot({ path: path.join(OUT, file), fullPage: false })
    if (info.snl.side !== "short") throw new Error(`expected short, got ${info.snl.side}`)
    if (!shortPnlOk(info.snl.profit)) throw new Error(`short P/L wrong way: ${JSON.stringify(info.snl.profit)}`)
    if (!info.snl.chart) throw new Error("missing candlestick chart")
    if (info.snl.undersized.length) throw new Error(`undersized: ${JSON.stringify(info.snl.undersized)}`)
  } catch (e) {
    info.error = String(e)
    await s.page.screenshot({ path: path.join(OUT, file.replace(".png", "-failure.png")), fullPage: false }).catch(() => {})
  }
  await closeGame(s)
  return info
}

async function shotMapAndDesk(device, mapFile, deskFile) {
  const s = await openGame({ device })
  const info = { device, screen: "map-desk" }
  try {
    await setupPilot(s)
    await walkStory(s)
    await resumePractice(s)
    // leave practice without trading so we can still reach the map
    if (!(await pressName(s, "Done trading"))) await pressName(s, "Exit practice")
    await wait(s, 400)
    info.map = await toMap(s)
    await closeChapterCard(s)
    await wait(s, 300)
    await s.page.evaluate(() => window.scrollTo(0, 0))
    await s.page.screenshot({ path: path.join(OUT, mapFile), fullPage: false })
    info.title = await s.page.evaluate(() => {
      const h1 = document.querySelector(".play-topbar-id h1")
      return h1 ? { visible: h1.innerText.trim(), accessible: h1.getAttribute("aria-label"), height: h1.getBoundingClientRect().height } : null
    })
    if (!(await openPause(s))) throw new Error("pause menu did not open")
    if (!(await pressName(s, "XOE trade desk"))) throw new Error("trade desk button missing")
    await wait(s, 400)
    info.snl = await openShort(s)
    await s.page.locator("[data-snl='1']").first().evaluate((el) => el.scrollIntoView({ block: "start" }))
    await s.page.screenshot({ path: path.join(OUT, deskFile), fullPage: false })
    if (info.snl.side !== "short") throw new Error(`desk expected short, got ${info.snl.side}`)
    if (!shortPnlOk(info.snl.profit)) throw new Error(`desk short P/L wrong way: ${JSON.stringify(info.snl.profit)}`)
    if (!info.snl.chart) throw new Error("desk missing candlestick chart")
    if (device === "portrait" && info.title?.visible !== "XOE") throw new Error(`portrait title was ${info.title?.visible}`)
    if (device !== "portrait" && info.title?.visible && info.title.visible !== "XOE: Unknown Orbital Engine" && device === "desktop") {
      // desktop should show the full name
      if (info.title.visible !== "XOE: Unknown Orbital Engine") throw new Error(`desktop title was ${info.title.visible}`)
    }
  } catch (e) {
    info.error = String(e)
    await s.page.screenshot({ path: path.join(OUT, mapFile.replace(".png", "-failure.png")), fullPage: false }).catch(() => {})
  }
  await closeGame(s)
  return info
}

const results = []
for (const [device, file] of [
  ["portrait", "trade-desk-chart-short-profit-portrait.png"],
  ["desktop", "trade-desk-chart-short-profit-desktop.png"],
]) {
  const r = await shotPractice(device, file)
  results.push(r)
  console.log("practice", device, r.error || `short=${r.snl?.side}`)
}

for (const [device, mapFile, deskFile] of [
  ["portrait", "map-v19b-after-portrait.png", "trade-desk-snl-short-portrait.png"],
  ["desktop", "map-v19b-after-desktop.png", "trade-desk-snl-short-desktop.png"],
  ["landscape", "map-v19b-after-landscape.png", "trade-desk-snl-short-landscape.png"],
]) {
  const r = await shotMapAndDesk(device, mapFile, deskFile)
  results.push(r)
  console.log("map-desk", device, r.error || `title=${r.title?.visible} short=${r.snl?.side}`)
}

fs.writeFileSync(path.join(OUT, "snl-desk-shots.json"), JSON.stringify({ results }, null, 2))
if (results.some((r) => r.error)) process.exitCode = 1
