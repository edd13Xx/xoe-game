#!/usr/bin/env node
/** Local-only check that each colony flight field has its own biome (sky, terrain, floor, ambient particles) and map motes. Visual only. */
import fs from "node:fs"
process.env.XOE_REVIEW_LIBRARY = "1"
const { openGame, closeGame, setupPilot, closeChapterCard, press, pressName, pressGate, phaseOf, wait } = await import("./review-v19.mjs")
const out = {}
let failed = false
const enter = async (s, id) => {
  await pressName(s, "Full Map")
  await wait(s, 300)
  await press(s, s.page.locator(`[data-dome=${id}]`))
  await wait(s, 6000)
  await press(s, s.page.locator(s.phone ? ".enter-chip" : ".enter-prompt button").first())
  await wait(s, 700)
}
const inspect = (page) => page.evaluate(() => {
  const field = document.querySelector(".arcade-field")
  const biome = field?.querySelector(".colony-biome")
  if (!field || !biome) return { missing: true }
  const fr = field.getBoundingClientRect()
  const gates = [...field.querySelectorAll(".arcade-gate-node")].map((g) => {
    const r = g.getBoundingClientRect()
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return { text: g.textContent.trim(), onTop: !!hit && (hit === g || g.contains(hit)) }
  })
  const parts = [...biome.querySelectorAll(".biome-p")]
  return {
    biome: biome.getAttribute("data-biome"),
    label: field.getAttribute("aria-label"),
    name: biome.querySelector(".colony-biome-name")?.textContent,
    hidden: biome.getAttribute("aria-hidden"),
    particles: parts.length,
    anim: parts[0] ? getComputedStyle(parts[0]).animationName : null,
    sky: biome.querySelector("linearGradient stop")?.getAttribute("stop-color"),
    gates,
    fieldW: Math.round(fr.width), fieldH: Math.round(fr.height),
    overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    pointerEvents: getComputedStyle(biome).pointerEvents,
  }
})
for (const device of ["portrait", "landscape", "desktop"]) {
  const s = await openGame({ device })
  const rec = { device }
  try {
    await setupPilot(s)
    await closeChapterCard(s)
    if ((await phaseOf(s)) !== "colony-map") throw new Error(`not on map: ${await phaseOf(s)}`)
    rec.mapMotes = await s.page.locator(".env-mote").count()
    await enter(s, "wallet")
    rec.phase = await phaseOf(s)
    rec.wallet = await inspect(s.page)
    await s.page.addScriptTag({ content: fs.readFileSync("node_modules/axe-core/axe.min.js", "utf8") })
    rec.axeField = await s.page.evaluate(async () => {
      const a = await window.axe.run({ include: [[".arcade-field"]] }, { resultTypes: ["violations"] })
      return a.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }))
    })
    await s.page.locator(".arcade-field").evaluate((el) => el.scrollIntoView({ block: "center" }))
    await wait(s, 400)
    const tag = device === "portrait" ? "phone" : device
    await s.page.screenshot({ path: `review/run-biome-${tag}-wallet.png` })
    await s.page.emulateMedia({ reducedMotion: "reduce" })
    await wait(s, 80)
    rec.reducedAnim = await s.page.locator(".biome-p").first().evaluate((el) => getComputedStyle(el).animationName)
    await s.page.emulateMedia({ reducedMotion: "no-preference" })
    rec.noXrp = !/xrp/i.test(await s.page.locator("body").innerText())
    if (device !== "landscape") {
      await pressGate(s, "Keys / access")
      await wait(s, 2400)
      await pressName(s, "Back to colony map")
      await wait(s, 400)
      await closeChapterCard(s)
      await enter(s, "keys")
      rec.keys = await inspect(s.page)
      await s.page.locator(".arcade-field").evaluate((el) => el.scrollIntoView({ block: "center" }))
      await wait(s, 400)
      await s.page.screenshot({ path: `review/run-biome-${tag}-keys.png` })
    }
    const ok = (r, id) => r && !r.missing && r.biome === id && r.particles === 12 && r.hidden === "true" && r.pointerEvents === "none" &&
      r.anim && r.anim !== "none" && r.gates.length >= 3 && r.gates.every((g) => g.onTop) && !r.overflowX && r.label.includes(r.name)
    const bad = rec.axeField?.length !== 0 || rec.phase !== "colony-lesson" || rec.mapMotes < 10 || !ok(rec.wallet, "wallet") || rec.reducedAnim !== "none" || !rec.noXrp ||
      (device !== "landscape" && (!ok(rec.keys, "keys") || rec.keys.sky === rec.wallet.sky || rec.keys.name === rec.wallet.name))
    if (bad) failed = true
  } catch (e) {
    rec.failure = String(e)
    failed = true
    await s.page.screenshot({ path: `review/run-biome-${device}-failure.png` }).catch(() => {})
  }
  rec.errors = s.errors
  if (s.errors?.length) failed = true
  await closeGame(s)
  out[device] = rec
  console.log(JSON.stringify(rec))
}
fs.writeFileSync("review/biome.json", JSON.stringify(out, null, 2))
if (failed) { console.error("review-biome: FAIL"); process.exit(1) }
console.log("review-biome: PASS")
