import { describe, expect, it } from "vitest"
import { seededRng } from "./ticker-play.ts"
import { initialXoeSim, tickXoeSim, XOE_SIM_MAX, XOE_SIM_MIN } from "./xoe-sim-price.ts"
import { candlesFromCloses, seededPathEndingAt, terminalCandles, ticksPerBar } from "./sim-candles.ts"

describe("seeded sim candles and price path", () => {
  it("is deterministic and ends on the requested price", () => {
    const a = seededPathEndingAt(7, 80, 10.25)
    const b = seededPathEndingAt(7, 80, 10.25)
    expect(a).toEqual(b)
    expect(a.at(-1)).toBeCloseTo(10.25)
    expect(a.every((p) => p >= XOE_SIM_MIN && p <= XOE_SIM_MAX)).toBe(true)
    const other = seededPathEndingAt(8, 80, 10.25)
    expect(other).not.toEqual(a)
  })

  it("builds 1m and 5m candles with volume and wicks", () => {
    const path = seededPathEndingAt(11, 400, 10)
    const m1 = candlesFromCloses(path, "1m", { seed: 11 })
    const m5 = candlesFromCloses(path, "5m", { seed: 11 })
    expect(m1.length).toBeGreaterThan(m5.length)
    expect(m5.length).toBeGreaterThan(0)
    expect(m1.length).toBe(Math.ceil(path.length / ticksPerBar("1m")))
    for (const c of [...m1, ...m5]) {
      expect(c.h).toBeGreaterThanOrEqual(Math.max(c.o, c.c))
      expect(c.l).toBeLessThanOrEqual(Math.min(c.o, c.c))
      expect(c.v).toBeGreaterThan(0)
    }
    const live = terminalCandles([10, 10.1, 9.9], "1m", { seed: 3 })
    expect(live.length).toBeGreaterThan(10)
    expect(live.at(-1)!.c).toBeCloseTo(9.9)
  })

  it("tickXoeSim with a seeded noise stream stays in band and visits more than one regime", () => {
    const rng = seededRng(99)
    let s = initialXoeSim(0, 10)
    const regimes = new Set<string>()
    let spiked = false
    let volChanged = false
    const firstVol = s.vol
    for (let i = 0; i < 400; i++) {
      const prev = s.price
      s = tickXoeSim(s, { now: i * 1200, noise: rng() - 0.5, offline: true })
      expect(s.price).toBeGreaterThanOrEqual(XOE_SIM_MIN)
      expect(s.price).toBeLessThanOrEqual(XOE_SIM_MAX)
      expect(s.wickHigh).toBeGreaterThanOrEqual(s.price)
      expect(s.wickLow).toBeLessThanOrEqual(s.price)
      expect(s.volume).toBeGreaterThan(0)
      regimes.add(s.regime)
      if (Math.abs(s.price - prev) / prev > 0.012) spiked = true
      if (Math.abs(s.vol - firstVol) > 0.05) volChanged = true
    }
    expect(regimes.size).toBeGreaterThan(1)
    expect(volChanged).toBe(true)
    expect(spiked || s.vol > 1.2).toBe(true)
    const rng2 = seededRng(99)
    let t = initialXoeSim(0, 10)
    for (let i = 0; i < 20; i++) t = tickXoeSim(t, { now: i * 1200, noise: rng2() - 0.5, offline: true })
    const rng3 = seededRng(99)
    let u = initialXoeSim(0, 10)
    for (let i = 0; i < 20; i++) u = tickXoeSim(u, { now: i * 1200, noise: rng3() - 0.5, offline: true })
    expect(t.price).toBe(u.price)
    expect(t.regime).toBe(u.regime)
  })
})
