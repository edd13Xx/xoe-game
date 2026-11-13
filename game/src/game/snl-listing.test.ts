import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  SNL_CASH_TIP,
  SNL_DISCLAIMER,
  SNL_EQUITY_TIP,
  SNL_FEE_TAKER,
  SNL_PAPER_CASH,
  SNL_SYMBOL,
  applySnlAction,
  canSnl,
  initialSnlBook,
  placeSnlOrder,
  snlEquity,
  snlFee,
  snlLiquidationPrice,
  snlPnl,
  snlPriceFromXoe,
  snlUnrealized,
  tickSnlBook,
} from "./snl-listing.ts"

describe("SNL simulated listing", () => {
  it("is labeled SNL and tracks the XOE/USD sim clamp", () => {
    expect(SNL_SYMBOL).toBe("SNL")
    expect(SNL_DISCLAIMER).toMatch(/simulated listing/i)
    expect(SNL_DISCLAIMER).toMatch(/not a real market/i)
    expect(SNL_DISCLAIMER).toMatch(/paper only/i)
    expect(snlPriceFromXoe(10)).toBe(10)
    expect(snlPriceFromXoe(1)).toBe(5)
    expect(snlPriceFromXoe(40)).toBe(20)
    expect(SNL_CASH_TIP).toMatch(/settled paper balance/i)
    expect(SNL_EQUITY_TIP).toMatch(/cash plus unrealized/i)
  })

  it("marks a long with cash vs equity and net P/L after fees", () => {
    const openFee = snlFee(10, 1, SNL_FEE_TAKER)
    let book = applySnlAction(initialSnlBook(), "long", 10)
    expect(book.side).toBe("long")
    expect(book.lots).toBe(1)
    expect(book.cash).toBeCloseTo(SNL_PAPER_CASH - openFee)
    expect(snlUnrealized(book, 10)).toBeCloseTo(0)
    expect(snlEquity(book, 10)).toBeCloseTo(book.cash)
    expect(snlUnrealized(book, 12)).toBeCloseTo(0.2)
    expect(snlEquity(book, 12)).toBeCloseTo(book.cash + 0.2)
    expect(snlPnl(book, 12)).toBeCloseTo(0.2 - openFee)
    expect(snlEquity(book, 12)).toBeGreaterThan(book.cash)
    const closeFee = snlFee(12, 1, SNL_FEE_TAKER)
    book = applySnlAction(book, "close", 12)
    expect(book.side).toBe("flat")
    expect(book.realized).toBeCloseTo(0.2)
    expect(book.feesPaid).toBeCloseTo(openFee + closeFee)
    expect(book.cash).toBeCloseTo(SNL_PAPER_CASH + 0.2 - openFee - closeFee)
    expect(snlPnl(book, 12)).toBeCloseTo(0.2 - openFee - closeFee)
  })

  it("marks a short in profit and covers with fee-aware P/L", () => {
    const openFee = snlFee(10, 1, SNL_FEE_TAKER)
    let book = applySnlAction(initialSnlBook(), "short", 10)
    expect(book.side).toBe("short")
    expect(book.lots).toBe(1)
    expect(book.cash).toBeCloseTo(SNL_PAPER_CASH - openFee)
    expect(snlUnrealized(book, 8)).toBeCloseTo(0.2)
    expect(snlEquity(book, 8)).toBeCloseTo(book.cash + 0.2)
    expect(snlPnl(book, 8)).toBeCloseTo(0.2 - openFee)
    const closeFee = snlFee(8, 1, SNL_FEE_TAKER)
    book = applySnlAction(book, "cover", 8)
    expect(book.side).toBe("flat")
    expect(book.realized).toBeCloseTo(0.2)
    expect(book.cash).toBeCloseTo(SNL_PAPER_CASH + 0.2 - openFee - closeFee)
  })

  it("partial-closes a long and keeps the average entry", () => {
    let book = applySnlAction(initialSnlBook(), "long", 10, 2)
    book = applySnlAction(book, "close", 12, 1)
    expect(book.side).toBe("long")
    expect(book.lots).toBe(1)
    expect(book.entry).toBeCloseTo(10)
    expect(book.realized).toBeCloseTo(0.2)
    expect(snlUnrealized(book, 12)).toBeCloseTo(0.2)
  })

  it("reverses a long into a short and will not short while long", () => {
    const longBook = applySnlAction(initialSnlBook(), "long", 10)
    expect(canSnl(longBook, "short", 10)).toBe(false)
    expect(applySnlAction(longBook, "short", 10)).toBe(longBook)
    const flipped = applySnlAction(longBook, "reverse", 10)
    expect(flipped.side).toBe("short")
    expect(flipped.lots).toBe(1)
    expect(flipped.lastAction).toBe("reverse")
    expect(flipped.realized).toBeCloseTo(0)
    expect(flipped.feesPaid).toBeGreaterThan(0)
    expect(flipped.cash).toBeCloseTo(SNL_PAPER_CASH - flipped.feesPaid)
  })

  it("stays on the isolated paper book and does not invent cash past starting margin", () => {
    let book = initialSnlBook()
    let opened = 0
    for (let i = 0; i < 400; i++) {
      const next = applySnlAction(book, "short", 10)
      if (next === book) break
      book = next
      opened += 1
    }
    expect(opened).toBeGreaterThan(0)
    expect(snlEquity(book, 10)).toBeCloseTo(book.cash)
    expect(book.cash).toBeLessThanOrEqual(SNL_PAPER_CASH)
    expect(book.feesPaid).toBeGreaterThan(0)
  })

  it("fills a take-profit and posts a liquidation-style price for a leveraged-feeling short", () => {
    let book = applySnlAction(initialSnlBook(), "short", 10, 8)
    const liq = snlLiquidationPrice(book)
    expect(liq).not.toBeNull()
    expect(liq!).toBeGreaterThan(10)
    const placed = placeSnlOrder(book, { action: "cover", type: "take-profit", lots: 8, price: 9, now: 5 })
    expect(placed.error).toBeUndefined()
    const filled = tickSnlBook(placed.book, 8.9, 9.0, 8.8, 6)
    expect(filled.side).toBe("flat")
    expect(filled.realized).toBeGreaterThan(0)
    expect(filled.orders[0]?.status).toBe("filled")
  })

  it("is local sim source with no network or exchange branding", () => {
    const src = readFileSync("src/game/snl-listing.ts", "utf8")
    const ui = readFileSync("src/ui/SnlListing.tsx", "utf8")
    const candles = readFileSync("src/game/sim-candles.ts", "utf8")
    expect(src).not.toMatch(/fetch\(|XMLHttpRequest|WebSocket/)
    expect(`${src}\n${ui}\n${candles}`).not.toMatch(/coinbase/i)
  })
})

describe("TP/SL bracket (OCO, sim)", () => {
  it("take profit fills on a long and cancels the stop", async () => {
    const m = await import("./snl-listing.ts")
    let b = m.applySnlAction(m.initialSnlBook(), "long", 10, 2)
    const r = m.attachSnlBracket(b, { tp: 10.5, sl: 9.5 })
    expect(r.error).toBeUndefined()
    b = r.book
    expect(m.snlBracket(b)).toEqual({ tp: 10.5, sl: 9.5 })
    b = m.tickSnlBook(b, 10.6, 10.6, 10.4, 5)
    expect(b.side).toBe("flat")
    expect(b.realized).toBeGreaterThan(0)
    expect(b.orders.filter((o) => o.status === "open")).toHaveLength(0)
    expect(b.orders.find((o) => o.type === "stop")?.status).toBe("canceled")
  })
  it("stop loss fills on a short and cancels the take profit", async () => {
    const m = await import("./snl-listing.ts")
    let b = m.applySnlAction(m.initialSnlBook(), "short", 10, 2)
    b = m.attachSnlBracket(b, { tp: 9.5, sl: 10.4 }).book
    b = m.tickSnlBook(b, 10.5, 10.5, 10.45, 5)
    expect(b.side).toBe("flat")
    expect(b.realized).toBeLessThan(0)
    expect(b.orders.find((o) => o.type === "take-profit")?.status).toBe("canceled")
  })
  it("manual close cancels the leftover bracket", async () => {
    const m = await import("./snl-listing.ts")
    let b = m.applySnlAction(m.initialSnlBook(), "long", 10, 1)
    b = m.attachSnlBracket(b, { sl: 9 }).book
    b = m.applySnlAction(b, "close", 10.1, 1)
    b = m.tickSnlBook(b, 10.1)
    expect(b.orders.filter((o) => o.status === "open")).toHaveLength(0)
  })
  it("needs an open position", async () => {
    const m = await import("./snl-listing.ts")
    expect(m.attachSnlBracket(m.initialSnlBook(), { tp: 11 }).error).toBeTruthy()
  })
})
