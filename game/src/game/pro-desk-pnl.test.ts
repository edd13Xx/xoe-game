import { describe, expect, it } from "vitest"
import { fillNet, pnlStats } from "./pro-desk.ts"
import type { SnlFill } from "./snl-listing.ts"

const f = (id: number, action: SnlFill["action"], realized: number, fee: number): SnlFill => ({
  id: `f${id}`, orderId: "mkt", action, price: 10, lots: 1, fee, realized, at: id,
})

describe("pnlStats (sim trade journal)", () => {
  it("is empty with no fills", () => {
    const s = pnlStats([])
    expect(s.trades).toBe(0)
    expect(s.winRate).toBeNull()
    expect(s.profitFactor).toBeNull()
    expect(s.curve).toEqual([0])
  })
  it("counts close/cover fills as trades, nets fees, tracks drawdown", () => {
    const fills = [f(1, "long", 0, 0.01), f(2, "close", 0.5, 0.01), f(3, "short", 0, 0.01), f(4, "cover", -0.2, 0.01)]
    const s = pnlStats([...fills].reverse())
    expect(s.trades).toBe(2)
    expect(s.wins).toBe(1)
    expect(s.losses).toBe(1)
    expect(s.winRate).toBe(0.5)
    expect(s.best).toBeCloseTo(0.49)
    expect(s.worst).toBeCloseTo(-0.21)
    expect(s.profitFactor).toBeCloseTo(0.49 / 0.21)
    expect(s.net).toBeCloseTo(0.26)
    expect(s.feesPaid).toBeCloseTo(0.04)
    expect(s.curve).toHaveLength(5)
    expect(s.maxDrawdown).toBeCloseTo(0.22)
  })
  it("reports infinite profit factor with only wins", () => {
    expect(pnlStats([f(1, "close", 1, 0)]).profitFactor).toBe(Infinity)
  })
  it("fillNet is null for opening fills", () => {
    expect(fillNet(f(1, "long", 0, 0.01))).toBeNull()
    expect(fillNet(f(1, "close", 1, 0.1))).toBeCloseTo(0.9)
  })
})
