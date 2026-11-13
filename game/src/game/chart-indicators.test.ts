import { describe, expect, it } from "vitest"
import { EMA_FAST, EMA_SLOW, emaSeries, seriesPaths, trendLabel, trendRead, vwapSeries } from "./chart-indicators.ts"
import type { SimCandle } from "./sim-candles.ts"

const bar = (i: number, c: number, v = 1, h = c, l = c): SimCandle => ({ t: i * 60000, o: c, h, l, c, v })

describe("chart indicators (sim)", () => {
  it("seeds EMA with the SMA and then smooths", () => {
    const cs = [1, 2, 3, 4, 5].map((c, i) => bar(i, c))
    const e = emaSeries(cs, 3)
    expect(e[0]).toBeNull()
    expect(e[1]).toBeNull()
    expect(e[2]).toBeCloseTo(2, 9)
    expect(e[3]).toBeCloseTo(3, 9) // 4*0.5 + 2*0.5
    expect(e[4]).toBeCloseTo(4, 9)
    expect(emaSeries(cs.slice(0, 2), 3).every((v) => v == null)).toBe(true)
    expect([EMA_FAST, EMA_SLOW]).toEqual([9, 21])
  })
  it("weights VWAP by volume on the typical price", () => {
    const cs = [bar(0, 10, 1, 11, 9), bar(1, 20, 3)]
    const w = vwapSeries(cs)
    expect(w[0]).toBeCloseTo(10, 9)
    expect(w[1]).toBeCloseTo((10 + 60) / 4, 9)
    expect(vwapSeries([bar(0, 5, 0)])[0]).toBeNull()
  })
  it("reads trend from price and the two EMAs", () => {
    expect(trendRead(11, 10.5, 10)).toBe("up")
    expect(trendRead(9, 9.5, 10)).toBe("down")
    expect(trendRead(10.2, 10.5, 10)).toBe("mixed")
    expect(trendRead(10, null, 10)).toBe("warming")
    expect(trendLabel("up")).toMatch(/sim/)
  })
  it("draws paths that break on gaps", () => {
    const d = seriesPaths([null, 1, 2, null, 3], (i) => i, (p) => p)
    expect(d).toBe("M 1.0 1.0 L 2.0 2.0 M 4.0 3.0")
  })
})
