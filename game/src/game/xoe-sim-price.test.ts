import { describe, expect, it } from "vitest"
import { seededRng } from "./ticker-play.ts"
import {
  XOE_SIM_ANCHOR,
  XOE_SIM_MAX,
  XOE_SIM_MIN,
  clampXoeSimPrice,
  formatXoeTickPrice,
  initialXoeSim,
  lerpPrice,
  stepXoeSimPrice,
  tickXoeSim,
  xoeChangePct,
  xoeSimQuote,
} from "./xoe-sim-price.ts"
import { xoeWorldItems } from "./ticker-play.ts"

describe("XOE/USD sim price bounds", () => {
  it("clamps to $5–$20 sim and never returns 0 or below", () => {
    expect(clampXoeSimPrice(10)).toBe(10)
    expect(clampXoeSimPrice(4.9)).toBe(XOE_SIM_MIN)
    expect(clampXoeSimPrice(20.1)).toBe(XOE_SIM_MAX)
    expect(clampXoeSimPrice(0)).toBe(XOE_SIM_ANCHOR)
    expect(clampXoeSimPrice(-3)).toBe(XOE_SIM_ANCHOR)
    expect(clampXoeSimPrice(Number.NaN)).toBe(XOE_SIM_ANCHOR)
    expect(clampXoeSimPrice(-Infinity)).toBe(XOE_SIM_ANCHOR)
  })

  it("a long random walk stays inside the band and never hits 0", () => {
    const rng = seededRng(42)
    let p = XOE_SIM_ANCHOR
    for (let i = 0; i < 2000; i += 1) {
      p = stepXoeSimPrice(p, { noise: rng() - 0.5, xlmStepPct: (rng() - 0.5) * 2, offline: i % 7 === 0 })
      expect(p).toBeGreaterThan(0)
      expect(p).toBeGreaterThanOrEqual(XOE_SIM_MIN)
      expect(p).toBeLessThanOrEqual(XOE_SIM_MAX)
    }
  })

  it("follows the sign of a large XLM step and still mean-reverts toward $10", () => {
    const up = stepXoeSimPrice(10, { xlmStepPct: 2, noise: 0 })
    const down = stepXoeSimPrice(10, { xlmStepPct: -2, noise: 0 })
    expect(up).toBeGreaterThan(10)
    expect(down).toBeLessThan(10)
    let p = 16
    for (let i = 0; i < 80; i += 1) p = stepXoeSimPrice(p, { xlmStepPct: 0, noise: 0 })
    expect(p).toBeLessThan(16)
    expect(p).toBeGreaterThan(XOE_SIM_MIN)
  })

  it("builds a labeled sim quote with 24h-style %", () => {
    const s = tickXoeSim(initialXoeSim(0, 10), { now: 1, noise: 0, xlmStepPct: 1 })
    const q = xoeSimQuote(s, 10)
    expect(q.symbol).toBe("XOE")
    expect(q.pair).toBe("XOE-USD")
    expect(q.change24hPct).toBe(xoeChangePct(s.price, s.open24h))
    expect(formatXoeTickPrice(10.053)).toBe("10.053")
    expect(lerpPrice(10, 11, 0.5)).toBeCloseTo(10.5)
  })
})

describe("XOE world reactions", () => {
  it("spawns a green coin stream when the sim price ticks up", () => {
    const items = xoeWorldItems(10, 10.2, 1000, { x: 200, y: 200 })
    expect(items.length).toBeGreaterThan(0)
    expect(items.every((it) => it.symbol === "XOE" && it.kind === "orb")).toBe(true)
  })

  it("spawns red dips when the sim price ticks down", () => {
    const items = xoeWorldItems(10, 9.8, 1000, { x: 200, y: 200 })
    expect(items.length).toBeGreaterThan(0)
    expect(items.every((it) => it.symbol === "XOE" && it.kind === "hazard")).toBe(true)
    expect(items.every((it) => (it.stroops ?? 0) === 0)).toBe(true)
  })

  it("stays quiet on a flat tick", () => {
    expect(xoeWorldItems(10, 10, 1000)).toEqual([])
  })
})
