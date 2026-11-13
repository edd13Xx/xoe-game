/**
 * XOE = in-run lifeblood / score unit (companion remains named XO).
 * HEALTH bar tracks XOE. Hit 0 or the Total Liquidation price → death (fall + red tint).
 * Lives (default 3): respawn with blink invincibility, then resume.
 */

import { getLocalStore } from "./safe-storage.ts"


export const XOE_UNIT = "XOE"
export const STARTING_XOE = 100
export const XOE_MAX = 100
export const XOE_GAIN_GOOD = 15
export const XOE_DRAIN_BAD = 25
export const LIQUIDATION_DRAWDOWN = 0.044
export const LIQUIDATED_LABEL = "Total Liquidation"
export const LIQUIDATION_PRICE_LABEL = "Total Liquidation price"
export const HEALTH_BAR_LABEL = "HEALTH"
/** Chart marker: Total Liquidation -4.4% */
export const TOTAL_LIQUIDATION_MARKER = "Total Liquidation -4.4%"
export const DEFAULT_LIVES = 2
/** Grace period after respawn: blink + no damage / no liquidation checks. */
export const RESPAWN_INVINCIBILITY_SEC = 2.0
/** After Total Liquidation fly-away: XO recharges with SIS help. */
export const RECHARGE_MS = 15000
export const RECHARGE_STATUS_LINE = "XO is recharging. SIS is helping."
export const RECHARGE_STORAGE_KEY = "xoe.rechargeUntilMs.v1"
/** Wall-clock recharge — full RECHARGE_MS, no skip/shorten. Persisted end time. */

export type TradeSide = "long" | "short" | "flat"

export type DeathPhase = "alive" | "dying" | "recharging" | "respawning" | "gameover"

export interface XoeRunState {
  xoe: number
  side: TradeSide
  entry: number | null
  enemiesDestroyed: number
  liquidated: boolean
  lives: number
  deathPhase: DeathPhase
  invincibleUntilMs: number | null
  rechargeUntilMs: number | null
  lastEffect: "gain" | "drain" | "liquidated" | "respawn" | null
}

export function initialXoeRun(start = STARTING_XOE, lives = DEFAULT_LIVES): XoeRunState {
  return {
    xoe: start,
    side: "flat",
    entry: null,
    enemiesDestroyed: 0,
    liquidated: false,
    lives,
    deathPhase: "alive",
    invincibleUntilMs: null,
    rechargeUntilMs: null,
    lastEffect: null,
  }
}

/** Long liq = entry × (1-0.044); short liq = entry × (1+0.044). */
export function liquidationPrice(entry: number, side: Exclude<TradeSide, "flat">): number {
  if (side === "long") return roundPrice(entry * (1 - LIQUIDATION_DRAWDOWN))
  return roundPrice(entry * (1 + LIQUIDATION_DRAWDOWN))
}

export function roundPrice(n: number): number {
  return Math.round(n * 100) / 100
}

export function isAtOrPastLiquidation(
  mark: number,
  entry: number,
  side: Exclude<TradeSide, "flat">,
): boolean {
  const liq = liquidationPrice(entry, side)
  if (side === "long") return mark <= liq
  return mark >= liq
}

export function liquidationPriceLabel(entry: number, side: Exclude<TradeSide, "flat">): string {
  return `${LIQUIDATION_PRICE_LABEL} ${liquidationPrice(entry, side)}`
}

export function totalLiquidationMarkerLabel(entry: number, side: Exclude<TradeSide, "flat">): string {
  return `${TOTAL_LIQUIDATION_MARKER} · ${liquidationPrice(entry, side)}`
}

/** Correct direction: long while price rose, or short while price fell. */
export function wasGoodDirection(
  side: TradeSide,
  prevPrint: number,
  nextPrint: number,
): boolean | null {
  if (side === "flat") return null
  const up = nextPrint > prevPrint
  const down = nextPrint < prevPrint
  if (side === "long") return up ? true : down ? false : null
  return down ? true : up ? false : null
}

export function isInvincible(state: XoeRunState, nowMs: number): boolean {
  if (state.deathPhase === "dying" || state.deathPhase === "gameover") return true
  if (state.deathPhase === "respawning") return true
  if (state.invincibleUntilMs == null) return false
  return nowMs < state.invincibleUntilMs
}

export function applyGoodMove(state: XoeRunState): XoeRunState {
  if (state.deathPhase !== "alive") return state
  const xoe = Math.min(XOE_MAX, state.xoe + XOE_GAIN_GOOD)
  return {
    ...state,
    xoe,
    enemiesDestroyed: state.enemiesDestroyed + 1,
    lastEffect: "gain",
  }
}

export function applyBadMove(state: XoeRunState, nowMs = 0): XoeRunState {
  if (state.deathPhase !== "alive") return state
  if (isInvincible(state, nowMs)) return state
  const xoe = Math.max(0, state.xoe - XOE_DRAIN_BAD)
  if (xoe <= 0) return beginDeath(state)
  return { ...state, xoe, lastEffect: "drain" }
}

export function applyMarkCheck(state: XoeRunState, mark: number, nowMs = 0): XoeRunState {
  if (state.deathPhase !== "alive") return state
  if (isInvincible(state, nowMs)) return state
  if (state.side === "flat" || state.entry === null) return state
  if (isAtOrPastLiquidation(mark, state.entry, state.side)) {
    return beginDeath(state)
  }
  return state
}

export function beginDeath(state: XoeRunState): XoeRunState {
  if (state.deathPhase === "dying" || state.deathPhase === "gameover") return state
  return {
    ...state,
    xoe: 0,
    liquidated: true,
    deathPhase: "dying",
    side: "flat",
    entry: null,
    invincibleUntilMs: null,
    rechargeUntilMs: null,
    lastEffect: "liquidated",
  }
}

/**
 * After the fall/red death beat: consume a life and start respawn blink,
 * or game over when no lives remain.
 */
export function resolveDeath(state: XoeRunState, _nowMs: number): XoeRunState {
  if (state.deathPhase !== "dying") return state
  if (state.lives <= 1) {
    return {
      ...state,
      lives: 0,
      xoe: 0,
      liquidated: true,
      deathPhase: "gameover",
      invincibleUntilMs: null,
      rechargeUntilMs: null,
      lastEffect: "liquidated",
    }
  }
  // Lives remain: enter SIS recharge countdown, then fly back + shield respawn.
  const until = Date.now() + RECHARGE_MS // wall clock; full 15s, no skip
  try {
    persistRechargeUntil(getLocalStore(), until)
  } catch { /* ignore */ }
  return {
    ...state,
    lives: state.lives - 1,
    xoe: STARTING_XOE,
    liquidated: false,
    deathPhase: "recharging",
    side: "flat",
    entry: null,
    invincibleUntilMs: null,
    rechargeUntilMs: until,
    lastEffect: "respawn",
  }
}

/** When recharge timer hits 0 → fly-back respawn with shield invincibility. */
export function finishRecharge(state: XoeRunState, nowMs = Date.now()): XoeRunState {
  if (state.deathPhase !== "recharging") return state
  const until = state.rechargeUntilMs ?? readPersistedRechargeUntil(
    getLocalStore(),
  )
  if (until != null && nowMs < until) return state
  try {
    clearPersistedRecharge(getLocalStore())
  } catch { /* ignore */ }
  return {
    ...state,
    deathPhase: "respawning",
    xoe: STARTING_XOE,
    liquidated: false,
    rechargeUntilMs: null,
    invincibleUntilMs: nowMs + RESPAWN_INVINCIBILITY_SEC * 1000,
    lastEffect: "respawn",
  }
}

export function rechargeRemainingMs(state: XoeRunState, nowMs: number): number {
  if (state.deathPhase !== "recharging" || state.rechargeUntilMs == null) return 0
  return Math.max(0, state.rechargeUntilMs - nowMs)
}

type RechargeStore = { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void; removeItem: (k: string) => void }

export function persistRechargeUntil(store: RechargeStore | null, untilMs: number): void {
  if (!store) return
  try {
    store.setItem(RECHARGE_STORAGE_KEY, String(Math.floor(untilMs)))
  } catch { /* ignore */ }
}

export function clearPersistedRecharge(store: RechargeStore | null): void {
  if (!store) return
  try {
    store.removeItem(RECHARGE_STORAGE_KEY)
  } catch { /* ignore */ }
}

export function readPersistedRechargeUntil(store: RechargeStore | null): number | null {
  if (!store) return null
  try {
    const raw = store.getItem(RECHARGE_STORAGE_KEY)
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

/** True while wall-clock recharge is active (hides Retry/Continue/Return). */
export function isRechargeBlocking(store: RechargeStore | null, nowMs = Date.now()): boolean {
  const until = readPersistedRechargeUntil(store)
  if (until == null) return false
  if (nowMs >= until) {
    clearPersistedRecharge(store)
    return false
  }
  return true
}


/** End blink window: restore alive + ready for a new trade entry. */
export function finishRespawn(state: XoeRunState, nowMs: number): XoeRunState {
  if (state.deathPhase !== "respawning") return state
  if (state.invincibleUntilMs != null && nowMs < state.invincibleUntilMs) return state
  return {
    ...state,
    deathPhase: "alive",
    invincibleUntilMs: null,
    xoe: state.xoe > 0 ? state.xoe : STARTING_XOE,
  }
}

export function openOrAddPosition(
  state: XoeRunState,
  side: Exclude<TradeSide, "flat">,
  entry: number,
): XoeRunState {
  if (state.deathPhase !== "alive" && state.deathPhase !== "respawning") return state
  if (state.side === "flat" || state.side !== side || state.entry === null) {
    return { ...state, side, entry }
  }
  return { ...state, side }
}

export function flattenPosition(state: XoeRunState): XoeRunState {
  if (state.liquidated && state.deathPhase === "gameover") return state
  return { ...state, side: "flat", entry: null }
}

export function healthFraction(xoe: number, max = XOE_MAX): number {
  if (max <= 0) return 0
  return Math.max(0, Math.min(1, xoe / max))
}

/**
 * Respawn blink: fast blink easing to slower then solid over RESPAWN_INVINCIBILITY_SEC.
 * periodMs goes from ~80ms → ~320ms across the window; last 15% always solid/visible.
 */
/**
 * Respawn look (Eddie C+D): fade see-through → solid over RESPAWN_INVINCIBILITY_SEC
 * inside a glowing shield bubble that pops when invincibility ends. Subtle shimmer OK.
 */
export function respawnFadeAlpha(nowMs: number, state: XoeRunState): number {
  if (state.deathPhase !== "respawning" && !isInvincible(state, nowMs)) return 1
  if (state.invincibleUntilMs == null) return 1
  const total = RESPAWN_INVINCIBILITY_SEC * 1000
  const remaining = Math.max(0, state.invincibleUntilMs - nowMs)
  const elapsed = total - remaining
  const t = Math.max(0, Math.min(1, elapsed / total))
  // ease-out fade 0.2 → 1
  const eased = 1 - Math.pow(1 - t, 2)
  return 0.2 + eased * 0.8
}

export function respawnShieldActive(nowMs: number, state: XoeRunState): boolean {
  if (state.deathPhase === "respawning") return true
  return isInvincible(state, nowMs) && state.invincibleUntilMs != null && nowMs < state.invincibleUntilMs
}

/** @deprecated — keep name for older calls; always visible now (fade handles opacity). */
export function blinkVisible(nowMs: number, state: XoeRunState): boolean {
  return respawnFadeAlpha(nowMs, state) > 0.05
}
