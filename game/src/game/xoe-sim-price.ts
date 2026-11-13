/**
 * XOE/USD sim ticker (v16, game only). Floats around the locked $10.00 sim anchor.
 * Driven by live XLM-USD step % (Coinbase public, no keys) plus small noise.
 * Offline: a smooth random walk. Always labeled sim — never a real market price.
 * Keep this number inside the game only; never use it in promo or the white paper.
 */
import { SIM_USD_PER_XOE } from "./economy.ts"
import type { TickerQuote } from "./live-ticker.ts"

export const XOE_SIM_SYMBOL = "XOE"
export const XOE_SIM_PAIR = "XOE-USD"
export const XOE_SIM_ANCHOR = SIM_USD_PER_XOE
export const XOE_SIM_MIN = 5
export const XOE_SIM_MAX = 20
/** About every 1.5s, inside the 1–2s brief. */
export const XOE_SIM_TICK_MS = 1200
export const XOE_SIM_LABEL = "sim price · testnet · not a real market"
export const XOE_SIM_SAFETY = "Testnet XOE · no real money"
/** Dampen XLM's live move so XOE stays near the $10 anchor. */
export const XOE_XLM_SCALE = 0.5
export const XOE_NOISE_PCT = 0.35
export const XOE_REVERT = 0.035
export const XOE_WALK_NOISE_PCT = 0.5

export type PriceRegime = "trend-up" | "trend-down" | "range"

export type XoeSimState = {
  price: number
  open24h: number
  updatedAt: number
  liveXlm: boolean
  /** Trending or ranging — visual/sim path only; clamp and anchor stay locked. */
  regime: PriceRegime
  regimeLeft: number
  /** Volatility multiplier for clustering (1 = baseline). */
  vol: number
  wickHigh: number
  wickLow: number
  volume: number
}

export function clampXoeSimPrice(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return XOE_SIM_ANCHOR
  if (n < XOE_SIM_MIN) return XOE_SIM_MIN
  if (n > XOE_SIM_MAX) return XOE_SIM_MAX
  return n
}

export function xoeChangePct(price: number, open: number): number | null {
  if (!(price > 0) || !(open > 0)) return null
  return ((price - open) / open) * 100
}

/**
 * One tick. `xlmStepPct` is the XLM move since the last snapshot (percent).
 * `noise` is typically rng()-0.5 (about -0.5..0.5). Offline: omit xlmStepPct.
 */
export function stepXoeSimPrice(
  price: number,
  opts: {
    xlmStepPct?: number | null
    noise?: number
    offline?: boolean
    regime?: PriceRegime
    vol?: number
    spike?: number
  } = {},
): number {
  const cur = clampXoeSimPrice(price)
  const vol = opts.vol != null && Number.isFinite(opts.vol) ? Math.max(0.35, opts.vol) : 1
  const noiseAmp = (opts.offline ? XOE_WALK_NOISE_PCT : XOE_NOISE_PCT) * vol
  const noise = (opts.noise ?? 0) * 2 * noiseAmp
  const drive = (opts.xlmStepPct ?? 0) * XOE_XLM_SCALE
  const trend = opts.regime === "trend-up" ? 0.12 : opts.regime === "trend-down" ? -0.12 : 0
  const revertK = opts.regime === "trend-up" || opts.regime === "trend-down" ? XOE_REVERT * 0.45 : XOE_REVERT
  const revert = (XOE_SIM_ANCHOR - cur) * revertK
  const spike = opts.spike ?? 0
  return clampXoeSimPrice(cur * (1 + (drive + noise + trend + spike) / 100) + revert)
}

function fract(n: number): number {
  return n - Math.floor(n)
}

function advanceRegime(prev: XoeSimState, u: number): { regime: PriceRegime; regimeLeft: number; vol: number; spike: number } {
  let regime = prev.regime
  let regimeLeft = prev.regimeLeft - 1
  let vol = prev.vol
  if (!regime || !Number.isFinite(regimeLeft) || regimeLeft <= 0) {
    const r = fract(u * 7.13 + prev.price * 0.01)
    regime = r < 0.34 ? "trend-up" : r < 0.68 ? "trend-down" : "range"
    regimeLeft = 24 + Math.floor(fract(u * 13.7 + prev.price) * 52)
  }
  vol = Math.min(3.2, Math.max(0.45, (Number.isFinite(vol) ? vol : 1) * 0.94 + (u - 0.5) * 0.35))
  if (fract(u * 19.1 + prev.price) < 0.06) vol = Math.min(3.2, vol + 0.85)
  const spikeChance = 0.03
  const spike = fract(u * 23.9 + prev.updatedAt) < spikeChance ? (u - 0.5) * 2 * 1.8 : 0
  return { regime, regimeLeft, vol, spike }
}

export function initialXoeSim(now = 0, price = XOE_SIM_ANCHOR): XoeSimState {
  const p = clampXoeSimPrice(price)
  return {
    price: p,
    open24h: p,
    updatedAt: now,
    liveXlm: false,
    regime: "range",
    regimeLeft: 36,
    vol: 1,
    wickHigh: p,
    wickLow: p,
    volume: 12,
  }
}

export function tickXoeSim(
  state: XoeSimState | null,
  opts: { xlmStepPct?: number | null; noise?: number; offline?: boolean; liveXlm?: boolean; now?: number },
): XoeSimState {
  const prev = state ?? initialXoeSim(opts.now)
  const u = Math.min(1, Math.max(0, (opts.noise ?? 0) + 0.5))
  const path = advanceRegime(
    {
      ...initialXoeSim(prev.updatedAt, prev.price),
      ...prev,
      regime: prev.regime ?? "range",
      regimeLeft: Number.isFinite(prev.regimeLeft) ? prev.regimeLeft : 0,
      vol: Number.isFinite(prev.vol) ? prev.vol : 1,
    },
    u,
  )
  const price = stepXoeSimPrice(prev.price, { ...opts, regime: path.regime, vol: path.vol, spike: path.spike })
  const open24h = prev.open24h > 0 ? prev.open24h : price
  const mid = (prev.price + price) / 2
  const wickSpan = Math.abs(price - prev.price) + mid * 0.0018 * path.vol * (0.35 + fract(u * 5.2))
  const wickHigh = clampXoeSimPrice(Math.max(prev.price, price) + wickSpan * fract(u * 3.2 + 0.1))
  const wickLow = clampXoeSimPrice(Math.min(prev.price, price) - wickSpan * fract(u * 4.1 + 0.2))
  const volume = 8 + path.vol * 18 * (1 + (Math.abs(price - prev.price) / Math.max(prev.price, 1)) * 48)
  return {
    price,
    open24h,
    updatedAt: opts.now ?? prev.updatedAt,
    liveXlm: opts.liveXlm === true,
    regime: path.regime,
    regimeLeft: path.regimeLeft,
    vol: path.vol,
    wickHigh: Math.max(wickHigh, price, prev.price),
    wickLow: Math.min(wickLow, price, prev.price),
    volume,
  }
}

export function xoeSimQuote(state: XoeSimState, prevPrice?: number): TickerQuote {
  return {
    pair: XOE_SIM_PAIR as TickerQuote["pair"],
    symbol: XOE_SIM_SYMBOL,
    priceUsd: state.price,
    change24hPct: xoeChangePct(state.price, state.open24h),
    stepPct: xoeChangePct(state.price, prevPrice ?? state.price),
    open24h: state.open24h,
    updatedAt: state.updatedAt,
  }
}


/** Three decimals so a live tick ($10.053 → $9.971) is obvious on the HUD. */
export function formatXoeTickPrice(n: number): string {
  return clampXoeSimPrice(n).toFixed(3)
}

/** Smooth display price toward the latest tick (0..1 t). */
export function lerpPrice(from: number, to: number, t: number): number {
  const a = clampXoeSimPrice(from)
  const b = clampXoeSimPrice(to)
  const k = t <= 0 ? 0 : t >= 1 ? 1 : t
  return a + (b - a) * k
}
