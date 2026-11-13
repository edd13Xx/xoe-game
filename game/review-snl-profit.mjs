process.env.XOE_REVIEW_LIBRARY = "1"
const fs = await import("node:fs")
const path = await import("node:path")
const { fileURLToPath } = await import("node:url")
const { openGame, closeGame, wait, setupPilot, walkStory, toMap, closeChapterCard, pressName, press, phaseOf, openPause } = await import("./review-v19.mjs")

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(ROOT, "review")

async function resumePractice(s) {
  if ((await phaseOf(s)) === "practice-pause") {
    await pressName(s, "Resume practice")
    await wait(s, 400)
  }
}

async function readSnl(s) {
  return s.page.locator("[data-snl='1']").first().evaluate((el) => ({
    side: el.getAttribute("data-side"),
    upnl: Number(el.getAttribute("data-upnl") || 0),
    mark: Number(el.getAttribute("data-mark") || 0),
    entry: el.getAttribute("data-entry"),
  }))
}

async function waitForMarkHigh(s) {
  let best = 0
  const start = Date.now()
  while (Date.now() - start < 6000) {
    const cur = await readSnl(s)
    if (cur.mark > best) best = cur.mark
    if (cur.mark >= best - 0.005 && Date.now() - start > 1500) return cur
    await wait(s, 400)
  }
  return readSnl(s)
}

async function waitProfit(s, min = 0.01, ms = 40000) {
  const start = Date.now()
  let info = null
  while (Date.now() - start < ms) {
    info = await readSnl(s)
    if (info.side === "short" && info.upnl >= min) return info
    await wait(s, 400)
  }
  return { ...info, timeout: true }
}

async function openSizedShort(s, lots = 8) {
  await s.page.locator("[data-snl='1']").first().evaluate((el) => el.scrollIntoView({ block: "start" }))
  const more = s.page.getByRole("button", { name: "More lots" }).first()
  const shortBtn = s.page.locator(".snl-quick-actions").getByRole("button", { name: /^Short$/ }).first()
  const coverBtn = s.page.locator(".snl-quick-actions").getByRole("button", { name: /^Cover$/ }).first()
  await waitForMarkHigh(s)
  for (let i = 1; i < lots; i++) await press(s, more)
  let clicked = await press(s, shortBtn)
  let info = await waitProfit(s)
  if (info.side === "short" && info.upnl >= 0.01) return { clicked, ...info }
  if (info.side === "short") {
    await press(s, coverBtn)
    await wait(s, 200)
  }
  await waitForMarkHigh(s)
  for (let i = 1; i < lots; i++) await press(s, more)
  clicked = await press(s, shortBtn)
  info = await waitProfit(s)
  return { clicked, ...info }
}

async function shotTerminal(s, file) {
  await s.page.evaluate(() => {
    document.querySelectorAll(".trade-action-bar, .action-bar").forEach((el) => {
      el.style.display = "none"
    })
  })
  await s.page.locator("[data-snl='1']").first().evaluate((el) => el.scrollIntoView({ block: "start" }))
  await wait(s, 200)
  const term = s.page.locator("[data-snl='1']").first()
  await term.screenshot({ path: path.join(OUT, file) })
}

const results = []
for (const device of ["portrait", "desktop"]) {
  const s = await openGame({ device })
  const info = { device, screen: "practice" }
  try {
    await setupPilot(s)
    await walkStory(s)
    await resumePractice(s)
    info.snl = await openSizedShort(s)
    if (info.snl.side !== "short" || !(info.snl.upnl >= 0.01)) throw new Error(`not in visible profit: ${JSON.stringify(info.snl)}`)
    await shotTerminal(s, `trade-desk-chart-short-profit-${device}.png`)
  } catch (e) {
    info.error = String(e)
    await s.page.screenshot({ path: path.join(OUT, `trade-desk-chart-short-profit-${device}-failure.png`), fullPage: false }).catch(() => {})
  }
  await closeGame(s)
  results.push(info)
  console.log("practice", device, info.error || `short upnl=${info.snl?.upnl}`)
}

for (const device of ["portrait", "desktop"]) {
  const s = await openGame({ device })
  const info = { device, screen: "paper-desk" }
  try {
    await setupPilot(s)
    await walkStory(s)
    await resumePractice(s)
    if (!(await pressName(s, "Done trading"))) await pressName(s, "Exit practice")
    await wait(s, 400)
    info.map = await toMap(s)
    await closeChapterCard(s)
    if (!(await openPause(s))) throw new Error("pause menu did not open")
    if (!(await pressName(s, "XOE trade desk"))) throw new Error("trade desk missing")
    await wait(s, 400)
    info.snl = await openSizedShort(s)
    if (info.snl.side !== "short" || !(info.snl.upnl >= 0.01)) throw new Error(`desk not in visible profit: ${JSON.stringify(info.snl)}`)
    await shotTerminal(s, `trade-desk-drawer-chart-short-profit-${device}.png`)
  } catch (e) {
    info.error = String(e)
    await s.page.screenshot({ path: path.join(OUT, `trade-desk-drawer-chart-short-profit-${device}-failure.png`), fullPage: false }).catch(() => {})
  }
  await closeGame(s)
  results.push(info)
  console.log("desk", device, info.error || `short upnl=${info.snl?.upnl}`)
}

fs.writeFileSync(path.join(OUT, "snl-profit-shots.json"), JSON.stringify({ results }, null, 2))
if (results.some((r) => r.error)) process.exitCode = 1
