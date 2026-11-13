import { describe, expect, it } from "vitest"
import { STROOPS_PER_XOE } from "./economy.ts"
import { applyTradePnl, emptyLedger } from "./reward-plan.ts"
import {
  TRADE_LOT_STROOPS,
  applyPaperAction,
  applyPracticeTick,
  canBuy,
  canSell,
  finalizePractice,
  initialPractice,
  paperResult,
  paperResultStroops,
  runPractice,
} from "./practice.ts"

describe("Buy/Sell XOE math", () => {
  it("buy spends sim cash and adds 0.1 XOE at the live price", () => {
    const start = initialPractice({ unclaimedStroops: 0, price: 10 })
    expect(canBuy(start, 10)).toBe(true)
    const next = applyPaperAction(start, "buy", 10)
    expect(next.xoeStroops).toBe(start.xoeStroops + TRADE_LOT_STROOPS)
    expect(next.cash).toBeCloseTo(start.cash - 1, 8) // 0.1 XOE × $10
  })

  it("sell credits sim cash and removes 0.1 XOE, never below 0 holdings", () => {
    const start = initialPractice({ unclaimedStroops: TRADE_LOT_STROOPS, price: 10 })
    expect(canSell(start, 10)).toBe(true)
    const sold = applyPaperAction(start, "sell", 10)
    expect(sold.xoeStroops).toBe(0)
    expect(sold.cash).toBeCloseTo(start.cash + 1, 8)
    expect(canSell(sold, 10)).toBe(false)
    expect(applyPaperAction(sold, "sell", 10)).toBe(sold)
  })

  it("buy-sell-buy-sell on the default rising path is a win, the inverse is a loss", () => {
    const up = runPractice(["buy", "sell", "buy", "sell"])
    expect(up.outcome).toBe("paper-up")
    expect(paperResult(up)).toBeGreaterThan(0)
    const down = runPractice(["sell", "buy", "sell", "buy"])
    expect(down.outcome).toBe("paper-down")
    expect(paperResult(down)).toBeLessThan(0)
  })

  it("P/L stroops match mark-to-market at the live price", () => {
    let s = initialPractice({ unclaimedStroops: STROOPS_PER_XOE, price: 10 })
    s = applyPaperAction(s, "sell", 10)
    s = applyPracticeTick(s, 8)
    // sold 0.1 at $10, remaining 0.9 XOE now marked at $8: start 1*10+20=30, end 0.9*8+21=28.2, pnl -1.8
    expect(paperResult(s, 8)).toBeCloseTo(-1.8, 8)
    expect(paperResultStroops(s, 8)).toBe(Math.round((-1.8 / 8) * STROOPS_PER_XOE))
    const done = finalizePractice(s, 8)
    expect(done.outcome).toBe("paper-down")
  })
})

describe("trade P/L vs the locked reward ledger", () => {
  it("credits gains through the daily cap and never drops unclaimed below 0", () => {
    let l = emptyLedger("p-test")
    l = { ...l, unclaimed: 2_000_000, lifetime: 2_000_000, todayCredited: 0 }
    const win = applyTradePnl(l, 500_000)
    expect(win.credited).toBeGreaterThan(0)
    expect(win.ledger.unclaimed).toBeGreaterThan(l.unclaimed)
    const loss = applyTradePnl(win.ledger, -50_000_000)
    expect(loss.ledger.unclaimed).toBe(0)
    expect(loss.ledger.lifetime).toBe(win.ledger.lifetime)
  })
})

  it("same-price tick is a no-op so the desk cannot loop", () => {
    const start = initialPractice({ price: 10 })
    const next = applyPracticeTick(start, 10)
    expect(next).toBe(start)
  })
