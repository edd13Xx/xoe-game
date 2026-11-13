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

import { RSI_LEN, RSI_OVERBOUGHT, RSI_OVERSOLD, indicatorSignal, rsiSeries, rsiState } from "./chart-indicators.ts"

describe("RSI 14 on the selected timeframe (sim)", () => {
  const closes = (xs: number[]) => xs.map((c, i) => bar(i, c))
  it("needs period + 1 closes, then Wilder-smooths", () => {
    expect([RSI_LEN, RSI_OVERBOUGHT, RSI_OVERSOLD]).toEqual([14, 70, 30])
    expect(rsiSeries(closes(Array.from({ length: 14 }, (_, i) => 10 + i))).every((v) => v == null)).toBe(true)
    const up = rsiSeries(closes(Array.from({ length: 20 }, (_, i) => 10 + i * 0.1)))
    expect(up[13]).toBeNull()
    expect(up[14]).toBe(100)
    expect(up[19]).toBe(100)
    const down = rsiSeries(closes(Array.from({ length: 20 }, (_, i) => 20 - i * 0.1)))
    expect(down[14]).toBe(0)
    const flat = rsiSeries(closes(new Array(20).fill(10)))
    expect(flat[14]).toBe(50)
  })
  it("matches a hand-computed Wilder value", () => {
    // 15 closes: +1 then -1 alternating from 10, so first avg gain = 7/14, avg loss = 7/14 -> RSI 50, then one up bar of +2
    const xs = [10]
    for (let i = 0; i < 14; i++) xs.push(xs[xs.length - 1]! + (i % 2 === 0 ? 1 : -1))
    xs.push(xs[xs.length - 1]! + 2)
    const r = rsiSeries(closes(xs))
    expect(r[14]).toBeCloseTo(50, 9)
    const avg = 0.5
    const g = (avg * 13 + 2) / 14
    const l = (avg * 13) / 14
    expect(r[15]).toBeCloseTo(100 - 100 / (1 + g / l), 9)
  })
  it("classifies oversold, overbought and neutral", () => {
    expect(rsiState(28)).toBe("oversold")
    expect(rsiState(30)).toBe("oversold")
    expect(rsiState(70)).toBe("overbought")
    expect(rsiState(50)).toBe("neutral")
    expect(rsiState(null)).toBe("warming")
  })
  it("calls plain, sim-labelled signals from RSI and EMA 9", () => {
    const snap = { tf: "5m", last: 10.05, rsi: 28.4, emaFast: 10.0, emaSlow: 10.1 }
    expect(indicatorSignal(snap)).toEqual({ kind: "long", text: "RSI 28, oversold, price back above EMA 9 on 5m: possible long (sim)." })
    expect(indicatorSignal({ ...snap, last: 9.9 }).kind).toBe("watch")
    expect(indicatorSignal({ ...snap, rsi: 74, last: 9.9 }).text).toBe("RSI 74, overbought, price back below EMA 9 on 5m: possible short (sim).")
    expect(indicatorSignal({ ...snap, rsi: 74 }).kind).toBe("watch")
    const n = indicatorSignal({ ...snap, rsi: 52 })
    expect(n.kind).toBe("neutral")
    expect(n.text).toMatch(/no signal \(sim\)/)
    expect(indicatorSignal({ ...snap, rsi: null }).kind).toBe("warming")
    for (const s of [snap, { ...snap, rsi: 74 }, { ...snap, rsi: 52 }]) expect(indicatorSignal(s).text).not.toMatch(/\$/)
  })
})
