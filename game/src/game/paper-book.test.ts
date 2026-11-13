import { describe, expect, it } from "vitest"
import {
  BOOK_DEPTH,
  bookDecimals,
  buildSyntheticBook,
  initialPaperDesk,
  simMidAt,
  tickPaperDesk,
  withCumulative,
} from "./paper-advanced.ts"

const CASES: [number, number][] = [
  [0.12, 0.00006],
  [0.12, 0.01],
  [0.45, 0.000225],
  [3200, 1.6],
  [90000, 45],
  [0.12, 0.0000123],
]

describe("synthetic sim order book", () => {
  it("is deterministic for the same mid, step and tick", () => {
    for (const [mid, step] of CASES) {
      for (const tick of [0, 1, 7, 123456]) {
        expect(buildSyntheticBook(mid, step, tick)).toEqual(buildSyntheticBook(mid, step, tick))
      }
    }
  })

  it("keeps best ask above best bid, prices ordered and positive, sizes positive", () => {
    for (const [mid, step] of CASES) {
      for (let tick = 0; tick < 60; tick++) {
        const m = simMidAt(mid, tick)
        const b = buildSyntheticBook(m, step, tick)
        expect(b.bids).toHaveLength(BOOK_DEPTH)
        expect(b.asks).toHaveLength(BOOK_DEPTH)
        expect(b.asks[0]!.price).toBeGreaterThan(b.bids[0]!.price)
        expect(b.bids[0]!.price).toBeLessThanOrEqual(m)
        expect(b.asks[0]!.price).toBeGreaterThanOrEqual(m)
        expect(b.spread).toBeGreaterThan(0)
        for (let i = 1; i < BOOK_DEPTH; i++) {
          expect(b.bids[i]!.price).toBeLessThan(b.bids[i - 1]!.price)
          expect(b.asks[i]!.price).toBeGreaterThan(b.asks[i - 1]!.price)
        }
        for (const l of [...b.bids, ...b.asks]) {
          expect(l.size).toBeGreaterThan(0)
          expect(l.price).toBeGreaterThan(0)
          expect(Number.isFinite(l.size)).toBe(true)
        }
      }
    }
  })

  it("is no longer a fixed linear ramp: sizes vary, change over ticks, and walls appear", () => {
    const a = buildSyntheticBook(0.12, 0.00006, 10)
    const diffs = a.bids.slice(1).map((l, i) => +(l.size - a.bids[i]!.size).toFixed(4))
    expect(new Set(diffs).size).toBeGreaterThan(3)
    // Some (not necessarily all) levels re-roll between neighbouring ticks.
    let changedTicks = 0
    let walls = 0
    let totalChanged = 0
    for (let t = 0; t < 40; t++) {
      const x = buildSyntheticBook(0.12, 0.00006, t)
      const y = buildSyntheticBook(0.12, 0.00006, t + 1)
      const changed = x.bids.filter((l, i) => l.size !== y.bids[i]!.size).length
      if (changed > 0) changedTicks += 1
      totalChanged += changed
      expect(changed).toBeLessThan(BOOK_DEPTH + 1)
      const sizes = [...x.bids, ...x.asks].map((l) => l.size).sort((p, q) => p - q)
      const median = sizes[Math.floor(sizes.length / 2)]!
      if (sizes[sizes.length - 1]! > median * 2.5) walls += 1
    }
    expect(changedTicks).toBeGreaterThan(30)
    // Only a minority of levels re-roll each tick (each level has its own 2–5 tick cadence).
    expect(totalChanged / 40).toBeLessThan(BOOK_DEPTH * 0.6)
    expect(walls).toBeGreaterThan(0)
  })

  it("spread breathes between one and four steps", () => {
    const spreads = new Set<number>()
    for (let t = 0; t < 200; t++) {
      const b = buildSyntheticBook(0.12, 0.00006, t)
      const steps = Math.round(b.spread / 0.00006)
      expect(steps).toBeGreaterThanOrEqual(1)
      expect(steps).toBeLessThanOrEqual(4)
      spreads.add(steps)
    }
    expect(spreads.size).toBeGreaterThan(1)
  })

  it("cumulative size is monotonic and ends at the side total", () => {
    for (let t = 0; t < 20; t++) {
      const b = buildSyntheticBook(3200, 1.6, t)
      for (const side of [b.bids, b.asks]) {
        const cum = withCumulative(side)
        let last = 0
        for (const l of cum) {
          expect(l.cum).toBeGreaterThan(last)
          last = l.cum
        }
        expect(last).toBeCloseTo(side.reduce((s, l) => s + l.size, 0), 3)
      }
    }
  })

  it("sim mid drifts but stays near the anchor", () => {
    const mids = Array.from({ length: 200 }, (_, t) => simMidAt(0.12, t))
    expect(new Set(mids).size).toBeGreaterThan(100)
    for (const m of mids) expect(Math.abs(m / 0.12 - 1)).toBeLessThan(0.005)
    expect(simMidAt(0.12, 42)).toBe(simMidAt(0.12, 42))
  })

  it("ticking the desk refreshes the book, reports changed levels and keeps balances", () => {
    const d0 = initialPaperDesk("XLM-USD", 0.12)
    expect(d0.bids[d0.bids.length - 1]!.price).toBeGreaterThan(0)
    const d1 = tickPaperDesk(d0, 1000)
    const d2 = tickPaperDesk(d1, 1001)
    expect(d2.cash).toBe(d0.cash)
    expect(d2.base).toBe(d0.base)
    expect(d2.anchor).toBe(0.12)
    expect(d2.asks[0]!.price).toBeGreaterThan(d2.bids[0]!.price)
    expect(Array.isArray(d2.changed)).toBe(true)
    for (const k of d2.changed ?? []) expect(k).toMatch(/^(bid|ask)-\d/)
    expect(tickPaperDesk(d1, 1001)).toEqual(d2)
  })

  it("picks enough price decimals for tiny steps", () => {
    expect(bookDecimals(45)).toBe(2)
    expect(bookDecimals(0.00006)).toBeGreaterThanOrEqual(6)
  })
})
