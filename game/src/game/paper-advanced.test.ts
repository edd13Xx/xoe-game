import { describe, expect, it } from "vitest"
import { estimateTotal, initialPaperDesk, placePaperOrder } from "./paper-advanced.ts"

describe("paper advanced desk", () => {
  it("estimates fees and fills market buys with paper balances", () => {
    const desk = initialPaperDesk("XLM-USD", 0.1)
    const est = estimateTotal("buy", "market", null, 10, 0.1)
    expect(est.fee).toBeGreaterThan(0)
    const res = placePaperOrder(desk, "buy", "market", null, 10)
    expect(res.error).toBeUndefined()
    expect(res.state.fills.length).toBe(1)
    expect(res.state.cash).toBeLessThan(desk.cash)
    expect(res.state.base).toBeGreaterThan(desk.base)
  })
})
