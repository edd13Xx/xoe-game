/**
 * Paper/sim trade defense: the ship rides the XOE/USD sim price,
 * bot attackers close in, and the player + XOE fire lasers.
 * Cosmetic / practice only — never touches balances, caps, or rewards.
 */
import { XOE_SIM_MAX, XOE_SIM_MIN, clampXoeSimPrice } from "./xoe-sim-price.ts"
import { priceVolatility } from "./rsi.ts"

export const ARENA_W = 360
export const ARENA_H = 200
export const SHIP_X = 78
export const XOE_X = 318
export const XOE_Y = 48
export const SHIELD_MAX = 100

export type ArenaDifficulty = "easy" | "normal" | "hard"
export type TradeImpulse = "long" | "close" | "short" | "cover" | "reverse"
export type ArenaShotFrom = "ship" | "xoe"
export type ArenaEnemy = { id: string; x: number; y: number; vx: number; hp: number }
export type ArenaShot = { id: string; x: number; y: number; vx: number; from: ArenaShotFrom }

export interface ArenaState {
  shipY: number
  bounce: number
  shield: number
  enemies: ArenaEnemy[]
  shots: ArenaShot[]
  lockId: string | null
  paused: boolean
  eased: boolean
  flash: boolean
  nextId: number
  spawnIn: number
  lastPrice: number
  tradeKick: number
}

export function priceToShipY(price: number, height = ARENA_H): number {
  const p = clampXoeSimPrice(price)
  const t = (p - XOE_SIM_MIN) / (XOE_SIM_MAX - XOE_SIM_MIN)
  const top = 28
  const bot = height - 28
  return bot - t * (bot - top)
}

export function createArena(price: number, paused = false): ArenaState {
  return {
    shipY: priceToShipY(price),
    bounce: 0,
    shield: SHIELD_MAX,
    enemies: [],
    shots: [],
    lockId: null,
    paused,
    eased: false,
    flash: false,
    nextId: 1,
    spawnIn: 1.1,
    lastPrice: price,
    tradeKick: 0,
  }
}

function spawnDelay(volatility: number, difficulty: ArenaDifficulty, eased: boolean, reduced: boolean, redDay = false): number {
  const base = difficulty === "easy" ? 2.4 : difficulty === "hard" ? 1.05 : 1.6
  const vol = 1 / (1 + volatility * 0.85)
  const relax = eased || reduced ? 1.8 : 1
  const storm = redDay ? 0.55 : 1
  return Math.max(0.45, base * vol * relax * storm)
}

function enemySpeed(difficulty: ArenaDifficulty, eased: boolean, reduced: boolean, redDay = false): number {
  const base = difficulty === "easy" ? 42 : difficulty === "hard" ? 78 : 58
  return base * (eased || reduced ? 0.55 : 1) * (redDay ? 1.4 : 1)
}

export function tickArena(
  state: ArenaState,
  dt: number,
  opts: {
    price: number
    history?: readonly number[]
    difficulty?: ArenaDifficulty
    reducedMotion?: boolean
    fireShip?: boolean
    fireXoe?: boolean
    dash?: boolean
    redDay?: boolean
  },
): ArenaState {
  const difficulty = opts.difficulty ?? "normal"
  const reduced = opts.reducedMotion === true
  const price = clampXoeSimPrice(opts.price)
  const targetY = priceToShipY(price)
  const bounced = price !== state.lastPrice
  const redDay = opts.redDay === true
  let bounce = bounced || opts.dash || (redDay && !reduced) ? 1 : Math.max(0, state.bounce - dt * 3.2)
  const tradeKick = state.tradeKick - state.tradeKick * Math.min(1, dt * 4)
  const follow = redDay && !reduced ? 3.2 : 8
  const shipY = state.shipY + (targetY - state.shipY) * Math.min(1, dt * follow)
  const vol = priceVolatility(opts.history ?? [state.lastPrice, price])

  if (state.paused) {
    return { ...state, shipY, bounce, tradeKick, lastPrice: price, flash: false }
  }

  let nextId = state.nextId
  let spawnIn = state.spawnIn - dt
  let enemies = state.enemies.map((e) => ({ ...e, x: e.x + e.vx * dt }))
  let shots = state.shots.map((s) => ({ ...s, x: s.x + s.vx * dt }))
  let shield = state.shield
  let flash = false

  if (opts.fireShip) {
    shots.push({ id: `s${nextId++}`, x: SHIP_X + 16, y: shipY, vx: 280, from: "ship" })
  }
  if (opts.fireXoe) {
    const lock = enemies.find((e) => e.id === state.lockId) ?? enemies[0]
    const y = lock ? lock.y : XOE_Y + 20
    shots.push({ id: `s${nextId++}`, x: XOE_X - 18, y, vx: -260, from: "xoe" })
  }

  const hits = new Set<string>()
  const deadShots = new Set<string>()
  for (const shot of shots) {
    for (const en of enemies) {
      if (hits.has(en.id) || deadShots.has(shot.id)) continue
      if (Math.hypot(shot.x - en.x, shot.y - en.y) < 16) {
        hits.add(en.id)
        deadShots.add(shot.id)
      }
    }
  }
  enemies = enemies
    .map((e) => (hits.has(e.id) ? { ...e, hp: e.hp - 1 } : e))
    .filter((e) => e.hp > 0 && e.x > -20 && e.x < ARENA_W + 20)
  shots = shots.filter((s) => !deadShots.has(s.id) && s.x > -20 && s.x < ARENA_W + 24)

  for (const en of enemies) {
    if (Math.hypot(en.x - SHIP_X, en.y - shipY) < 18) {
      shield = Math.max(0, shield - (reduced ? 4 : 8))
      flash = true
    }
  }
  enemies = enemies.filter((e) => Math.hypot(e.x - SHIP_X, e.y - shipY) >= 18)

  if (spawnIn <= 0) {
    spawnIn = spawnDelay(vol, difficulty, state.eased, reduced, redDay)
    const y = 28 + Math.random() * (ARENA_H - 56)
    enemies.push({
      id: `e${nextId++}`,
      x: ARENA_W + 12,
      y,
      vx: -enemySpeed(difficulty, state.eased, reduced, redDay),
      hp: difficulty === "hard" ? 2 : 1,
    })
  }

  if (shield <= 0) {
    // Sim only: the ship re-forms with a full shield. No ledger, cap, or reward change.
    shield = SHIELD_MAX
    flash = true
    enemies = []
  }

  const lock = enemies.reduce<ArenaEnemy | null>((best, en) => {
    if (!best) return en
    return Math.abs(en.y - shipY) < Math.abs(best.y - shipY) ? en : best
  }, null)

  return {
    ...state,
    shipY,
    bounce,
    shield,
    enemies,
    shots,
    lockId: lock?.id ?? null,
    flash,
    nextId,
    spawnIn,
    lastPrice: price,
    tradeKick,
  }
}

export function applyTradeImpulse(state: ArenaState, impulse: TradeImpulse | null): ArenaState {
  if (!impulse) return state
  const kick = impulse === "short" || impulse === "cover" ? 1 : impulse === "reverse" ? (state.tradeKick >= 0 ? -1 : 1) : -1
  return {
    ...state,
    bounce: 1,
    tradeKick: kick,
    flash: impulse === "close" || impulse === "cover" || impulse === "reverse",
  }
}

export function toggleArenaPaused(state: ArenaState): ArenaState {
  return { ...state, paused: !state.paused }
}

export function toggleArenaEased(state: ArenaState): ArenaState {
  return { ...state, eased: !state.eased }
}
