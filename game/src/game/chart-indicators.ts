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

// ---------------------------------------------------------------- RSI (14) and the coach signal

export const RSI_LEN = 14
export const RSI_OVERBOUGHT = 70
export const RSI_OVERSOLD = 30

/**
 * Wilder RSI of the candle closes. The first value lands on index `period` (needs period + 1 closes), then
 * average gain/loss are smoothed the Wilder way. Entries before that are null. Sim candles only.
 */
export function rsiSeries(candles: readonly SimCandle[], period = RSI_LEN): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null)
  if (period < 1 || candles.length < period + 1) return out
  let gain = 0
  let loss = 0
  for (let i = 1; i <= period; i++) {
    const d = candles[i]!.c - candles[i - 1]!.c
    if (d >= 0) gain += d
    else loss -= d
  }
  let avgG = gain / period
  let avgL = loss / period
  const val = () => (avgL === 0 ? (avgG === 0 ? 50 : 100) : 100 - 100 / (1 + avgG / avgL))
  out[period] = val()
  for (let i = period + 1; i < candles.length; i++) {
    const d = candles[i]!.c - candles[i - 1]!.c
    avgG = (avgG * (period - 1) + (d > 0 ? d : 0)) / period
    avgL = (avgL * (period - 1) + (d < 0 ? -d : 0)) / period
    out[i] = val()
  }
  return out
}

export type RsiState = "oversold" | "overbought" | "neutral" | "warming"

export function rsiState(v: number | null | undefined): RsiState {
  if (v == null || !Number.isFinite(v)) return "warming"
  if (v <= RSI_OVERSOLD) return "oversold"
  if (v >= RSI_OVERBOUGHT) return "overbought"
  return "neutral"
}

/** The indicator numbers the desk, the rule-based coach and the Grok coach context all share. */
export interface IndicatorSnap {
  /** Timeframe id of the bars these were computed on, e.g. "5m". */
  tf: string
  last: number
  rsi: number | null
  emaFast: number | null
  emaSlow: number | null
}

export type SignalKind = "long" | "short" | "watch" | "neutral" | "warming"
export interface IndicatorSignal {
  kind: SignalKind
  /** One plain line for the coach, always labelled sim. Never advice. */
  text: string
}

const r0 = (v: number) => String(Math.round(v))
const px = (v: number) => v.toFixed(3)

/**
 * Plain-language signal from RSI 14 and EMA 9 / EMA 21 on the selected timeframe (sim only, not advice).
 * Oversold and price back above EMA 9: possible long. Overbought and price back below EMA 9: possible short.
 */
export function indicatorSignal(s: IndicatorSnap): IndicatorSignal {
  if (s.rsi == null || s.emaFast == null) return { kind: "warming", text: `Indicators warming up on ${s.tf} (sim): the chart needs a few more bars.` }
  const rsi = r0(s.rsi)
  const above = s.last > s.emaFast
  const state = rsiState(s.rsi)
  if (state === "oversold") {
    return above
      ? { kind: "long", text: `RSI ${rsi}, oversold, price back above EMA ${EMA_FAST} on ${s.tf}: possible long (sim).` }
      : { kind: "watch", text: `RSI ${rsi}, oversold, price still below EMA ${EMA_FAST} on ${s.tf}: wait for it to climb back above (sim).` }
  }
  if (state === "overbought") {
    return !above
      ? { kind: "short", text: `RSI ${rsi}, overbought, price back below EMA ${EMA_FAST} on ${s.tf}: possible short (sim).` }
      : { kind: "watch", text: `RSI ${rsi}, overbought, price still above EMA ${EMA_FAST} on ${s.tf}: stretched, so a tight stop helps (sim).` }
  }
  const trend = s.emaSlow == null ? "" : s.emaFast > s.emaSlow ? ", EMA 9 over EMA 21 (up-trend)" : s.emaFast < s.emaSlow ? ", EMA 9 under EMA 21 (down-trend)" : ""
  return { kind: "neutral", text: `RSI ${rsi}, neutral, price ${above ? "above" : "below"} EMA ${EMA_FAST} (${px(s.emaFast)}) on ${s.tf}${trend}: no signal (sim).` }
}
