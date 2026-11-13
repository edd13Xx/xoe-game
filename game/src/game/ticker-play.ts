/**
 * Ticker gameplay (Testnet XOE · no real money). Price moves from the live Coinbase public ticker
 * (or simulated prices when offline) become things on the field:
 *   price up   → Gestalt (fly into / tap it: testnet play reward, credited to the v14 ledger)
 *   price down → enemy unit (engage like a skirmish bot on the map; tap to shield it in a lesson)
 * Lane = coin's ticker slot mod 3: XLM → L1, BTC & ADA → L2, ETH → L3.
 * v15: calm-market tuning — the trigger scales to recent volatility, tiny moves make "mini" coins,
 * a minimum cadence keeps the field alive, and big moves stay special (gold, longer life, never crowded out).
 * Pure functions only — no network, no money, no keys.
 */
import { TICKER_PAIRS, type TickerQuote, type TickerSnapshot } from "./live-ticker.ts"
import { WORLD_H, WORLD_W } from "./overworld.ts"

/** Normal trigger in a busy market (percent between two snapshots). Calm markets scale it down. */
export const TICKER_MOVE_THRESHOLD_PCT = 0.02
/** v15: lowest the adaptive trigger may go. */
export const TICKER_MIN_THRESHOLD_PCT = 0.004
/** v15: smallest move that can make a mini coin/hazard. */
export const TICKER_MINI_PCT = 0.0005
/** v15: big moves — at least this, AND at least 3× the recent average move. */
export const TICKER_BIG_PCT = 0.15
export const TICKER_ITEM_TTL_MS = 25_000
export const TICKER_BIG_TTL_MS = 40_000
export const TICKER_MAX_ITEMS = 6
/** v15: if nothing spawned for this long, a small "drift" item appears (live polls are 30s apart). */
export const TICKER_CADENCE_MS = 9_000
export const TICKER_RECENT_MAX = 30
/** Offline: simulated price step every N ms (live keeps the 30s public poll). */
export const TICKER_SIM_STEP_MS = 8_000
export const TICKER_HAZARD_PENALTY = 10
export const TICKER_MINI_PENALTY = 5
export const TICKER_SHIELD_BONUS = 5
export const MINI_COIN_POINTS = 5
/** v15 coin value in XOE stroops (1 XOE = 10,000,000). Normal: 1,000 per point (0.0010–0.0050 XOE). */
export const COIN_STROOPS_PER_POINT = 1_000
export const MINI_COIN_STROOPS = 5_000

/** Rough anchor prices used ONLY when there is no live or cached price. */
export const SIM_BASE_PRICES: Record<string, number> = { XLM: 0.15, BTC: 75000, ETH: 2100, ADA: 0.35 }

export type TickerItemKind = "orb" | "hazard"
export type TickerSize = "mini" | "normal" | "big"

export interface TickerMove {
  symbol: string
  pct: number
}

export interface TickerItem {
  id: string
  /** "orb" kept as the internal id for compatibility; on screen it is a Gestalt unit. */
  kind: TickerItemKind
  symbol: string
  pct: number
  lane: 0 | 1 | 2
  wx: number
  wy: number
  bornAt: number
  /** Paper points: + for coins, − (penalty) for hazards */
  points: number
  size?: TickerSize
  /** Gestalt pickup value (stroops) before streak/cap. 0 for enemy units. */
  stroops?: number
  ttl?: number
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const SYMBOL_LANE: Record<string, 0 | 1 | 2> = { XLM: 0, BTC: 1, ADA: 1, ETH: 2 }

export function laneForSymbol(symbol: string): 0 | 1 | 2 {
  return SYMBOL_LANE[symbol] ?? ((hash(symbol) % 3) as 0 | 1 | 2)
}

/** Percent change per coin between two snapshots (by price). */
export function tickerMoves(prev: TickerSnapshot | null, next: TickerSnapshot): TickerMove[] {
  if (!prev) return []
  const out: TickerMove[] = []
  for (const q of next.quotes) {
    if (q.symbol === "XOE") continue // XOE/USD sim is the trade instrument, not a map coin spawn
    const p = prev.quotes.find((x) => x.symbol === q.symbol)
    if (!p || !(p.priceUsd > 0) || !(q.priceUsd > 0)) continue
    const pct = ((q.priceUsd - p.priceUsd) / p.priceUsd) * 100
    if (Number.isFinite(pct)) out.push({ symbol: q.symbol, pct })
  }
  return out
}

/** Coin points grow with the size of the move: 10 pts base, +10 per 0.1%, cap 50 (v13 lock). */
export function orbPoints(pct: number): number {
  return Math.min(50, 10 + Math.floor(Math.abs(pct) * 100))
}

/** Recent absolute moves (rolling, for volatility). */
export const pushRecent = (recent: readonly number[], moves: readonly TickerMove[]) =>
  [...recent, ...moves.map((m) => Math.abs(m.pct))].slice(-TICKER_RECENT_MAX)
const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

/** v15: trigger = clamp(1.5 × average recent move, 0.004%, 0.02%). No history → the v13 0.02%. */
export function adaptiveThreshold(recent: readonly number[]): number {
  if (recent.length < 3) return TICKER_MOVE_THRESHOLD_PCT
  return Math.min(TICKER_MOVE_THRESHOLD_PCT, Math.max(TICKER_MIN_THRESHOLD_PCT, mean(recent) * 1.5))
}

export function isBigMove(pct: number, recent: readonly number[]): boolean {
  return Math.abs(pct) >= Math.max(TICKER_BIG_PCT, mean(recent) * 3)
}

export interface Near {
  x: number
  y: number
}
/** v15: spawn inside a ~340×280 box around XO (on screen on a phone) when `near` is known, else anywhere. */
export function spawnPos(h: number, near?: Near | null): Near {
  if (!near) return { x: 80 + (h % (WORLD_W - 160)), y: 80 + ((h >>> 11) % (WORLD_H - 160)) }
  const clampTo = (v: number, max: number) => Math.min(max - 60, Math.max(60, v))
  let dx = (h % 340) - 170
  let dy = ((h >>> 11) % 280) - 140
  if (Math.abs(dx) < 50 && Math.abs(dy) < 50) dx += dx < 0 ? -60 : 60 // never right on top of XO
  if (dx < -60 && dy < -110) dy += 150 // keep clear of the mini map (top-left of the view)
  return { x: clampTo(near.x + dx, WORLD_W), y: clampTo(near.y + dy, WORLD_H) }
}

function makeItem(m: TickerMove, now: number, size: TickerSize, tag = "", near?: Near | null): TickerItem {
  const kind: TickerItemKind = m.pct >= 0 ? "orb" : "hazard"
  const h = hash(`${m.symbol}:${now}${tag}`)
  const at = spawnPos(h, near)
  const pts = size === "mini" ? MINI_COIN_POINTS : orbPoints(m.pct)
  const stroops = size === "mini" ? MINI_COIN_STROOPS : pts * COIN_STROOPS_PER_POINT * (size === "big" ? 2 : 1)
  return {
    id: `${m.symbol}-${now}${tag}`,
    kind,
    symbol: m.symbol,
    pct: Math.round(m.pct * 1000) / 1000,
    lane: laneForSymbol(m.symbol),
    wx: at.x,
    wy: at.y,
    bornAt: now,
    points: kind === "orb" ? pts : -(size === "mini" ? TICKER_MINI_PENALTY : TICKER_HAZARD_PENALTY),
    size,
    stroops: kind === "orb" ? stroops : 0,
    ttl: size === "big" ? TICKER_BIG_TTL_MS : TICKER_ITEM_TTL_MS,
  }
}

/**
 * Map moves → items. Deterministic for a given (moves, now, recent).
 * Moves ≥ adaptive trigger → normal (or big); else the single largest move ≥ 0.0005% → one mini item.
 */
export function itemsFromMoves(
  moves: readonly TickerMove[],
  now: number,
  recent: readonly number[] = [],
  near?: Near | null,
): TickerItem[] {
  const trig = adaptiveThreshold(recent)
  const items: TickerItem[] = []
  for (const m of moves) {
    if (Math.abs(m.pct) < trig) continue
    items.push(makeItem(m, now, isBigMove(m.pct, recent) ? "big" : "normal", "", near))
  }
  if (!items.length) {
    const top = [...moves].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))[0]
    if (top && Math.abs(top.pct) >= TICKER_MINI_PCT) items.push(makeItem(top, now, "mini", "", near))
  }
  return items
}

/**
 * v15 minimum cadence: when nothing spawned for TICKER_CADENCE_MS, one mini "drift" item from the
 * next coin in rotation, pointing the way that coin last moved (up if unknown). Coins 2:1 over hazards
 * when unknown so a calm market still feels rewarding.
 */

/**
 * v16 live world: the XOE/USD sim tick itself paints the flying field.
 * Price up → a short coin stream + a green ▲ updraft near XO.
 * Price down → red enemy units. Enemies still never take XOE (points only); they open a sim skirmish.
 */
export function xoeWorldItems(
  prevPrice: number,
  nextPrice: number,
  now: number,
  near?: Near | null,
): TickerItem[] {
  if (!(prevPrice > 0) || !(nextPrice > 0) || prevPrice === nextPrice) return []
  const pct = ((nextPrice - prevPrice) / prevPrice) * 100
  if (!Number.isFinite(pct) || Math.abs(pct) < 0.02) return []
  const move: TickerMove = { symbol: "XOE", pct }
  const size: TickerSize = Math.abs(pct) >= 0.35 ? "big" : Math.abs(pct) < 0.08 ? "mini" : "normal"
  if (pct > 0) {
    const stream = 1 + (Math.abs(pct) >= 0.15 ? 1 : 0) + (size === "big" ? 1 : 0)
    const items: TickerItem[] = []
    for (let i = 0; i < stream; i += 1) {
      items.push(makeItem(move, now, size, `-up${i}`, near))
    }
    return items
  }
  const dips = size === "big" ? 2 : 1
  return Array.from({ length: dips }, (_, i) => makeItem(move, now, size, `-dn${i}`, near))
}

export function cadenceItem(
  snap: TickerSnapshot | null,
  lastSpawnAt: number,
  now: number,
  seq: number,
  near?: Near | null,
): TickerItem | null {
  if (now - lastSpawnAt < TICKER_CADENCE_MS) return null
  const quotes = snap?.quotes.length ? snap.quotes : TICKER_PAIRS.map((p) => ({ symbol: p.split("-")[0]! }) as TickerQuote)
  const q = quotes[seq % quotes.length]!
  const step = q.stepPct ?? null
  const up = step == null || step === 0 ? seq % 3 !== 2 : step > 0
  return makeItem({ symbol: q.symbol, pct: up ? TICKER_MINI_PCT : -TICKER_MINI_PCT }, now, "mini", "-d", near)
}

const ttlOf = (it: TickerItem) => it.ttl ?? TICKER_ITEM_TTL_MS
const rank = (it: TickerItem) => (it.size === "big" ? 2 : it.size === "mini" ? 0 : 1)

/** Merge new items, drop expired, keep TICKER_MAX_ITEMS — minis go first, big moves last. */
export function mergeTickerItems(cur: readonly TickerItem[], add: readonly TickerItem[], now: number): TickerItem[] {
  const seen = new Set<string>()
  let out = [...cur, ...add].filter((it) => now - it.bornAt < ttlOf(it) && !seen.has(it.id) && (seen.add(it.id), true))
  while (out.length > TICKER_MAX_ITEMS) {
    const low = Math.min(...out.map(rank))
    const drop = out.findIndex((it) => rank(it) === low)
    out = out.filter((_, i) => i !== drop)
  }
  return out
}

/** Small seeded RNG so offline play is repeatable in tests. */
export function seededRng(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** Offline fallback: random-walk each coin up to ±maxStepPct; rare (3%) spikes up to ±0.6% so big moves still happen. */
export function simulateSnapshot(
  prev: TickerSnapshot | null,
  rng: () => number,
  now: number,
  maxStepPct = 0.3,
): TickerSnapshot {
  const quotes: TickerQuote[] = TICKER_PAIRS.map((pair) => {
    const symbol = pair.split("-")[0]!
    const p = prev?.quotes.find((q) => q.symbol === symbol)
    const last = p?.priceUsd || SIM_BASE_PRICES[symbol] || 1
    const open = p?.open24h ?? last
    const spike = rng() < 0.03 ? 2 : 1
    const step = (rng() * 2 - 1) * maxStepPct * spike
    const price = last * (1 + step / 100)
    return {
      pair,
      symbol,
      priceUsd: price,
      change24hPct: ((price - open) / open) * 100,
      stepPct: step,
      open24h: open,
      updatedAt: now,
    }
  })
  return { quotes, live: false, message: "Simulated walk · offline", updatedAt: now }
}

/** Overworld: which live items does XO touch at (x, y)? */
export function touchedItems(items: readonly TickerItem[], x: number, y: number, radius = 36): TickerItem[] {
  return items.filter((it) => Math.hypot(it.wx - x, it.wy - y) <= radius)
}
