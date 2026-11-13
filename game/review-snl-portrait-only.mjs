process.env.XOE_REVIEW_LIBRARY = "1"
const { openGame, closeGame, wait, setupPilot, walkStory, pressName, press, phaseOf } = await import("./review-v19.mjs")
const path = await import("node:path")
const { fileURLToPath } = await import("node:url")
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

const s = await openGame({ device: "portrait" })
try {
  await setupPilot(s)
  await walkStory(s)
  await resumePractice(s)
  await s.page.locator("[data-snl='1']").first().evaluate((el) => el.scrollIntoView({ block: "start" }))
  const shortBtn = s.page.locator(".snl-quick-actions").getByRole("button", { name: /^Short$/ }).first()
  const coverBtn = s.page.locator(".snl-quick-actions").getByRole("button", { name: /^Cover$/ }).first()
  let info = null
  for (let attempt = 0; attempt < 3; attempt++) {
    const cur = await readSnl(s)
    if (cur.side === "short") await press(s, coverBtn)
    await wait(s, 800)
    await press(s, shortBtn)
    const start = Date.now()
    while (Date.now() - start < 20000) {
      info = await readSnl(s)
      if (info.side === "short" && info.upnl >= 0.01) break
      await wait(s, 400)
    }
    if (info?.side === "short" && info.upnl >= 0.01) break
  }
  if (!(info?.side === "short" && info.upnl >= 0.01)) throw new Error(`no profit ${JSON.stringify(info)}`)
  await s.page.evaluate(() => document.querySelectorAll(".trade-action-bar, .action-bar").forEach((el) => { el.style.display = "none" }))
  await s.page.locator("[data-snl='1']").first().evaluate((el) => el.scrollIntoView({ block: "start" }))
  await wait(s, 200)
  await s.page.locator("[data-snl='1']").first().screenshot({ path: path.join(OUT, "trade-desk-chart-short-profit-portrait.png") })
  console.log("ok", info)
} catch (e) {
  console.error(String(e))
  await s.page.screenshot({ path: path.join(OUT, "trade-desk-chart-short-profit-portrait-failure.png"), fullPage: false }).catch(() => {})
  process.exitCode = 1
}
await closeGame(s)
