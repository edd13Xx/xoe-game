#!/usr/bin/env node
/** Local-only shots of the live sim order book (testnet XOE, no real money). */
import fs from "node:fs"
process.env.XOE_REVIEW_LIBRARY = "1"
const { openGame, closeGame, pressName, wait } = await import("./review-v19.mjs")
const tag = process.env.XOE_RUN_TAG || "run-0000"
const out = {}
let failed = false
for (const device of ["portrait", "landscape", "desktop"]) {
  const s = await openGame({ device })
  const rec = { device }
  try {
    if (!(await pressName(s, "XOE trade desk"))) throw new Error("cannot open trade desk")
    await wait(s, 300)
    const bookTab = s.page.locator(".paper-advanced .phone-tabs button", { hasText: /^book$/i })
    if (await bookTab.isVisible().catch(() => false)) await bookTab.click()
    const book = s.page.locator("[data-testid=order-book]")
    await book.waitFor({ state: "visible", timeout: 5000 })
    const first = await book.locator(".ob-row").evaluateAll((els) => els.map((e) => e.textContent))
    rec.flashSeen = false
    for (let i = 0; i < 20 && !rec.flashSeen; i++) {
      await wait(s, 200)
      rec.flashSeen = (await book.locator(".ob-row.chg-a, .ob-row.chg-b").count()) > 0
    }
    await wait(s, 1600)
    const later = await book.locator(".ob-row").evaluateAll((els) => els.map((e) => e.textContent))
    rec.rows = first.length
    rec.changedAfter3s = first.some((t, i) => t !== later[i])
    rec.mid = await book.locator(".ob-mid").textContent()
    const ladderBox = await book.boundingBox()
    const vp = s.page.viewportSize()
    rec.fitsWidth = !!ladderBox && ladderBox.x >= 0 && ladderBox.x + ladderBox.width <= vp.width + 1
    rec.overflowX = await s.page.evaluate(() => {
      const el = document.querySelector("[data-testid=order-book]")
      return el ? el.scrollWidth > el.clientWidth + 1 : true
    })
    const mid = book.locator(".ob-mid")
    if (device === "desktop") await book.evaluate((el) => el.scrollIntoView({ block: "center" }))
    else await mid.evaluate((el) => el.scrollIntoView({ block: "center" }))
    await wait(s, 200)
    if (device !== "landscape") {
      const name = device === "portrait" ? "phone" : "desktop"
      await s.page.screenshot({ path: `review/${tag}-orderbook-${name}.png` })
    } else {
      await s.page.screenshot({ path: `review/${tag}-orderbook-landscape.png` })
    }
    rec.labels = /no real money/i.test(await s.page.locator(".paper-advanced").innerText())
    if (rec.rows !== 16 || !rec.fitsWidth || rec.overflowX || !rec.labels || !rec.changedAfter3s || !rec.flashSeen) failed = true
  } catch (e) {
    rec.failure = String(e)
    failed = true
  }
  rec.errors = s.errors
  if (s.errors?.length) failed = true
  await closeGame(s)
  out[device] = rec
  console.log(JSON.stringify(rec))
}
fs.writeFileSync("review/orderbook.json", JSON.stringify(out, null, 2))
if (failed) process.exitCode = 1
