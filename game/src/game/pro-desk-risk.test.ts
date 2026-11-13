import { describe, expect, it } from "vitest"
import { RISK_PCTS, riskAtStop, riskLine, riskLots } from "./pro-desk.ts"

describe("risk-based sizing (sim)", () => {
  it("sizes so the stop loses the chosen share of equity", () => {
    // 1% of $100 = $1; long 10 -> 9.5 loses 0.05 per lot -> 20 lots
    expect(riskLots("long", 100, 10, 9.5, 1, 200)).toBe(20)
    expect(riskLots("short", 100, 10, 10.5, 0.5, 200)).toBe(10)
  })
  it("caps at what the order can use and never goes below one lot", () => {
    expect(riskLots("long", 100, 10, 9.99, 2, 15)).toBe(15)
    expect(riskLots("long", 1, 10, 5, 0.5, 50)).toBe(1)
  })
  it("returns 0 for a stop on the wrong side or bad input", () => {
    expect(riskLots("long", 100, 10, 10.2, 1, 200)).toBe(0)
    expect(riskLots("short", 100, 10, 9.8, 1, 200)).toBe(0)
    expect(riskLots("long", 100, 10, null, 1, 200)).toBe(0)
    expect(riskLots("long", 0, 10, 9, 1, 200)).toBe(0)
    expect(riskLots("long", 100, 10, 9, 1, 0)).toBe(0)
  })
  it("reports the dollars and share at risk", () => {
    const r = riskAtStop("long", 100, 10, 9.5, 20)!
    expect(r.usd).toBeCloseTo(1, 9)
    expect(r.pct).toBeCloseTo(1, 9)
    expect(riskAtStop("short", 100, 10, 9.5, 20)).toBeNull()
    expect(riskLine(r)).toMatch(/lose about 1\.000 \(1\.00% of sim equity\)/)
    expect(RISK_PCTS).toEqual([0.5, 1, 2])
  })
})
