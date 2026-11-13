/**
 * Rare "red day" solar-flare events. Visual and XOE/USD sim only.
 * No ledger, cap, reward, XP, or economy-table changes.
 */
import { clampXoeSimPrice, XOE_SIM_MIN, XOE_SIM_MAX, type PriceRegime, type XoeSimState } from "./xoe-sim-price.ts"
import type { KvStore } from "./safe-storage.ts"

export const FLARE_LOG_KEY = "xoe.solarFlare.v1"
/** Target peak-to-trough drop during a red day. */
export const FLARE_DRAWDOWN_MIN = 0.1
export const FLARE_DRAWDOWN_MAX = 0.15
/** ~48s at the 1.2s XOE tick. */
export const FLARE_DURATION_TICKS = 40
/** One in-game day of play (~3 min). */
export const FLARE_DAY_TICKS = 150
/** About once every several eligible sessions/days. */
export const FLARE_ROLL = 1 / 6
/** First session is always calm. */
export const FLARE_FIRST_ELIGIBLE_SESSION = 2
/** Never on consecutive sessions or consecutive in-game days. */
export const FLARE_MIN_GAP = 2

export type FlarePhase = "idle" | "drop" | "bounce" | "recover"

export interface SolarFlareState {
  active: boolean
  tick: number
  duration: number
  seed: number
  session: number
  day: number
  startPrice: number
  troughPrice: number
  phase: FlarePhase
  forced: boolean
}

export interface FlareLog {
  sessionCount: number
  dayCount: number
  lastFlareSession: number | null
  lastFlareDay: number | null
  seed: number
}

export function emptyFlareLog(seed = 1): FlareLog {
  return { sessionCount: 0, dayCount: 0, lastFlareSession: null, lastFlareDay: null, seed: seed >>> 0 || 1 }
}

export function idleFlare(seed = 1): SolarFlareState {
  return {
    active: false,
    tick: 0,
    duration: FLARE_DURATION_TICKS,
    seed: seed >>> 0 || 1,
    session: 0,
    day: 0,
    startPrice: 0,
    troughPrice: 0,
    phase: "idle",
    forced: false,
  }
}

/** Deterministic 0..1 hash. */
export function flareHash(seed: number, session: number, day: number): number {
  let h = (seed >>> 0 || 1) + session * 0x9e3779b9 + day * 0x85ebca6b
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d)
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

export function wouldRollFlare(seed: number, session: number, day: number): boolean {
  if (session < FLARE_FIRST_ELIGIBLE_SESSION) return false
  return flareHash(seed, session, day) < FLARE_ROLL
}

export function canStartFlare(log: FlareLog, session: number, day: number): boolean {
  if (session < FLARE_FIRST_ELIGIBLE_SESSION) return false
  if (log.lastFlareSession != null && session - log.lastFlareSession < FLARE_MIN_GAP) return false
  // Day gap only applies when the in-game day actually moved since the last flare.
  if (log.lastFlareDay != null && day !== log.lastFlareDay && day - log.lastFlareDay < FLARE_MIN_GAP) return false
  return true
}

export function rollFlare(log: FlareLog, seed: number, session: number, day: number): boolean {
  return canStartFlare(log, session, day) && wouldRollFlare(seed, session, day)
}

export function troughPriceFor(startPrice: number, seed: number, session: number, day = 0): number {
  const u = flareHash(seed, session, day + 97)
  const pct = FLARE_DRAWDOWN_MIN + u * (FLARE_DRAWDOWN_MAX - FLARE_DRAWDOWN_MIN)
  return clampXoeSimPrice(startPrice * (1 - pct))
}

export function startFlare(
  startPrice: number,
  opts: { seed: number; session: number; day: number; forced?: boolean },
): SolarFlareState {
  const start = clampXoeSimPrice(startPrice)
  return {
    active: true,
    tick: 0,
    duration: FLARE_DURATION_TICKS,
    seed: opts.seed >>> 0 || 1,
    session: opts.session,
    day: opts.day,
    startPrice: start,
    troughPrice: troughPriceFor(start, opts.seed, opts.session, opts.day),
    phase: "drop",
    forced: opts.forced === true,
  }
}

export function flarePhaseAt(tick: number, duration: number): FlarePhase {
  const t = duration <= 0 ? 1 : tick / duration
  if (t < 0.42) return "drop"
  if (t < 0.64) return "bounce"
  if (t < 1) return "recover"
  return "idle"
}

/**
 * Envelope 0..1 of the way from start to trough (1 = at trough).
 * Drop, a partial bounce, a shallower dip, then a return toward the start.
 */
export function flareEnvelope(tick: number, duration: number): number {
  const t = Math.max(0, Math.min(1, duration <= 0 ? 1 : tick / duration))
  if (t <= 0.42) {
    const u = t / 0.42
    return u * u * (3 - 2 * u)
  }
  if (t <= 0.64) {
    const u = (t - 0.42) / 0.22
    return 1 - 0.42 * u
  }
  const u = (t - 0.64) / 0.36
  return 0.58 * (1 - u * u)
}

export function flareTickQuote(
  flare: SolarFlareState,
  noise: number,
): { price: number; wickHigh: number; wickLow: number; vol: number; regime: PriceRegime } {
  const env = flareEnvelope(flare.tick, flare.duration)
  const floor = flare.startPrice * (1 - FLARE_DRAWDOWN_MAX)
  const span = flare.startPrice - flare.troughPrice
  const jag = noise * 0.018 * flare.startPrice
  let price = flare.startPrice - span * env + jag
  // Pin the trough so tests and the tape always see a 10–15% red day (or the $5 clamp).
  const troughAt = Math.max(1, Math.round(flare.duration * 0.42))
  const minAllowed = Math.max(XOE_SIM_MIN, floor, flare.troughPrice)
  const maxAllowed = Math.min(XOE_SIM_MAX, Math.max(flare.startPrice, flare.troughPrice) * 1.02)
  price = clampXoeSimPrice(Math.min(maxAllowed, Math.max(minAllowed, price)))
  if (flare.tick === troughAt) price = flare.troughPrice
  const vol = 2.4 + Math.abs(noise) * 0.8
  const wick = Math.max(price * 0.006, span * 0.08) * (1.1 + Math.abs(noise))
  const goingDown = price <= flare.startPrice - span * env * 0.5
  const wickLow = clampXoeSimPrice(Math.max(minAllowed, price - wick * (goingDown ? 1.35 : 0.7)))
  const wickHigh = clampXoeSimPrice(Math.min(maxAllowed, price + wick * (goingDown ? 0.35 : 0.9)))
  const phase = flarePhaseAt(flare.tick, flare.duration)
  const regime: PriceRegime = phase === "bounce" || phase === "recover" ? "trend-up" : "trend-down"
  return { price, wickHigh: Math.max(wickHigh, price), wickLow: Math.min(wickLow, price), vol, regime }
}

export function applyFlareTick(sim: XoeSimState, flare: SolarFlareState, noise: number, now: number): { sim: XoeSimState; flare: SolarFlareState } {
  if (!flare.active) return { sim, flare }
  const nextTick = flare.tick + 1
  const live: SolarFlareState = { ...flare, tick: nextTick, phase: flarePhaseAt(nextTick, flare.duration) }
  const quote = flareTickQuote(live, noise)
  const simNext: XoeSimState = {
    ...sim,
    price: quote.price,
    updatedAt: now || sim.updatedAt,
    regime: quote.regime,
    vol: quote.vol,
    wickHigh: quote.wickHigh,
    wickLow: quote.wickLow,
    volume: 22 + quote.vol * 16,
    regimeLeft: Math.max(8, flare.duration - nextTick),
  }
  if (nextTick >= flare.duration) {
    return {
      sim: { ...simNext, regime: "range", regimeLeft: 28, vol: 1 },
      flare: { ...live, active: false, phase: "idle" },
    }
  }
  return { sim: simNext, flare: live }
}

export function markFlareStarted(log: FlareLog, session: number, day: number): FlareLog {
  return { ...log, lastFlareSession: session, lastFlareDay: day }
}

export function readFlareLog(store: KvStore, seed: number): FlareLog {
  try {
    const raw = store.getItem(FLARE_LOG_KEY)
    if (!raw) return emptyFlareLog(seed)
    const parsed = JSON.parse(raw) as Partial<FlareLog>
    return {
      sessionCount: Number.isFinite(parsed.sessionCount) ? Math.max(0, Number(parsed.sessionCount)) : 0,
      dayCount: Number.isFinite(parsed.dayCount) ? Math.max(0, Number(parsed.dayCount)) : 0,
      lastFlareSession: Number.isFinite(parsed.lastFlareSession) ? Number(parsed.lastFlareSession) : null,
      lastFlareDay: Number.isFinite(parsed.lastFlareDay) ? Number(parsed.lastFlareDay) : null,
      seed: Number.isFinite(parsed.seed) && Number(parsed.seed) ? Number(parsed.seed) >>> 0 : seed >>> 0 || 1,
    }
  } catch {
    return emptyFlareLog(seed)
  }
}

export function writeFlareLog(store: KvStore, log: FlareLog): void {
  try {
    store.setItem(FLARE_LOG_KEY, JSON.stringify(log))
  } catch {
    /* storage blocked: session-only */
  }
}

export function seedFromDeviceId(id: string | null | undefined): number {
  const s = id && id.trim() ? id : "xoe"
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0 || 1
}
