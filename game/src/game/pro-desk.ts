/**
 * Pure helpers for the pro-style XOE trade desk (sim only, testnet XOE, no real money).
 * Candles, 24h stats, the live book, the tape and the order mapping are all built from the
 * XOE/USD sim price. No network, no real market data. Orders run on the existing SNL paper book.
 */
import { indicatorSignal, rsiState, type IndicatorSnap } from "./chart-indicators.ts"
import {
  BOOK_DEPTH,
  BOOK_TICK_MS,
  bookLevelKey,
  buildSyntheticBook,
  hashUnit,
  type BookLevel,
} from "./paper-advanced.ts"
import { SNL_LOT, SNL_FEE_TAKER, type SnlAction, type SnlBook, type SnlFill } from "./snl-listing.ts"
import { XOE_SIM_ANCHOR, XOE_SIM_MAX, XOE_SIM_MIN, clampXoeSimPrice } from "./xoe-sim-price.ts"
import { seededRng } from "./ticker-play.ts"
import type { SimCandle } from "./sim-candles.ts"

export const PRO_DESK_LABEL = "Sim · testnet XOE · no real money"
export const PRO_PAIR = "XOE/USD"
/** "1mo" is the monthly chart (shown as 1M); "1m" is one minute. */
export type ProTimeframe = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1D" | "1W" | "1mo"
export const PRO_TIMEFRAMES: readonly ProTimeframe[] = ["1m", "5m", "15m", "30m", "1h", "4h", "1D", "1W", "1mo"]
export const MINUTE_MS = 60_000
/** Fixed-length frames in minutes. Weekly and monthly are calendar-aligned (see periodStart). */
export const TF_MINUTES: Record<Exclude<ProTimeframe, "1W" | "1mo">, number> = { "1m": 1, "5m": 5, "15m": 15, "30m": 30, "1h": 60, "4h": 240, "1D": 1440 }
/** Button text and screen-reader name per timeframe. */
export const TF_LABEL: Record<ProTimeframe, { text: string; name: string }> = {
  "1m": { text: "1m", name: "1 minute" },
  "5m": { text: "5m", name: "5 minutes" },
  "15m": { text: "15m", name: "15 minutes" },
  "30m": { text: "30m", name: "30 minutes" },
  "1h": { text: "1h", name: "1 hour" },
  "4h": { text: "4h", name: "4 hours" },
  "1D": { text: "1D", name: "1 day" },
  "1W": { text: "1W", name: "1 week" },
  "1mo": { text: "1M", name: "1 month" },
}
/** Bars kept on screen per timeframe. */
export const TF_VISIBLE: Record<ProTimeframe, number> = { "1m": 64, "5m": 64, "15m": 64, "30m": 64, "1h": 72, "4h": 64, "1D": 64, "1W": 52, "1mo": 36 }

/** Start (ms, UTC) of the `tf` period containing `t`. Weeks start Monday 00:00 UTC, months on the 1st. */
export function periodStart(t: number, tf: ProTimeframe): number {
  if (tf === "1mo") {
    const d = new Date(t)
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
  }
  if (tf === "1W") {
    const day = Math.floor(t / 86_400_000)
    const dow = (day + 3) % 7 // 1970-01-01 was a Thursday; Monday = 0
    return (day - dow) * 86_400_000
  }
  const span = TF_MINUTES[tf] * MINUTE_MS
  return Math.floor(t / span) * span
}

/** Start of the period before the one beginning at `start`. */
function prevPeriodStart(start: number, tf: ProTimeframe): number {
  if (tf === "1mo") {
    const d = new Date(start)
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)
  }
  if (tf === "1W") return start - 7 * 86_400_000
  return start - TF_MINUTES[tf] * MINUTE_MS
}
/** Minutes of seeded history kept (3 days, so the 1h chart has 72 bars). */
export const SEED_MINUTES = 4320
export const BOOK_STEPS: readonly number[] = [0.01, 0.05, 0.1]

/** Seeded minute bars ending exactly on `endPrice` at the minute before `endT` (a backward walk). */
export function seedMinuteBars(endPrice: number, endT: number, count = SEED_MINUTES, seed = 20261112): SimCandle[] {
  const rng = seededRng(seed)
  const n = Math.max(2, count)
  const lo = XOE_SIM_MIN + 0.5
  const hi = XOE_SIM_MAX - 1
  const closes = new Array<number>(n)
  closes[n - 1] = Math.min(hi, Math.max(lo, endPrice))
  // The XOE sim swings a few percent a minute around its $10 anchor (mean reverting), so the
  // seeded history is an AR(1) path around the anchor with the same feel.
  const phi = 0.8
  const sigma = 0.04
  let x = closes[n - 1]! / XOE_SIM_ANCHOR - 1
  let vol = 1
  for (let i = n - 2; i >= 0; i--) {
    vol = Math.min(1.6, Math.max(0.6, vol * 0.97 + (rng() - 0.5) * 0.16))
    const e = (rng() + rng() - 1) * Math.sqrt(6)
    x = phi * x + e * sigma * Math.sqrt(1 - phi * phi) * vol
    closes[i] = Math.min(hi, Math.max(lo, XOE_SIM_ANCHOR * (1 + x)))
  }
  const bars: SimCandle[] = []
  for (let i = 0; i < n; i++) {
    const c = closes[i]!
    const o = i === 0 ? c * (1 + (rng() - 0.5) * 0.02) : closes[i - 1]!
    const wickU = Math.max(o, c) * rng() * 0.007 * vol
    const wickD = Math.min(o, c) * rng() * 0.007 * vol
    const move = Math.abs(c - o) / Math.max(o, 1e-6)
    bars.push({
      t: endT - (n - i) * MINUTE_MS,
      o,
      h: Math.max(o, c) + wickU,
      l: Math.min(o, c) - wickD,
      c,
      v: +(5 + move * 600 + rng() * 14).toFixed(2),
    })
  }
  return bars
}

/** Move the live minute bar to `price` at `now` (opens a new bar on a new minute). Returns a new array. */
export function advanceLiveBars(bars: readonly SimCandle[], price: number, now: number): SimCandle[] {
  const p = clampXoeSimPrice(price)
  const t = Math.floor(now / MINUTE_MS) * MINUTE_MS
  const last = bars[bars.length - 1]
  if (!last) return [{ t, o: p, h: p, l: p, c: p, v: 1 }]
  const bump = 0.02 + (Math.abs(p - last.c) / Math.max(p, 1e-6)) * 60
  if (last.t >= t) {
    const next: SimCandle = { ...last, c: p, h: Math.max(last.h, p), l: Math.min(last.l, p), v: +(last.v + bump).toFixed(2) }
    return [...bars.slice(0, -1), next]
  }
  const o = last.c
  const fresh: SimCandle = { t, o, h: Math.max(o, p), l: Math.min(o, p), c: p, v: +bump.toFixed(2) }
  return [...bars, fresh].slice(-SEED_MINUTES)
}

/** Group minute bars into `tf` bars (aligned to the clock / calendar, UTC). */
export function aggregateBars(bars: readonly SimCandle[], tf: ProTimeframe): SimCandle[] {
  if (tf === "1m") return bars.slice()
  const out: SimCandle[] = []
  for (const b of bars) {
    const t = periodStart(b.t, tf)
    const cur = out[out.length - 1]
    if (cur && cur.t === t) {
      cur.h = Math.max(cur.h, b.h)
      cur.l = Math.min(cur.l, b.l)
      cur.c = b.c
      cur.v = +(cur.v + b.v).toFixed(2)
    } else {
      out.push({ ...b, t })
    }
  }
  return out
}

/** Frames whose chart needs older history than the seeded minute window provides. */
const NEEDS_HISTORY: ReadonlySet<ProTimeframe> = new Set<ProTimeframe>(["4h", "1D", "1W", "1mo"])
const HISTORY_SEED: Record<string, number> = { "4h": 41, "1D": 42, "1W": 43, "1mo": 44 }

/**
 * Seeded coarse history for the long frames (4h, 1D, 1W, 1M): `count` bars that end exactly at `endPrice`
 * in the period just before `firstT`. Same mean-reverting XOE sim feel as the minute seed, with a wider swing
 * per bar. Deterministic per frame, no network. Sim only.
 */
export function seedHistoryBars(tf: ProTimeframe, endPrice: number, firstT: number, count = 64): SimCandle[] {
  if (!NEEDS_HISTORY.has(tf)) return []
  const rng = seededRng(HISTORY_SEED[tf]!)
  const n = Math.max(2, count)
  const lo = XOE_SIM_MIN + 0.5
  const hi = XOE_SIM_MAX - 1
  const approxMin = tf === "1mo" ? 43_200 : tf === "1W" ? 10_080 : TF_MINUTES[tf as "4h" | "1D"]
  const sigma = Math.min(0.2, 0.04 * Math.sqrt(approxMin / 60))
  const phi = 0.75
  const closes = new Array<number>(n)
  closes[n - 1] = Math.min(hi, Math.max(lo, endPrice))
  let x = closes[n - 1]! / XOE_SIM_ANCHOR - 1
  for (let i = n - 2; i >= 0; i--) {
    const e = (rng() + rng() - 1) * Math.sqrt(6)
    x = phi * x + e * sigma * Math.sqrt(1 - phi * phi)
    closes[i] = Math.min(hi, Math.max(lo, XOE_SIM_ANCHOR * (1 + x)))
  }
  const starts = new Array<number>(n)
  let st = prevPeriodStart(periodStart(firstT, tf), tf)
  for (let i = n - 1; i >= 0; i--) {
    starts[i] = st
    st = prevPeriodStart(st, tf)
  }
  const bars: SimCandle[] = []
  for (let i = 0; i < n; i++) {
    const c = closes[i]!
    const o = i === 0 ? c * (1 + (rng() - 0.5) * 0.02) : closes[i - 1]!
    const wick = sigma * 0.35
    bars.push({
      t: starts[i]!,
      o,
      h: Math.max(o, c) * (1 + rng() * wick),
      l: Math.min(o, c) * (1 - rng() * wick),
      c,
      v: +((5 + (Math.abs(c - o) / Math.max(o, 1e-6)) * 600 + rng() * 14) * (approxMin / 5)).toFixed(2),
    })
  }
  return bars
}

/**
 * Candles for `tf`: the minute bars aggregated, with the seeded coarse history in front for the long frames.
 * `history` comes from seedHistoryBars (kept by the caller so it stays stable between price ticks).
 */
export function chartBars(minuteBars: readonly SimCandle[], tf: ProTimeframe, history: readonly SimCandle[] = []): SimCandle[] {
  const agg = aggregateBars(minuteBars, tf)
  const first = agg[0]
  if (!first || history.length === 0) return agg
  return [...history.filter((h) => h.t < first.t), ...agg]
}

export interface Stats24 {
  last: number
  open: number
  high: number
  low: number
  volume: number
  changePct: number
}

export function stats24h(bars: readonly SimCandle[]): Stats24 {
  const slice = bars.slice(-1440)
  const first = slice[0]
  const last = slice[slice.length - 1]
  if (!first || !last) return { last: XOE_SIM_ANCHOR, open: XOE_SIM_ANCHOR, high: XOE_SIM_ANCHOR, low: XOE_SIM_ANCHOR, volume: 0, changePct: 0 }
  let high = -Infinity
  let low = Infinity
  let volume = 0
  for (const b of slice) {
    if (b.h > high) high = b.h
    if (b.l < low) low = b.l
    volume += b.v
  }
  return { last: last.c, open: first.o, high, low, volume, changePct: first.o > 0 ? ((last.c - first.o) / first.o) * 100 : 0 }
}

export interface ProBook {
  bids: BookLevel[]
  asks: BookLevel[]
  spread: number
  changed: string[]
}

/** The live sim book centred on the real sim price. `changed` lists levels whose size moved. */
export function nextProBook(prev: ProBook | null, price: number, step: number, tick: number): ProBook {
  const book = buildSyntheticBook(clampXoeSimPrice(price), step, tick)
  const before = new Map<string, number>()
  for (const l of [...(prev?.bids ?? []), ...(prev?.asks ?? [])]) before.set(bookLevelKey(l), l.size)
  const changed: string[] = []
  for (const l of [...book.bids, ...book.asks]) {
    const was = before.get(bookLevelKey(l))
    if (was != null && was !== l.size) changed.push(bookLevelKey(l))
  }
  return { ...book, changed }
}

export interface ProTrade {
  id: string
  price: number
  size: number
  side: "buy" | "sell"
  at: number
}

/** 0–3 seeded prints for one book tick, near the current price. */
export function tradesForTick(price: number, step: number, tick: number): ProTrade[] {
  const n = Math.floor(hashUnit(tick, 41) * 4)
  const out: ProTrade[] = []
  for (let j = 0; j < n; j++) {
    const off = (hashUnit(tick, j, 43) - 0.5) * step * 3
    const u = hashUnit(tick, j, 47)
    out.push({
      id: `t${tick}-${j}`,
      price: +clampXoeSimPrice(price + off).toFixed(3),
      size: +(0.02 + u * u * 1.2).toFixed(3),
      side: hashUnit(tick, j, 53) < 0.5 ? "buy" : "sell",
      at: tick * BOOK_TICK_MS + j * 300,
    })
  }
  return out
}

export function seedTape(price: number, step: number, tick: number, ticks = 24): ProTrade[] {
  const out: ProTrade[] = []
  for (let t = tick - ticks; t <= tick; t++) out.unshift(...tradesForTick(price, step, t).reverse())
  return out.slice(0, 40)
}

export function stepTape(prev: readonly ProTrade[], price: number, step: number, tick: number): ProTrade[] {
  const fresh = tradesForTick(price, step, tick).reverse()
  if (fresh.length === 0) return prev as ProTrade[]
  return [...fresh, ...prev].slice(0, 40)
}

export interface DepthPoint {
  price: number
  cum: number
}

/** Cumulative depth curves, bids from best bid down, asks from best ask up. */
export function depthSeries(bids: readonly BookLevel[], asks: readonly BookLevel[]): { bids: DepthPoint[]; asks: DepthPoint[]; maxCum: number } {
  let c = 0
  const b = bids.slice(0, BOOK_DEPTH).map((l) => ({ price: l.price, cum: (c += l.size) }))
  c = 0
  const a = asks.slice(0, BOOK_DEPTH).map((l) => ({ price: l.price, cum: (c += l.size) }))
  return { bids: b, asks: a, maxCum: Math.max(b[b.length - 1]?.cum ?? 0, a[a.length - 1]?.cum ?? 0, 1e-9) }
}

// ---- Order form -> SNL paper book ------------------------------------------------------

export type DeskSide = "buy" | "sell"

/** Buy covers a short, otherwise opens/adds a long. Sell closes a long, otherwise opens/adds a short. */
export function deskAction(side: DeskSide, book: Pick<SnlBook, "side">): SnlAction {
  if (side === "buy") return book.side === "short" ? "cover" : "long"
  return book.side === "long" ? "close" : "short"
}

export function describeAction(action: SnlAction): string {
  switch (action) {
    case "long":
      return "Opens or adds to a sim long"
    case "cover":
      return "Buys back (covers) your sim short"
    case "close":
      return "Sells (closes) your sim long"
    case "short":
      return "Opens or adds to a sim short"
    default:
      return "Reverses the position"
  }
}

export function lotsFromAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  return Math.max(1, Math.min(200, Math.round(amount / SNL_LOT)))
}

export function amountFromLots(lots: number): number {
  return +(lots * SNL_LOT).toFixed(2)
}

/** Most lots one order of this side can use right now (sim cash or the open position). */
export function maxLotsFor(side: DeskSide, book: Pick<SnlBook, "side" | "lots" | "cash">, price: number): number {
  const p = clampXoeSimPrice(price)
  const action = deskAction(side, book)
  if (action === "close" || action === "cover") return Math.max(0, book.lots)
  const perLot = SNL_LOT * p
  const lots = Math.floor(book.cash / (perLot * (1 + SNL_FEE_TAKER)) + 1e-9) - book.lots
  return Math.max(0, Math.min(200, lots))
}

export function pctLots(max: number, pct: number): number {
  if (max <= 0) return 0
  return Math.max(1, Math.min(max, Math.floor(max * (pct / 100) + 1e-9)))
}

/** Why a limit price is not allowed (a resting buy must sit below the market, a sell above). */
export function limitProblem(side: DeskSide, limit: number | null, mark: number): string | null {
  if (limit == null || !(limit > 0)) return "Enter a limit price."
  if (side === "buy" && limit >= mark) return "A limit buy must be below the market price. Use Market to buy now."
  if (side === "sell" && limit <= mark) return "A limit sell must be above the market price. Use Market to sell now."
  return null
}

/**
 * Why a stop (breakout) entry trigger is not allowed. A buy stop waits above the market and
 * a sell stop below it; when XOE trades through the trigger it fills as a sim order. Paper only.
 */
export function stopProblem(side: DeskSide, trigger: number | null, mark: number): string | null {
  if (trigger == null || !(trigger > 0)) return "Enter a stop trigger price."
  if (side === "buy" && trigger <= mark) return "A buy stop must be above the market price. Use Limit to buy lower."
  if (side === "sell" && trigger >= mark) return "A sell stop must be below the market price. Use Limit to sell higher."
  return null
}

/** Sim ticker numbers are plain numbers on the desk: no dollar signs (builder rule). */
export const noDollar = (s: string): string => s.replace(/\$/g, "")

export function fmtPx(n: number): string {
  return n.toFixed(3)
}

export function fmtVol(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toFixed(1)
}

/**
 * Check a take-profit / stop-loss pair for a position side against the reference price
 * (entry or mark). Returns a plain-language problem, or null when the bracket makes sense.
 */
export function bracketProblem(pos: "long" | "short", ref: number, tp: number | null, sl: number | null): string | null {
  if (tp == null && sl == null) return null
  if (pos === "long") {
    if (tp != null && tp <= ref) return "Take profit on a long must be above the price."
    if (sl != null && sl >= ref) return "Stop loss on a long must be below the price."
  } else {
    if (tp != null && tp >= ref) return "Take profit on a short must be below the price."
    if (sl != null && sl <= ref) return "Stop loss on a short must be above the price."
  }
  return null
}

/** Parse an optional price box: blank means "not set". */
export function optionalPx(txt: string): number | null | "bad" {
  const t = txt.trim()
  if (t === "") return null
  const n = Number(t)
  return Number.isFinite(n) && n > 0 ? n : "bad"
}

/** Trade journal stats from SNL paper fills (sim only). A "trade" is each close or cover fill. */
export interface PnlStats {
  trades: number
  wins: number
  losses: number
  winRate: number | null
  avgWin: number | null
  avgLoss: number | null
  best: number | null
  worst: number | null
  profitFactor: number | null
  grossRealized: number
  feesPaid: number
  net: number
  maxDrawdown: number
  /** Running net P/L after each fill, oldest first, starting at 0. */
  curve: number[]
}

export function fillNet(f: Pick<SnlFill, "action" | "realized" | "fee">): number | null {
  return f.action === "close" || f.action === "cover" ? f.realized - f.fee : null
}

export function pnlStats(fills: readonly SnlFill[]): PnlStats {
  const ordered = [...fills].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
  let gross = 0
  let fees = 0
  let peak = 0
  let maxDd = 0
  const curve = [0]
  const nets: number[] = []
  for (const f of ordered) {
    gross += f.realized
    fees += f.fee
    const run = gross - fees
    curve.push(run)
    peak = Math.max(peak, run)
    maxDd = Math.max(maxDd, peak - run)
    const n = fillNet(f)
    if (n != null) nets.push(n)
  }
  const winsArr = nets.filter((n) => n > 0)
  const lossArr = nets.filter((n) => n <= 0)
  const sum = (a: number[]) => a.reduce((s, x) => s + x, 0)
  const gw = sum(winsArr)
  const gl = -sum(lossArr)
  return {
    trades: nets.length,
    wins: winsArr.length,
    losses: lossArr.length,
    winRate: nets.length ? winsArr.length / nets.length : null,
    avgWin: winsArr.length ? gw / winsArr.length : null,
    avgLoss: lossArr.length ? -gl / lossArr.length : null,
    best: nets.length ? Math.max(...nets) : null,
    worst: nets.length ? Math.min(...nets) : null,
    profitFactor: gl > 1e-12 ? gw / gl : winsArr.length ? Infinity : null,
    grossRealized: gross,
    feesPaid: fees,
    net: gross - fees,
    maxDrawdown: maxDd,
    curve,
  }
}

export type BracketGauge = {
  /** 0 = at stop loss, 1 = at take profit; mark position along the SL→TP path. */
  mark: number
  /** Entry position along the same path, or null without an entry. */
  entry: number | null
  zone: "near-tp" | "near-sl" | "mid"
  /** Plain-language status line. */
  label: string
}

/**
 * Original "how close am I" gauge for a bracketed sim position: where the mark sits
 * between the stop loss and the take profit. Needs both legs; returns null otherwise.
 * Works the same for longs and shorts (the path always runs SL → TP).
 */
export function bracketGauge(
  pos: "long" | "short" | "flat",
  entry: number | null,
  mark: number,
  tp: number | null,
  sl: number | null,
): BracketGauge | null {
  if (pos === "flat" || tp == null || sl == null || !Number.isFinite(mark)) return null
  const span = tp - sl
  if (span === 0 || (pos === "long" && span < 0) || (pos === "short" && span > 0)) return null
  const at = (p: number) => Math.min(1, Math.max(0, (p - sl) / span))
  const m = at(mark)
  const zone = m >= 0.8 ? "near-tp" : m <= 0.2 ? "near-sl" : "mid"
  const toTp = Math.round((1 - m) * 100)
  const toSl = Math.round(m * 100)
  const label =
    zone === "near-tp"
      ? `Closing in on take profit: ${toTp}% of the way left.`
      : zone === "near-sl"
        ? `Danger: ${toSl}% of the way from your stop loss.`
        : `Between your stop and target: ${Math.round(m * 100)}% toward take profit.`
  return { mark: m, entry: entry == null ? null : at(entry), zone, label }
}

/** A sim price alert on the XOE trade desk. Local only; it never places an order. */
export type PriceAlert = { id: number; price: number; dir: "above" | "below"; hit: boolean }

/** Most alerts kept at once. */
export const MAX_ALERTS = 5

/**
 * Make an alert from typed text. The direction comes from where the price sits now:
 * a level above the mark fires when price rises to it, below when it falls to it.
 * Returns a plain-language problem string instead when the input can't be used.
 */
export function makeAlert(id: number, text: string, mark: number, existing: readonly PriceAlert[]): PriceAlert | string {
  const px = Number(String(text).trim())
  if (!String(text).trim() || !Number.isFinite(px) || px <= 0) return "Enter an alert price above 0."
  if (existing.filter((a) => !a.hit).length >= MAX_ALERTS) return `You can keep up to ${MAX_ALERTS} live alerts. Remove one first.`
  if (Math.abs(px - mark) < 0.0005) return "That is the current price. Pick a level above or below it."
  if (existing.some((a) => !a.hit && Math.abs(a.price - px) < 0.0005)) return "You already have an alert at that price."
  return { id, price: +px.toFixed(3), dir: px > mark ? "above" : "below", hit: false }
}

/** Fire every live alert the price reached between two ticks. */
export function checkAlerts(alerts: readonly PriceAlert[], mark: number): { alerts: PriceAlert[]; fired: PriceAlert[] } {
  const fired: PriceAlert[] = []
  const next = alerts.map((a) => {
    if (a.hit) return a
    const reached = a.dir === "above" ? mark >= a.price : mark <= a.price
    if (!reached) return a
    const done = { ...a, hit: true }
    fired.push(done)
    return done
  })
  return { alerts: fired.length ? next : [...alerts], fired }
}

/** Plain line for a fired alert. */
export function alertLine(a: PriceAlert, mark: number): string {
  return `Alert: XOE ${a.dir === "above" ? "rose to" : "fell to"} ${fmtPx(a.price)} (now ${fmtPx(mark)}, sim).`
}

/** Trailing-stop distances offered on the trade desk, in percent of the mark. */
export const TRAIL_PCTS: readonly number[] = [0.5, 1, 2]

/**
 * Trailing stop (sim): the stop loss follows the price by `pct` percent and only ever moves in
 * your favour (up for a long, down for a short). Returns the new stop price when it should move,
 * or null when the current stop already sits at or past the trail level.
 */
export function trailStopPrice(pos: "long" | "short" | "flat", mark: number, sl: number | null, pct: number): number | null {
  if (pos === "flat" || !(pct > 0) || !Number.isFinite(mark) || mark <= 0) return null
  const cand = +(pos === "long" ? mark * (1 - pct / 100) : mark * (1 + pct / 100)).toFixed(3)
  if (!(cand > 0)) return null
  if (sl == null) return cand
  return pos === "long" ? (cand > sl + 0.0005 ? cand : null) : cand < sl - 0.0005 ? cand : null
}

/** Move the open bracket stop leg to a new price, keeping the same order and OCO group. */
export function moveBracketStop<B extends { orders: readonly { status: string; oco?: string; type: string; price: number | null }[] }>(book: B, sl: number): B {
  let moved = false
  const orders = book.orders.map((o) => {
    if (moved || o.status !== "open" || !o.oco || o.type !== "stop") return o
    moved = true
    return { ...o, price: sl }
  })
  return moved ? { ...book, orders } : book
}

/** Plain line describing the trail for screen readers and the Positions tab. */
export function trailLine(pos: "long" | "short", pct: number): string {
  return `Trailing ${pct}%: your stop follows XOE ${pos === "long" ? "up" : "down"} and never moves back (sim).`
}

/** Risk-based sizing (sim only): share of equity you would lose if the stop loss fills. */
export const RISK_PCTS: readonly number[] = [0.5, 1, 2]

/** Lots so that hitting `sl` from `entry` loses about `pct`% of equity, capped by what the order can use. 0 if the stop is on the wrong side. */
export function riskLots(pos: "long" | "short", equity: number, entry: number, sl: number | null, pct: number, maxLots: number): number {
  if (sl == null || !Number.isFinite(equity) || !Number.isFinite(entry) || !Number.isFinite(sl) || equity <= 0 || pct <= 0 || maxLots <= 0) return 0
  const dist = pos === "long" ? entry - sl : sl - entry
  if (!(dist > 0)) return 0
  const lots = Math.floor((equity * (pct / 100)) / (SNL_LOT * dist) + 1e-9)
  return Math.max(1, Math.min(maxLots, Math.min(200, lots)))
}

/** Dollars lost (before fees) if the stop fills, and that as a share of equity. Null when the stop is on the wrong side. */
export function riskAtStop(pos: "long" | "short", equity: number, entry: number, sl: number | null, lots: number): { usd: number; pct: number } | null {
  if (sl == null || lots <= 0 || !Number.isFinite(sl) || !Number.isFinite(entry)) return null
  const dist = pos === "long" ? entry - sl : sl - entry
  if (!(dist > 0)) return null
  const usd = SNL_LOT * lots * dist
  return { usd, pct: equity > 0 ? (usd / equity) * 100 : 0 }
}

export function riskLine(r: { usd: number; pct: number }): string {
  return `If your stop fills you lose about ${r.usd.toFixed(3)} (${r.pct.toFixed(2)}% of sim equity) before fees.`
}

/** Label for the local desk coach line. Rules only: no network, no AI call, no key; it never places or changes orders. */
export const COACH_LABEL = "Grok Bot tip (sim)"

export type CoachTone = "info" | "warn" | "good"
export interface CoachTip {
  id:
    | "stop-wrong"
    | "liq-near"
    | "near-sl"
    | "no-stop"
    | "big-risk"
    | "near-tp"
    | "trail"
    | "plan-set"
    | "form-stop-wrong"
    | "form-big-risk"
    | "streak"
    | "signal-long"
    | "signal-short"
    | "signal-watch"
    | "signal-stretched"
    | "form-ready"
    | "flat"
  tone: CoachTone
  text: string
}

export interface CoachInput {
  pos: "long" | "short" | "flat"
  entry: number | null
  mark: number
  equity: number
  /** Open position size in lots. */
  lots: number
  tp: number | null
  sl: number | null
  liq: number | null
  trailPct: number | null
  fills: readonly Pick<SnlFill, "id" | "action" | "realized" | "fee" | "at">[]
  /** Order form state (only used when flat). `opening` is null unless a market order would open a position. */
  form?: { opening: "long" | "short" | null; bracketOn: boolean; sl: number | null; lots: number }
  /** RSI 14 and EMA 9 / 21 on the chart's selected timeframe (sim). Optional so older callers keep working. */
  ind?: IndicatorSnap
}

/** Share of sim equity above which the coach warns about size. */
export const COACH_MAX_RISK_PCT = 2

/** Closed trades in a row (newest first) that lost money after fees. */
export function losingStreak(fills: CoachInput["fills"]): number {
  const closed = [...fills].sort((a, b) => b.at - a.at || b.id.localeCompare(a.id)).map(fillNet).filter((n): n is number => n != null)
  let n = 0
  for (const v of closed) {
    if (v < 0) n += 1
    else break
  }
  return n
}

/**
 * Grok Bot desk coach (sim): one plain-language tip from the paper desk state, by fixed priority.
 * Pure and deterministic. Notify only: it reads state and never places or modifies an order.
 */
export function coachTip(s: CoachInput): CoachTip {
  if (s.pos !== "flat") {
    const word = s.pos
    const wrongSide = s.sl != null && (s.pos === "long" ? s.sl >= s.mark : s.sl <= s.mark)
    if (wrongSide) {
      return { id: "stop-wrong", tone: "warn", text: `Your stop is on the wrong side of the price. For a ${word} it belongs ${s.pos === "long" ? "below" : "above"} XOE.` }
    }
    if (s.liq != null && Number.isFinite(s.liq) && s.liq > 0 && s.mark > 0 && (s.pos === "long" ? s.liq < s.mark : s.liq > s.mark) && Math.abs(s.mark - s.liq) / s.mark <= 0.05) {
      return { id: "liq-near", tone: "warn", text: "Price is within 5% of your sim liquidation level. Borrowed size cuts both ways; a smaller position gives more room." }
    }
    const gauge = bracketGauge(s.pos, s.entry, s.mark, s.tp, s.sl)
    if (gauge?.zone === "near-sl") {
      return { id: "near-sl", tone: "warn", text: "Price is close to your stop. That is the plan working. Try not to move the stop further away." }
    }
    if (s.sl == null) {
      return { id: "no-stop", tone: "warn", text: `Your ${word} has no stop loss. Add one in Positions so one bad move can't run away from you.` }
    }
    const risk = s.entry != null ? riskAtStop(s.pos, s.equity, s.entry, s.sl, s.lots) : null
    if (risk && risk.pct > COACH_MAX_RISK_PCT) {
      return { id: "big-risk", tone: "warn", text: `If your stop fills you lose about ${risk.pct.toFixed(1)}% of sim equity. Many traders keep it near 1-2%; next time try a smaller size.` }
    }
    if (gauge?.zone === "near-tp") {
      return { id: "near-tp", tone: "good", text: "Close to your take profit. Stick to the plan, or turn on a trailing stop to protect the gain." }
    }
    if (s.ind && s.ind.rsi != null) {
      const st = rsiState(s.ind.rsi)
      if ((s.pos === "long" && st === "overbought") || (s.pos === "short" && st === "oversold")) {
        return { id: "signal-stretched", tone: "info", text: `RSI ${Math.round(s.ind.rsi)} on ${s.ind.tf} is ${st}: the move against your ${word} may be stretched. A tighter stop or a take profit protects the gain (sim).` }
      }
    }
    if (s.trailPct != null) {
      return { id: "trail", tone: "info", text: `Trailing ${s.trailPct}% is on: your stop follows XOE ${s.pos === "long" ? "up" : "down"} and never moves back.` }
    }
    return { id: "plan-set", tone: "good", text: "Stop is set. Let the plan work and avoid changing it on a whim." }
  }
  const f = s.form
  if (f && f.opening && f.bracketOn && f.sl != null) {
    const wrong = f.opening === "long" ? f.sl >= s.mark : f.sl <= s.mark
    if (wrong) {
      return { id: "form-stop-wrong", tone: "warn", text: `That stop loss is on the wrong side. For a ${f.opening === "long" ? "buy it goes below" : "sell it goes above"} the price.` }
    }
    const risk = riskAtStop(f.opening, s.equity, s.mark, f.sl, f.lots)
    if (risk && risk.pct > COACH_MAX_RISK_PCT) {
      return { id: "form-big-risk", tone: "warn", text: `This order risks about ${risk.pct.toFixed(1)}% of sim equity at the stop. Try the Risk 1% button for a smaller size.` }
    }
  }
  const streak = losingStreak(s.fills)
  if (streak >= 2) {
    return { id: "streak", tone: "info", text: `Your last ${streak} closed trades lost. Take a breath and try a smaller size, like Risk 0.5%.` }
  }
  if (f && f.opening && f.bracketOn && f.sl != null) {
    const risk = riskAtStop(f.opening, s.equity, s.mark, f.sl, f.lots)
    return {
      id: "form-ready",
      tone: "good",
      text: `Good plan: entry plus stop.${risk ? ` If the stop fills you lose about ${risk.pct.toFixed(1)}% of sim equity.` : ""}`,
    }
  }
  if (s.ind) {
    const sig = indicatorSignal(s.ind)
    if (sig.kind === "long") return { id: "signal-long", tone: "good", text: `${sig.text} Plan the stop first.` }
    if (sig.kind === "short") return { id: "signal-short", tone: "good", text: `${sig.text} Plan the stop first.` }
    if (sig.kind === "watch") return { id: "signal-watch", tone: "info", text: sig.text }
    if (sig.kind === "neutral") return { id: "flat", tone: "info", text: `${sig.text} Plan first: tick TP/SL and size with Risk 1%.` }
  }
  return { id: "flat", tone: "info", text: "No position yet. Plan first: tick TP/SL, pick a stop, then size with Risk 1%. Or set a price alert and wait." }
}

/**
 * Click-to-price (sim): tapping a book level or a trades-tape print copies its price into the
 * order form, like a real exchange ladder. Market switches to Limit; Stop keeps Stop and fills
 * the trigger. The side is picked so the order is valid as typed: a limit below the price is a
 * buy and above is a sell; a stop above the price is a buy and below is a sell. At the exact
 * price the side is left alone. Form helper only; it never places an order. Paper only.
 */
export type PickSource = "bid" | "ask" | "buy" | "sell"
export interface PricePick {
  otype: "limit" | "stop"
  side: DeskSide
  text: string
  problem: string | null
  note: string
}

export function pickPrice(
  price: number,
  source: PickSource,
  otype: "limit" | "market" | "stop",
  side: DeskSide,
  mark: number,
  dp = 3,
): PricePick {
  const nextType: "limit" | "stop" = otype === "stop" ? "stop" : "limit"
  let nextSide: DeskSide = side
  if (price < mark) nextSide = nextType === "limit" ? "buy" : "sell"
  else if (price > mark) nextSide = nextType === "limit" ? "sell" : "buy"
  const text = price.toFixed(Math.max(0, Math.min(8, Math.round(dp))))
  const n = Number(text)
  const problem = nextType === "limit" ? limitProblem(nextSide, n, mark) : stopProblem(nextSide, n, mark)
  const from = source === "bid" ? "bid" : source === "ask" ? "ask" : source === "buy" ? "buy print" : "sell print"
  const what = nextType === "stop" ? "Stop trigger" : "Limit price"
  const sideWord = nextSide === "buy" ? "Buy" : "Sell"
  const note = `${what} set to ${text} from the ${from}. ${sideWord} ${nextType === "stop" ? "stop" : "limit"}${problem ? `: ${problem}` : ", check the amount and place it."}`
  return { otype: nextType, side: nextSide, text, problem, note }
}
