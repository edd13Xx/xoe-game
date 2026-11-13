#!/usr/bin/env node
/** Local-only check of the TP/SL bracket on the XOE trade desk (sim, testnet XOE, no real money). */
import fs from "node:fs"
process.env.XOE_REVIEW_LIBRARY = "1"
const { openGame, closeGame, pressName, wait } = await import("./review-v19.mjs")
const out = {}
let failed = false
for (const device of ["portrait", "landscape", "desktop"]) {
  const s = await openGame({ device })
  const rec = { device }
  try {
    if (!(await pressName(s, "XOE trade desk"))) throw new Error("cannot open trade desk")
    await wait(s, 3000)
    const page = s.page
    const desk = page.locator("[data-testid=pro-desk]")
    await desk.waitFor({ state: "visible", timeout: 5000 })
    const mark = Number(await desk.getAttribute("data-mark"))
    await page.getByRole("tab", { name: "Buy", exact: true }).click()
    await page.getByLabel("Amount in XOE").fill("0.5")
    await page.getByLabel("Add take profit and stop loss").check()
    // Wrong-side guard first
    await page.getByLabel("Take profit price").fill((mark * 0.9).toFixed(3))
    await page.locator("[data-testid=pd-submit]").click()
    await wait(s, 200)
    rec.guard = await page.locator(".pd-msg").innerText().catch(() => "")
    rec.sideAfterGuard = await desk.getAttribute("data-side")
    const tp = (mark * 1.06).toFixed(3)
    const sl = (mark * 0.94).toFixed(3)
    await page.getByLabel("Take profit price").fill(tp)
    await page.getByLabel("Stop loss price").fill(sl)
    if (device === "portrait") {
      await page.locator(".pd-order").evaluate((el) => el.scrollIntoView({ block: "start" }))
      await wait(s, 200)
      await page.screenshot({ path: "review/run-tpsl-portrait-form.png" })
    }
    await page.locator("[data-testid=pd-submit]").click()
    await wait(s, 400)
    rec.msg = await page.locator(".pd-msg").innerText().catch(() => "")
    rec.side = await desk.getAttribute("data-side")
    rec.marks = await page.locator("[data-snl-chart] [data-mark]").evaluateAll((els) => els.map((e) => e.getAttribute("data-mark")))
    await page.getByRole("tab", { name: /^Open orders/ }).click()
    await wait(s, 150)
    rec.openOrders = (await page.locator(".pd-rows").innerText()).replace(/\n/g, " | ")
    await page.getByRole("tab", { name: "Positions", exact: true }).click()
    await wait(s, 150)
    rec.posBracket = (await page.locator("[data-testid=pd-pos-bracket]").innerText()).replace(/\n/g, " ")
    const gauge = page.locator("[data-testid=pd-gauge]")
    rec.gaugeVisible = await gauge.isVisible().catch(() => false)
    rec.gaugeZone = await gauge.getAttribute("data-zone").catch(() => null)
    rec.gaugeNow = Number(await gauge.getAttribute("aria-valuenow").catch(() => "-1"))
    rec.gaugeText = await gauge.getAttribute("aria-valuetext").catch(() => "")
    if (device === "portrait" && rec.gaugeVisible) {
      await gauge.evaluate((el) => el.scrollIntoView({ block: "center" }))
      await wait(s, 300)
      await page.screenshot({ path: "review/run-gauge-portrait.png" })
    }
    if (device === "portrait") {
      const chartTab = page.getByRole("tab", { name: "Chart", exact: true })
      if (await chartTab.isVisible().catch(() => false)) await chartTab.click()
      await page.locator(".drawer-sheet").evaluate((el) => el.scrollTo(0, 0))
      await wait(s, 300)
      await page.screenshot({ path: "review/run-tpsl-portrait-chart.png" })
    } else {
      await page.locator(".drawer-sheet").evaluate((el) => el.scrollTo(0, 0))
      await wait(s, 300)
      await page.screenshot({ path: `review/run-tpsl-${device}.png` })
    }
    rec.overflowX = await page.evaluate(() => {
      const sheet = document.querySelector(".drawer-sheet")
      return sheet ? sheet.scrollWidth > sheet.clientWidth + 1 : true
    })
    const text = await page.locator(".drawer-sheet").innerText()
    rec.noXrp = !/xrp/i.test(text)
    const bad =
      !/above/.test(rec.guard) || rec.sideAfterGuard !== "flat" || rec.side !== "long" || !/TP .* SL/.test(rec.msg) ||
      !rec.marks.includes("tp") || !rec.marks.includes("sl") || !rec.marks.includes("entry") ||
      !/TP/.test(rec.openOrders) || !/SL/.test(rec.openOrders) || !/OCO/.test(rec.openOrders) || rec.overflowX || !rec.noXrp ||
      !rec.gaugeVisible || !(rec.gaugeNow >= 0 && rec.gaugeNow <= 100) || !/stop|profit/.test(rec.gaugeText)
    if (bad) failed = true
  } catch (e) {
    rec.failure = String(e)
    failed = true
    await s.page.screenshot({ path: `review/run-tpsl-${device}-failure.png` }).catch(() => {})
  }
  rec.errors = s.errors
  if (s.errors?.length) failed = true
  await closeGame(s)
  out[device] = rec
  console.log(JSON.stringify(rec))
}
fs.writeFileSync("review/tpsl.json", JSON.stringify(out, null, 2))
if (failed) process.exitCode = 1
