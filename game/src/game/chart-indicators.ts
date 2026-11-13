/**
 * Chart overlays for the XOE trade desk: EMA 9, EMA 21 and session VWAP, plus a
 * plain trend read. Computed only from the local sim candles. Not a live market
 * indicator and not financial advice.
 */
import type { SimCandle } from "./sim-candles.ts"

export const EMA_FAST = 9
export const EMA_SLOW = 21

/** Exponential moving average of closes, seeded with the SMA of the first `period` closes. Entries before the seed are null. */
export function emaSeries(candles: readonly SimCandle[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null)
  if (period < 1 || candles.length < period) return out
  let sum = 0
  for (let i = 0; i < period; i++) sum += candles[i]!.c
  let ema = sum / period
  out[period - 1] = ema
  const k = 2 / (period + 1)
  for (let i = period; i < candles.length; i++) {
    ema = candles[i]!.c * k + ema * (1 - k)
    out[i] = ema
  }
  return out
}

/** Volume-weighted average price over the shown candles, using the typical price (H+L+C)/3. */
export function vwapSeries(candles: readonly SimCandle[]): (number | null)[] {
  let pv = 0
  let vol = 0
  return candles.map((c) => {
    const v = Math.max(0, c.v)
    pv += ((c.h + c.l + c.c) / 3) * v
    vol += v
    return vol > 0 ? pv / vol : null
  })
}

export type TrendRead = "up" | "down" | "mixed" | "warming"

/** Price above both lines with EMA 9 over EMA 21 reads up; the mirror reads down; anything else is mixed. */
export function trendRead(last: number | null | undefined, fast: number | null | undefined, slow: number | null | undefined): TrendRead {
  if (last == null || fast == null || slow == null) return "warming"
  if (fast > slow && last >= fast) return "up"
  if (fast < slow && last <= fast) return "down"
  return "mixed"
}

export function trendLabel(t: TrendRead): string {
  switch (t) {
    case "up":
      return "Trend up (sim)"
    case "down":
      return "Trend down (sim)"
    case "mixed":
      return "Trend mixed (sim)"
    default:
      return "Trend warming up (sim)"
  }
}

/** SVG polyline points for a series, skipping nulls (breaks the line into segments). */
export function seriesPaths(series: readonly (number | null)[], x: (i: number) => number, y: (p: number) => number): string {
  let d = ""
  let pen = false
  series.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) {
      pen = false
      return
    }
    d += `${pen ? " L" : d ? " M" : "M"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`
    pen = true
  })
  return d
}
