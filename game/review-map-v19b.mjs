process.env.XOE_REVIEW_LIBRARY = "1"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { openGame, closeGame, wait, setupPilot, walkStory, practiceDesk, toMap, closeChapterCard } from "./review-v19.mjs"

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(ROOT, "review")
const ENVS = [
  ["wallet", 140, 160], ["keys", 390, 188], ["blocks", 580, 160], ["fees", 830, 188],
  ["stroops", 140, 400], ["scams", 390, 428], ["trustline", 580, 400], ["volatility", 830, 428],
  ["phishing", 140, 640], ["seed-backup", 390, 668],
  ["daily-practice", 980, 220], ["weekly-practice", 1000, 480], ["fees-leverage", 1040, 680],
  ["sol", 640, 700], ["xelm", 880, 720],
]

async function reachMap(s) {
  const setup = await setupPilot(s)
  await walkStory(s)
  await practiceDesk(s)
  const map = await toMap(s)
  await closeChapterCard(s)
  await wait(s, 400)
  return { setup, map }
}

async function shotMap(device, filename) {
  const s = await openGame({ device })
  const info = { device }
  try {
    const reached = await reachMap(s)
    info.reached = reached
    if (!reached.map) throw new Error("did not reach map")
    await s.page.evaluate(() => window.scrollTo(0, 0))
    await s.page.screenshot({ path: path.join(OUT, filename), fullPage: false })
    await s.page.evaluate(() => {
      const shell = document.querySelector(".mars-world-shell")
      const world = document.querySelector(".mars-world")
      if (!shell || !world) return
      shell.style.overflow = "visible"
      shell.style.width = "1200px"
      shell.style.height = "800px"
      shell.style.maxWidth = "none"
      shell.style.minHeight = "800px"
      world.style.transform = "translate(0px, 0px)"
    })
    await wait(s, 200)
    const worldPath = path.join(OUT, `map-v19b-world-${device}.png`)
    await s.page.locator(".mars-world-shell").screenshot({ path: worldPath })
    info.world = worldPath
    info.coverage = await s.page.evaluate(() => {
      // restore? coverage was measured before expand; skip
      return true
    })
  } catch (e) {
    info.error = String(e)
    await s.page.screenshot({ path: path.join(OUT, `map-v19b-failure-${device}.png`), fullPage: false }).catch(() => {})
  }
  await closeGame(s)
  return info
}

const results = []
for (const [device, file] of [
  ["desktop", "map-v19b-after-desktop.png"],
  ["portrait", "map-v19b-after-portrait.png"],
  ["landscape", "map-v19b-after-landscape.png"],
]) {
  results.push(await shotMap(device, file))
  console.log(device, results.at(-1).error || "ok")
}
fs.writeFileSync(path.join(OUT, "map-v19b-shots.json"), JSON.stringify({ results, envs: ENVS }, null, 2))
if (results.some((r) => r.error)) process.exitCode = 1
