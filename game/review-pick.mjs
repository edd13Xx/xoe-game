#!/usr/bin/env node
/** Local-only check of click-to-price on the XOE trade desk: book rows and tape prints fill the order form (sim, testnet XOE, no real money). */
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
    const tabs = page.locator(".pd-tabs")
    const showPanel = async (name) => {
      const t = tabs.getByRole("tab", { name, exact: true })
      if (await t.isVisible().catch(() => false)) await t.click()
    }
    const pressed = async (name) => (await page.locator(".pd-order").getByRole("button", { name, exact: true }).getAttribute("aria-pressed")) === "true"
    const sideNow = async () => page.locator(".pd-order").getAttribute("data-side")
    const note = page.locator("[data-testid=pd-pick-note]")
    rec.startMarket = await pressed("Market")
    // 1) Tap a bid row while on Market: switches to Limit, fills the price, side Buy.
    await showPanel("Book")
    const book = page.locator("[data-testid=order-book]")
    const bid = book.locator(".ob-row.bid").nth(2)
    const bidPx = (await bid.locator(".ob-px").innerText()).trim()
    await bid.click()
    await wait(s, 150)
    rec.bidPx = bidPx
    rec.bidLimit = await page.getByLabel("Limit price").inputValue()
    rec.bidToLimit = await pressed("Limit")
    rec.bidSide = await sideNow()
    rec.highlight = (await page.locator("[data-testid=pd-price-field]").getAttribute("data-picked")) === "1"
    rec.highlightClass = await page.locator("[data-testid=pd-price-field]").evaluate((el) => /pd-picked-[ab]/.test(el.className))
    rec.noteRole = await note.getAttribute("role")
    rec.noteLive = await note.getAttribute("aria-live")
    rec.bidNote = await note.innerText()
    await note.evaluate((el) => el.scrollIntoView({ block: "center" }))
    await wait(s, 250)
    await page.screenshot({ path: `review/run-pick-${device}.png` })
    rec.noteOverflow = await note.evaluate((el) => el.scrollWidth > el.clientWidth + 1)
    await wait(s, 1300)
    rec.highlightFades = (await page.locator("[data-testid=pd-price-field]").getAttribute("data-picked")) === "0"
    // 2) Keyboard: focus an ask row, press Enter -> Sell limit at that price.
    await showPanel("Book")
    const ask = book.locator(".ob-row.ask").last()
    const askPx = (await ask.locator(".ob-px").innerText()).trim()
    await ask.focus()
    const markBefore = Number(await desk.getAttribute("data-mark"))
    await page.keyboard.press("Enter")
    await wait(s, 150)
    rec.askPx = askPx
    rec.askLimit = await page.getByLabel("Limit price").inputValue()
    rec.askSide = await sideNow()
    const markAsk = Number(await desk.getAttribute("data-mark"))
    // The side follows the price vs the live mark (a limit above it is a sell, below it a buy).
    const okFor = (m) => Number(askPx) === m || rec.askSide === (Number(askPx) > m ? "sell" : "buy")
    rec.askSideOk = okFor(markBefore) || okFor(markAsk)
    // 3) Stop mode + tape print via Space: keeps Stop and fills the trigger.
    await page.locator("[data-testid=pd-otype-stop]").click()
    rec.stopNoteCleared = /\bempty\b/.test((await note.getAttribute("class")) || "")
    await showPanel("Trades")
    const prints = page.locator("[data-testid=recent-trades] .pd-print")
    rec.printCount = await prints.count()
    const pr = prints.first()
    const prPx = (await pr.locator(".px").innerText()).trim()
    rec.printLabel = await pr.getAttribute("aria-label")
    await pr.focus()
    await page.keyboard.press("Space")
    await wait(s, 150)
    rec.printPx = prPx
    rec.trigger = await page.locator("[data-testid=pd-stop-px]").inputValue()
    rec.stillStop = await pressed("Stop")
    rec.printNote = await note.innerText()
    const mark = Number(await desk.getAttribute("data-mark"))
    const trig = Number(rec.trigger)
    rec.stopSideOk = trig === mark || (await sideNow()) === (trig > mark ? "buy" : "sell")
    // 4) Typing a price clears the pick note.
    await page.locator("[data-testid=pd-stop-px]").fill("1")
    rec.typeClears = /\bempty\b/.test((await note.getAttribute("class")) || "")
    // The form never placed an order.
    rec.noOrders = (await page.locator(".pd-lower-tabs").getByRole("tab", { name: /Open orders/ }).innerText()).match(/\((\d+)\)/)?.[1] ?? "0"
    rec.overflowX = await page.evaluate(() => {
      const sheet = document.querySelector(".drawer-sheet")
      return sheet ? sheet.scrollWidth > sheet.clientWidth + 1 : true
    })
    const text = await page.locator(".drawer-sheet").innerText()
    rec.noXrp = !/xrp/i.test(text)
    rec.simLabel = /no real money/i.test(text)
    const bad = !rec.startMarket || Number(rec.bidLimit) !== Number(bidPx) || !rec.bidToLimit || rec.bidSide !== "buy" || !rec.highlight ||
      !rec.highlightClass || rec.noteRole !== "status" || rec.noteLive !== "polite" || !/^Limit price set to .* from the bid\. Buy limit/.test(rec.bidNote) ||
      rec.noteOverflow || !rec.highlightFades || Number(rec.askLimit) !== Number(askPx) || !rec.askSideOk || !rec.stopNoteCleared ||
      rec.printCount < 1 || !/Use this price/.test(rec.printLabel || "") || Number(rec.trigger) !== Number(prPx) || !rec.stillStop ||
      !/^Stop trigger set to .* print/.test(rec.printNote) || !rec.stopSideOk || !rec.typeClears || rec.noOrders !== "0" ||
      rec.overflowX || !rec.noXrp || !rec.simLabel
    if (bad) failed = true
  } catch (e) {
    rec.failure = String(e)
    failed = true
    await s.page.screenshot({ path: `review/run-pick-${device}-failure.png` }).catch(() => {})
  }
  rec.errors = s.errors
  if (s.errors?.length) failed = true
  await closeGame(s)
  out[device] = rec
  console.log(JSON.stringify(rec))
}
fs.writeFileSync("review/pick.json", JSON.stringify(out, null, 2))
if (failed) process.exitCode = 1
