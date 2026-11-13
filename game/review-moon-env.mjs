#!/usr/bin/env node
/** Local-only check of the distinct Sol / Xelm moon environments (visual only; no gameplay, reward, cap or economy change). */
import fs from "node:fs"
import assert from "node:assert/strict"
process.env.XOE_REVIEW_LIBRARY = "1"
const { openGame, closeGame, wait, press, pressName, phaseOf, bodyText, setupPilot, walkStory, practiceDesk, toMap, closeChapterCard, dismissReminder } = await import("./review-v19.mjs")

async function bootToMap(s) {
  assert.equal((await setupPilot(s)).ok, true)
  await walkStory(s)
  await practiceDesk(s)
  assert.equal(await toMap(s), true)
  await closeChapterCard(s)
  await dismissReminder(s)
  assert.equal(await phaseOf(s), "colony-map")
}

const sceneInfo = (page) =>
  page.evaluate(() => {
    const fig = document.querySelector(".moon-path")
    const svg = fig?.querySelector("svg[data-moon-scene]")
    const r = fig?.getBoundingClientRect()
    const tag = fig?.querySelector(".moon-place-tag")
    const gate = fig?.querySelector(".moon-path-gate")
    const anims = svg ? [...svg.querySelectorAll("*")].filter((el) => getComputedStyle(el).animationName !== "none").length : -1
    const sky = svg?.querySelector("linearGradient stop")?.getAttribute("stop-color")
    const tr = tag?.getBoundingClientRect()
    const gr = gate?.getBoundingClientRect()
    return {
      moon: svg?.getAttribute("data-moon-scene"),
      terrain: svg?.getAttribute("data-terrain"),
      phenomenon: svg?.getAttribute("data-phenomenon"),
      role: fig?.getAttribute("role"),
      label: fig?.getAttribute("aria-label"),
      tag: tag?.textContent,
      gate: gate?.textContent,
      sky,
      w: r?.width, h: r?.height, inView: r ? r.top >= 0 && r.bottom <= innerHeight : false,
      tagGateOverlap: tr && gr ? !(tr.right <= gr.left || gr.right <= tr.left || tr.bottom <= gr.top || gr.bottom <= tr.top) : true,
      tagClipped: tag ? tag.scrollWidth > tag.clientWidth + 1 && getComputedStyle(tag).textOverflow !== "ellipsis" : true,
      lightsOn: svg?.querySelectorAll(".ms-light.is-on").length ?? 0,
      lights: svg?.querySelectorAll("[data-ms=light]").length ?? 0,
      features: svg ? [...svg.querySelectorAll("[data-ms]")].map((g) => g.getAttribute("data-ms")) : [],
      particles: svg?.querySelectorAll(".ms-p").length ?? 0,
      anims,
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      previews: [...document.querySelectorAll("[data-moon-preview]")].length,
    }
  })

const out = {}
let failed = false
for (const device of ["portrait", "landscape", "desktop"]) {
  const rec = { device }
  out[device] = rec
  for (const moonName of ["Xelm", "Sol"]) {
    const s = await openGame({ device, query: "?qa=1" })
    const m = (rec[moonName] = {})
    try {
      await bootToMap(s)
      assert.equal(await pressName(s, "Choose moon path"), true)
      await wait(s, 200)
      m.choicePreviews = await s.page.locator("[data-moon-preview] svg[data-moon-scene]").count()
      if (moonName === "Xelm") await s.page.locator("[data-moon-preview]").first().screenshot({ path: `review/run-moon-env-${device}-choice.png` })
      m.choiceNameOk = (await s.page.getByRole("button", { name: new RegExp(`^${moonName}`) }).count()) === 1
      assert.equal(await press(s, s.page.getByRole("button", { name: new RegExp(`^${moonName}`) })), true)
      assert.equal(await pressName(s, `Lock moon path · ${moonName}`), true)
      await wait(s, 300)
      assert.equal(await phaseOf(s), "moon-approach")
      await s.page.evaluate(() => window.scrollTo(0, 0))
      m.before = await sceneInfo(s.page)
      if (moonName === "Xelm") await s.page.screenshot({ path: `review/run-moon-env-${device}.png` })
      await s.page.screenshot({ path: `review/run-moon-env-${device}-${moonName.toLowerCase()}.png` })
      const use = s.page.getByRole("button", { name: /^Use / })
      if (await use.count()) {
        await press(s, use)
        await wait(s, 300)
      }
      m.after = await sceneInfo(s.page)
      if (moonName === "Sol") await s.page.screenshot({ path: `review/run-moon-env-${device}-sol-powered.png` })
      await s.page.emulateMedia({ reducedMotion: "reduce" })
      await wait(s, 80)
      m.reducedAnims = (await sceneInfo(s.page)).anims
      await s.page.emulateMedia({ reducedMotion: "no-preference" })
      const body = await bodyText(s)
      m.xrp = /\bXRP\b/i.test(body)
      m.errors = s.errors
    } catch (e) {
      m.error = String(e)
    } finally {
      await closeGame(s)
    }
  }
  const x = rec.Xelm, so = rec.Sol
  const checks = {
    noError: !x.error && !so.error,
    distinct: x.before?.terrain === "frost-spires" && so.before?.terrain === "ember-ridges" && x.before?.phenomenon === "aurora" && so.before?.phenomenon === "corona" && x.before?.sky !== so.before?.sky,
    features: x.before?.features.includes("spires") && x.before?.features.includes("aurora") && so.before?.features.includes("ridges") && so.before?.features.includes("corona") && [x, so].every((m) => ["lane", "gate", "xo", "particles"].every((f) => m.before?.features.includes(f))),
    labeled: [x, so].every((m) => m.before?.role === "img" && /gate waits/i.test(m.before?.label || "") && /gate is open/i.test(m.after?.label || "")),
    tags: /Xelm · Frost Key Spires/.test(x.before?.tag || "") && /Sol · Ember Ridge/.test(so.before?.tag || "") && [x, so].every((m) => !m.before?.tagGateOverlap && !m.before?.tagClipped),
    poweredLights: [x, so].every((m) => m.before?.lightsOn === 0 && m.after?.lightsOn === m.after?.lights && m.after?.lights > 0 && m.after?.gate === "Gate open"),
    animated: [x, so].every((m) => m.before?.anims > 5 && m.before?.particles > 0),
    reducedMotion: [x, so].every((m) => m.reducedAnims === 0),
    previews: x.choicePreviews === 2 && x.choiceNameOk && so.choiceNameOk,
    size: [x, so].every((m) => m.before?.h >= 100 && m.before?.w >= 300 && m.before?.inView),
    noOverflow: [x, so].every((m) => !m.before?.overflowX && !m.after?.overflowX),
    noXrp: [x, so].every((m) => m.xrp === false),
    noPageErrors: [x, so].every((m) => (m.errors || []).length === 0),
  }
  rec.checks = checks
  const bad = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k)
  rec.ok = bad.length === 0
  if (!rec.ok) { failed = true; rec.failed = bad }
  console.log(device, rec.ok ? "OK" : `FAIL ${bad.join(",")}`)
}
fs.writeFileSync("review/moon-env.json", JSON.stringify(out, null, 2))
if (failed) { console.log(JSON.stringify(out, null, 2)); process.exit(1) }
console.log("review-moon-env: all devices pass")
