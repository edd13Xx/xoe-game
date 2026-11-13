/**
 * Seeded sim candles and a synthetic depth/tape for the SNL paper desk.
 * Built only from the XOE/USD sim path — no network, no exchange feeds.
 */
import { seededRng } from "./ticker-play.ts"
import { XOE_SIM_ANCHOR, XOE_SIM_TICK_MS, clampXoeSimPrice, stepXoeSimPrice, type PriceRegime } from "./xoe-sim-price.ts"

export type CandleInterval = "1m" | "5m"

export const CANDLE_INTERVAL_MS: Record<CandleInterval, number> = {
  "1m": 60_000,
  "5m": 300_000,
}

export interface SimCandle {
  t: number
  o: number
  h: number
  l: number
  c: number
  v: number
}

export interface DepthLevel {
  price: number
  size: number
  side: "bid" | "ask"
}

export interface TapePrint {
  price: number
  size: number
  side: "buy" | "sell"
  at: number
  player?: boolean
}

export function intervalMs(interval: CandleInterval): number {
  return CANDLE_INTERVAL_MS[interval]
}

export function ticksPerBar(interval: CandleInterval, tickMs = XOE_SIM_TICK_MS): number {
  return Math.max(1, Math.round(intervalMs(interval) / tickMs))
}

/** Backward seeded walk that ends exactly on `endPrice`, for a stable live-history junction. */
export function seededPathEndingAt(seed: number, count: number, endPrice: number): number[] {
  const rng = seededRng(seed >>> 0 || 1)
  const end = clampXoeSimPrice(endPrice)
  const prices = new Array<number>(Math.max(1, count))
  prices[prices.length - 1] = end
  let p = end
  let regime: PriceRegime = "range"
  let left = 0
  let vol = 1
  for (let i = prices.length - 2; i >= 0; i--) {
    const u = rng()
    left -= 1
    if (left <= 0) {
      regime = u < 0.34 ? "trend-up" : u < 0.68 ? "trend-down" : "range"
      left = 24 + Math.floor(rng() * 52)
    }
    vol = Math.min(3.2, Math.max(0.45, vol * 0.94 + (u - 0.5) * 0.35))
    if (rng() < 0.06) vol = Math.min(3.2, vol + 0.85)
    const spike = rng() < 0.03 ? (rng() - 0.5) * 2 * 1.8 : 0
    // Invert a forward step roughly by stepping from p with opposite drive, then we'll just walk backward
    // by applying a forward-style step and using it as the previous close.
    const next = stepXoeSimPrice(p, {
      noise: u - 0.5,
      offline: true,
      regime: regime === "trend-up" ? "trend-down" : regime === "trend-down" ? "trend-up" : "range",
      vol,
      spike: -spike,
    })
    p = next
    prices[i] = p
  }
  prices[prices.length - 1] = end
  return prices
}

export function candlesFromCloses(
  prices: readonly number[],
  interval: CandleInterval,
  opts: { tickMs?: number; origin?: number; seed?: number } = {},
): SimCandle[] {
  if (prices.length === 0) return []
  const n = ticksPerBar(interval, opts.tickMs ?? XOE_SIM_TICK_MS)
  const origin = opts.origin ?? 0
  const rng = seededRng((opts.seed ?? 1) >>> 0 || 1)
  const out: SimCandle[] = []
  for (let i = 0; i < prices.length; i += n) {
    const slice = prices.slice(i, i + n)
    const o = clampXoeSimPrice(slice[0]!)
    const c = clampXoeSimPrice(slice[slice.length - 1]!)
    let h = Math.max(...slice)
    let l = Math.min(...slice)
    // Intra-bar wicks already come from ticks; add a tiny seeded wick so sparse bars still look like candles.
    if (slice.length < 4) {
      const pad = Math.max(o, c) * (0.0008 + rng() * 0.0015)
      h = Math.max(h, o, c) + pad
      l = Math.min(l, o, c) - pad
    }
    const range = Math.abs(c - o) + (h - l)
    const v = 10 + range * 80 + rng() * 8
    out.push({
      t: origin + i * (opts.tickMs ?? XOE_SIM_TICK_MS),
      o,
      h: clampXoeSimPrice(h),
      l: clampXoeSimPrice(l),
      c,
      v: +v.toFixed(3),
    })
  }
  return out
}

export function terminalCandles(
  live: readonly number[],
  interval: CandleInterval,
  opts: { price?: number; seed?: number; historyTicks?: number } = {},
): SimCandle[] {
  const last = live.at(-1) ?? opts.price ?? XOE_SIM_ANCHOR
  const junction = live[0] ?? last
  const warmup = opts.historyTicks ?? ticksPerBar(interval) * 48
  const seed = opts.seed ?? 20261111
  const prefix = seededPathEndingAt(seed, warmup, junction)
  const path = live.length > 1 ? [...prefix, ...live.slice(1)] : [...prefix, last]
  return candlesFromCloses(path, interval, { seed: seed + 17 })
}

export function buildSimDepth(mid: number, seed = 1, levels = 8): { bids: DepthLevel[]; asks: DepthLevel[]; spread: number } {
  const p = clampXoeSimPrice(mid)
  const rng = seededRng((seed + Math.round(p * 1000)) >>> 0 || 1)
  const step = Math.max(0.001, +(p * 0.0006).toFixed(4))
  const bids: DepthLevel[] = []
  const asks: DepthLevel[] = []
  for (let i = 1; i <= levels; i++) {
    bids.push({
      price: +clampXoeSimPrice(p - step * i).toFixed(3),
      size: +(0.4 + i * 0.18 + rng() * 0.35).toFixed(2),
      side: "bid",
    })
    asks.push({
      price: +clampXoeSimPrice(p + step * i).toFixed(3),
      size: +(0.35 + i * 0.16 + rng() * 0.35).toFixed(2),
      side: "ask",
    })
  }
  const spread = asks[0]!.price - bids[0]!.price
  return { bids, asks, spread }
}

export function buildSimTape(
  mid: number,
  seed = 1,
  fills: readonly TapePrint[] = [],
  count = 12,
): TapePrint[] {
  const p = clampXoeSimPrice(mid)
  const rng = seededRng((seed + Math.round(p * 200)) >>> 0 || 1)
  const sim: TapePrint[] = []
  for (let i = 0; i < count; i++) {
    const drift = (rng() - 0.5) * p * 0.002
    sim.push({
      price: +clampXoeSimPrice(p + drift).toFixed(3),
      size: +(0.1 + rng() * 1.2).toFixed(2),
      side: rng() < 0.5 ? "buy" : "sell",
      at: count - i,
    })
  }
  return [...fills.slice(0, 8), ...sim].slice(0, count + fills.length)
}
