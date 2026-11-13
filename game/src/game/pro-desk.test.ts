import { describe, expect, it } from "vitest"
import {
  MINUTE_MS,
  SEED_MINUTES,
  advanceLiveBars,
  aggregateBars,
  amountFromLots,
  deskAction,
  depthSeries,
  limitProblem,
  stopProblem,
  lotsFromAmount,
  maxLotsFor,
  nextProBook,
  pctLots,
  seedMinuteBars,
  seedTape,
  stats24h,
  stepTape,
  tradesForTick,
} from "./pro-desk.ts"
import { initialSnlBook, applySnlAction, placeSnlOrder, tickSnlBook } from "./snl-listing.ts"
import { XOE_SIM_MAX, XOE_SIM_MIN } from "./xoe-sim-price.ts"

const T0 = Math.floor(1_760_000_000_000 / MINUTE_MS) * MINUTE_MS

describe("pro desk candles", () => {
  it("seeds deterministic minute bars that end on the given price", () => {
    const a = seedMinuteBars(10.2, T0)
    const b = seedMinuteBars(10.2, T0)
    expect(a).toEqual(b)
    expect(a).toHaveLength(SEED_MINUTES)
    expect(a[a.length - 1]!.c).toBeCloseTo(10.2, 9)
    expect(a[a.length - 1]!.t).toBe(T0 - MINUTE_MS)
    for (const c of a) {
      expect(c.h).toBeGreaterThanOrEqual(Math.max(c.o, c.c))
      expect(c.l).toBeLessThanOrEqual(Math.min(c.o, c.c))
      expect(c.l).toBeGreaterThan(XOE_SIM_MIN - 1)
      expect(c.h).toBeLessThan(XOE_SIM_MAX + 1)
      expect(c.v).toBeGreaterThan(0)
    }
  })

  it("updates the live bar inside a minute and opens a new bar on the next", () => {
    const seed = seedMinuteBars(10, T0, 60)
    const a = advanceLiveBars(seed, 10.1, T0 + 5_000)
    expect(a).toHaveLength(61)
    expect(a[60]!.o).toBe(seed[59]!.c)
    const b = advanceLiveBars(a, 9.9, T0 + 20_000)
    expect(b).toHaveLength(61)
    expect(b[60]!.h).toBeCloseTo(10.1)
    expect(b[60]!.l).toBeCloseTo(9.9)
    expect(b[60]!.c).toBeCloseTo(9.9)
    const c = advanceLiveBars(b, 10.3, T0 + 61_000)
    expect(c).toHaveLength(62)
    expect(c[61]!.o).toBeCloseTo(9.9)
  })

  it("aggregates minute bars into bigger timeframes without losing range or volume", () => {
    const bars = seedMinuteBars(10, T0, 240)
    const h = aggregateBars(bars, "1h")
    expect(h.length).toBeGreaterThanOrEqual(4)
    expect(h.length).toBeLessThanOrEqual(5)
    const sumV = bars.reduce((s, b) => s + b.v, 0)
    expect(h.reduce((s, b) => s + b.v, 0)).toBeCloseTo(sumV, 0)
    expect(Math.max(...h.map((b) => b.h))).toBeCloseTo(Math.max(...bars.map((b) => b.h)), 9)
    expect(aggregateBars(bars, "1m")).toHaveLength(240)
    expect(aggregateBars(bars, "5m").length).toBeLessThan(60)
  })

  it("computes 24h stats from the last day of bars", () => {
    const bars = seedMinuteBars(10, T0)
    const s = stats24h(bars)
    expect(s.high).toBeGreaterThanOrEqual(s.low)
    expect(s.last).toBeCloseTo(10, 9)
    expect(s.volume).toBeGreaterThan(1000)
    expect(s.changePct).toBeCloseTo(((s.last - s.open) / s.open) * 100, 9)
  })
})

describe("pro desk book and tape", () => {
  it("builds a book around the sim price with bid < ask and reports changed levels", () => {
    const a = nextProBook(null, 10.05, 0.01, 100)
    expect(a.bids[0]!.price).toBeLessThan(a.asks[0]!.price)
    const b = nextProBook(a, 10.05, 0.01, 103)
    expect(b.changed.length).toBeGreaterThan(0)
    expect(b.changed.length).toBeLessThan(24)
    expect(nextProBook(null, 10.05, 0.01, 100)).toEqual(a)
  })

  it("makes deterministic prints near the price and a growing capped tape", () => {
    expect(tradesForTick(10, 0.01, 77)).toEqual(tradesForTick(10, 0.01, 77))
    for (const t of tradesForTick(10, 0.01, 78)) expect(Math.abs(t.price - 10)).toBeLessThan(0.05)
    let tape = seedTape(10, 0.01, 500)
    expect(tape.length).toBeGreaterThan(5)
    for (let i = 501; i < 600; i++) tape = stepTape(tape, 10, 0.01, i)
    expect(tape.length).toBeLessThanOrEqual(40)
  })

  it("builds cumulative depth series", () => {
    const book = nextProBook(null, 10, 0.01, 5)
    const d = depthSeries(book.bids, book.asks)
    for (let i = 1; i < d.bids.length; i++) expect(d.bids[i]!.cum).toBeGreaterThan(d.bids[i - 1]!.cum)
    for (let i = 1; i < d.asks.length; i++) expect(d.asks[i]!.cum).toBeGreaterThan(d.asks[i - 1]!.cum)
    expect(d.maxCum).toBeGreaterThan(0)
  })
})

describe("pro desk order mapping (SNL paper book)", () => {
  it("maps buy and sell onto the existing paper actions", () => {
    expect(deskAction("buy", { side: "flat" })).toBe("long")
    expect(deskAction("buy", { side: "long" })).toBe("long")
    expect(deskAction("buy", { side: "short" })).toBe("cover")
    expect(deskAction("sell", { side: "flat" })).toBe("short")
    expect(deskAction("sell", { side: "short" })).toBe("short")
    expect(deskAction("sell", { side: "long" })).toBe("close")
  })

  it("converts amounts to lots and back, and caps the quick buttons by what is available", () => {
    expect(lotsFromAmount(0.5)).toBe(5)
    expect(lotsFromAmount(0.01)).toBe(1)
    expect(lotsFromAmount(0)).toBe(0)
    expect(lotsFromAmount(Number.NaN)).toBe(0)
    expect(amountFromLots(5)).toBe(0.5)
    const book = initialSnlBook()
    const max = maxLotsFor("buy", book, 10)
    expect(max).toBe(19)
    // the paper engine agrees: the max fills, one more does not
    expect(applySnlAction(book, "long", 10, max)).not.toBe(book)
    expect(applySnlAction(book, "long", 10, max + 2)).toBe(book)
    expect(pctLots(max, 100)).toBe(max)
    expect(pctLots(max, 25)).toBe(4)
    expect(pctLots(0, 50)).toBe(0)
    const long = applySnlAction(book, "long", 10, 3)
    expect(maxLotsFor("sell", long, 10)).toBe(3)
  })

  it("keeps resting limits on the right side of the market", () => {
    expect(limitProblem("buy", 9.9, 10)).toBeNull()
    expect(limitProblem("buy", 10.1, 10)).toMatch(/below/)
    expect(limitProblem("sell", 10.1, 10)).toBeNull()
    expect(limitProblem("sell", 9.9, 10)).toMatch(/above/)
    expect(limitProblem("sell", null, 10)).toMatch(/Enter/)
  })
})

describe("pro desk TP/SL checks", () => {
  it("validates bracket sides", async () => {
    const { bracketProblem, optionalPx } = await import("./pro-desk.ts")
    expect(bracketProblem("long", 10, 10.5, 9.5)).toBeNull()
    expect(bracketProblem("long", 10, 9.9, null)).toMatch(/above/)
    expect(bracketProblem("long", 10, null, 10.1)).toMatch(/below/)
    expect(bracketProblem("short", 10, 9.5, 10.5)).toBeNull()
    expect(bracketProblem("short", 10, 10.2, null)).toMatch(/below/)
    expect(bracketProblem("short", 10, null, 9.8)).toMatch(/above/)
    expect(optionalPx("")).toBeNull()
    expect(optionalPx("abc")).toBe("bad")
    expect(optionalPx("10.2")).toBe(10.2)
  })
})

describe("pro desk bracket gauge", () => {
  it("places the mark between SL and TP for longs and shorts", async () => {
    const { bracketGauge } = await import("./pro-desk.ts")
    expect(bracketGauge("flat", 10, 10, 11, 9)).toBeNull()
    expect(bracketGauge("long", 10, 10, null, 9)).toBeNull()
    expect(bracketGauge("long", 10, 10, 9, 11)).toBeNull()
    const mid = bracketGauge("long", 10, 10, 11, 9)!
    expect(mid.mark).toBeCloseTo(0.5)
    expect(mid.entry).toBeCloseTo(0.5)
    expect(mid.zone).toBe("mid")
    const nearTp = bracketGauge("long", 10, 10.9, 11, 9)!
    expect(nearTp.zone).toBe("near-tp")
    expect(nearTp.label).toMatch(/take profit/)
    const shortNearSl = bracketGauge("short", 10, 10.9, 9, 11)!
    expect(shortNearSl.mark).toBeCloseTo(0.05)
    expect(shortNearSl.zone).toBe("near-sl")
    expect(bracketGauge("long", 10, 20, 11, 9)!.mark).toBe(1)
  })

  it("keeps stop entries on the breakout side of the market", () => {
    expect(stopProblem("buy", 10.2, 10)).toBeNull()
    expect(stopProblem("buy", 9.8, 10)).toMatch(/above/)
    expect(stopProblem("buy", 10, 10)).toMatch(/above/)
    expect(stopProblem("sell", 9.8, 10)).toBeNull()
    expect(stopProblem("sell", 10.2, 10)).toMatch(/below/)
    expect(stopProblem("sell", null, 10)).toMatch(/Enter/)
  })

  it("fills a buy stop only once XOE trades up through the trigger (sim)", () => {
    const base = { ...initialSnlBook(), markedPrice: 10 }
    const placed = placeSnlOrder(base, { action: "long", type: "stop", lots: 2, price: 10.2 })
    expect(placed.error).toBeUndefined()
    const below = tickSnlBook(placed.book, 10.1, 10.15, 10.05)
    expect(below.side).toBe("flat")
    expect(below.orders[0]!.status).toBe("open")
    const through = tickSnlBook(below, 10.25, 10.3, 10.1)
    expect(through.side).toBe("long")
    expect(through.lots).toBe(2)
    expect(through.orders[0]!.status).toBe("filled")
  })
})
