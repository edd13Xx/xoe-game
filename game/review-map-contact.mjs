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
  await setupPilot(s)
  await walkStory(s)
  await practiceDesk(s)
  if (!(await toMap(s))) throw new Error("did not reach map")
  await closeChapterCard(s)
  await wait(s, 300)
}

async function capture(device) {
  const s = await openGame({ device })
  const dir = path.join(OUT, `map-v19b-envs-${device}`)
  fs.mkdirSync(dir, { recursive: true })
  try {
    await reachMap(s)
    await s.page.evaluate(() => {
      window.scrollTo(0, 0)
      document.querySelectorAll(".minimap-hud,.map-econ,.map-trade,.enter-prompt,.map-fight-btn,.map-founder").forEach((el) => {
        el.style.visibility = "hidden"
      })
    })
    const box = await s.page.locator(".mars-world-shell").boundingBox()
    if (!box) throw new Error("no shell")
    for (const [id, x, y] of ENVS) {
      await s.page.evaluate(({ x, y, w, h }) => {
        const world = document.querySelector(".mars-world")
        if (!world) return
        world.style.transform = `translate(${w / 2 - x}px, ${h / 2 - y}px)`
      }, { x, y, w: box.width, h: box.height })
      await wait(s, 80)
      await s.page.locator(".mars-world-shell").screenshot({ path: path.join(dir, `${id}.png`) })
    }
    return { device, dir, ok: true }
  } catch (e) {
    return { device, ok: false, error: String(e) }
  } finally {
    await closeGame(s)
  }
}

const results = []
for (const device of ["desktop", "portrait"]) {
  const r = await capture(device)
  results.push(r)
  console.log(device, r.ok ? "ok" : r.error)
}
fs.writeFileSync(path.join(OUT, "map-v19b-contact.json"), JSON.stringify(results, null, 2))
if (results.some((r) => !r.ok)) process.exitCode = 1
