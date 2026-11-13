/**
 * v16 XOE trade practice: buy/sell XOE at the live XOE/USD sim price.
 * Replaces the 4 mock prints. Session P/L can change the testnet ledger
 * (gains through the daily cap, losses cut unclaimed but never below 0).
 * Never real money. Claim stays off.
 */
import {
  STARTING_XOE,
  XOE_UNIT,
  applyBadMove,
  applyGoodMove,
  applyMarkCheck,
  beginDeath,
  flattenPosition,
  initialXoeRun,
  liquidationPrice,
  liquidationPriceLabel,
  openOrAddPosition,
  resolveDeath,
  wasGoodDirection,
  type XoeRunState,
} from "./xoe-lifeblood.ts"
import { STROOPS_PER_XOE, SIM_USD_PER_XOE, formatPnlSim as formatPnlSimRaw, formatXoe7 } from "./economy.ts"
import { XOE_SIM_ANCHOR, XOE_SIM_LABEL, XOE_SIM_SAFETY, clampXoeSimPrice } from "./xoe-sim-price.ts"
/** Sim ticker numbers are plain numbers: no dollar sign (hard rule). */
const formatPnlSim = (n: number, sign = true): string => formatPnlSimRaw(n, sign).replace(/\$/g, "")

/** 0.1 XOE per tap — small enough to stay inside daily caps. */
export const TRADE_LOT_STROOPS = 1_000_000
/** Sim USD buying power for the desk (counted in start and end mark, never gifted as XOE). */
export const PRACTICE_CASH_USD = 20
/** If the player has no unclaimed XOE, they get this session lot (not minted unless they profit). */
export const PRACTICE_LOT_STROOPS = TRADE_LOT_STROOPS

export const PAPER_FIXTURE = {
  label: "XOE",
  simulation: true,
  mock: false,
  canonicalPrice: false,
  marketQuote: false,
  network: false,
  realFunds: false,
  startingCash: PRACTICE_CASH_USD,
  startingXoe: STARTING_XOE,
  unit: XOE_UNIT,
  lotStroops: TRADE_LOT_STROOPS,
  /** Kept empty: v16 uses the live sim ticker, not a fixed print list. */
  prints: [] as readonly number[],
} as const

export type PaperAction = "buy" | "sell"
export type PaperOutcome = "paper-up" | "paper-down" | "paper-exit" | "liquidated"

export interface PracticeState {
  step: number
  /** Sim USD cash on the trade desk. */
  cash: number
  /** Net XOE lots (+ long / − unused; holdings are in xoeStroops). */
  position: number
  outcome: PaperOutcome | null
  xoe: XoeRunState
  price: number
  xoeStroops: number
  startXoeStroops: number
  startCash: number
  startPrice: number
  practiceLot: number
  lastAction: PaperAction | null
  lastFillPrice: number | null
}

export function lotCostUsd(price: number, lots = 1): number {
  return lots * (TRADE_LOT_STROOPS / STROOPS_PER_XOE) * clampXoeSimPrice(price)
}

export function initialPractice(
  opts: { unclaimedStroops?: number; price?: number } = {},
): PracticeState {
  const price = clampXoeSimPrice(opts.price ?? XOE_SIM_ANCHOR)
  const unclaimed = Math.max(0, Math.trunc(opts.unclaimedStroops ?? 0))
  const practiceLot = unclaimed > 0 ? 0 : PRACTICE_LOT_STROOPS
  const xoeStroops = unclaimed + practiceLot
  return {
    step: 0,
    cash: PRACTICE_CASH_USD,
    position: 0,
    outcome: null,
    xoe: initialXoeRun(PAPER_FIXTURE.startingXoe),
    price,
    xoeStroops,
    startXoeStroops: xoeStroops,
    startCash: PRACTICE_CASH_USD,
    startPrice: price,
    practiceLot,
    lastAction: null,
    lastFillPrice: null,
  }
}

/** Mark in sim USD: desk cash + XOE holdings × live sim price. */
export function paperMark(state: PracticeState, price = state.price): number {
  const p = clampXoeSimPrice(price)
  return state.cash + (state.xoeStroops / STROOPS_PER_XOE) * p
}

export function startMark(state: PracticeState): number {
  return state.startCash + (state.startXoeStroops / STROOPS_PER_XOE) * state.startPrice
}

/** Session P/L in sim USD. */
export function paperResult(state: PracticeState, price = state.price): number {
  return paperMark(state, price) - startMark(state)
}

/** Session P/L in stroops, using the live sim price (never ≤ −unclaimed after settle). */
export function paperResultStroops(state: PracticeState, price = state.price): number {
  const p = clampXoeSimPrice(price)
  return Math.round((paperResult(state, p) / p) * STROOPS_PER_XOE)
}

export function currentPrint(state: PracticeState): number {
  return clampXoeSimPrice(state.price)
}

export function currentPrice(state: PracticeState): number {
  return currentPrint(state)
}

export function paperFormulaLine(state: PracticeState): string {
  const price = currentPrice(state)
  const pnl = paperResult(state, price)
  const xoe = state.xoeStroops / STROOPS_PER_XOE
  return `P/L ${formatPnlSim(pnl, true)} · ${xoe.toFixed(2)} XOE · cash ${formatPnlSim(state.cash, false)} · price ${formatPnlSim(price, false)}. ${XOE_SIM_SAFETY}.`
}

export function canBuy(state: PracticeState, price = state.price): boolean {
  if (state.outcome !== null) return false
  if (state.xoe.deathPhase === "dying" || state.xoe.deathPhase === "gameover") return false
  const p = clampXoeSimPrice(price)
  return state.cash + 1e-9 >= lotCostUsd(p)
}

export function canSell(state: PracticeState, _price = state.price): boolean {
  if (state.outcome !== null) return false
  if (state.xoe.deathPhase === "dying" || state.xoe.deathPhase === "gameover") return false
  return state.xoeStroops >= TRADE_LOT_STROOPS
}

export function activeLiquidationLabel(state: PracticeState): string | null {
  const x = state.xoe
  if (x.side === "flat" || x.entry === null) return null
  return liquidationPriceLabel(x.entry, x.side)
}

export function activeLiquidationPrice(state: PracticeState): number | null {
  const x = state.xoe
  if (x.side === "flat" || x.entry === null) return null
  return liquidationPrice(x.entry, x.side)
}

export function applyPaperAction(
  state: PracticeState,
  action: PaperAction,
  price = state.price,
): PracticeState {
  if (state.outcome !== null) return state
  if (state.xoe.deathPhase === "dying" || state.xoe.deathPhase === "gameover") return state
  const print = clampXoeSimPrice(price)
  const cost = lotCostUsd(print)
  let next: PracticeState = { ...state, price: print }

  if (action === "buy") {
    if (next.cash < cost) return state
    next = {
      ...next,
      cash: next.cash - cost,
      xoeStroops: next.xoeStroops + TRADE_LOT_STROOPS,
      position: next.position + 1,
      xoe: openOrAddPosition(next.xoe, "long", print),
      lastAction: "buy",
      lastFillPrice: print,
      step: next.step + 1,
    }
  } else {
    if (next.xoeStroops < TRADE_LOT_STROOPS) return state
    // Selling inventory never opens a short; position is session-long lots only.
    const pos = Math.max(0, next.position - 1)
    next = {
      ...next,
      cash: next.cash + cost,
      xoeStroops: next.xoeStroops - TRADE_LOT_STROOPS,
      position: pos,
      xoe: pos > 0 ? next.xoe : flattenPosition(next.xoe),
      lastAction: "sell",
      lastFillPrice: print,
      step: next.step + 1,
    }
  }
  return next
}

/** Apply a new live sim price: mark check, good/bad combat beat, possible liquidation. */
export function applyPracticeTick(state: PracticeState, price: number, nowMs = 0): PracticeState {
  if (state.outcome !== null) return state
  if (state.xoe.deathPhase === "dying" || state.xoe.deathPhase === "gameover") {
    return settlePractice({ ...state, price: clampXoeSimPrice(price) }, nowMs)
  }
  const print = clampXoeSimPrice(price)
  if (print === state.price) return state
  const prev = state.price
  let next: PracticeState = { ...state, price: print }
  // Combat beats only track an open session long. Selling holdings is not a short.
  if (state.xoe.side === "long" && state.lastAction === "buy" && state.lastFillPrice != null && print !== prev) {
    const good = wasGoodDirection("long", prev, print)
    if (good === true) next = { ...next, xoe: applyGoodMove(next.xoe) }
    else if (good === false) next = { ...next, xoe: applyBadMove(next.xoe, nowMs) }
  }
  if (next.xoe.side === "long") {
    next = { ...next, xoe: applyMarkCheck(next.xoe, print, nowMs) }
  }
  if (next.position === 0 && next.xoe.deathPhase === "alive") {
    next = { ...next, xoe: flattenPosition(next.xoe) }
  }
  return settlePractice(next, nowMs)
}

export function advancePracticeDeath(state: PracticeState, nowMs = Date.now()): PracticeState {
  if (state.xoe.deathPhase !== "dying") return state
  const xoe = resolveDeath(state.xoe, nowMs)
  if (xoe.deathPhase === "gameover") {
    return { ...state, xoe, outcome: "liquidated", position: 0 }
  }
  return {
    ...state,
    cash: state.startCash,
    position: 0,
    xoeStroops: state.startXoeStroops,
    xoe,
    outcome: null,
    lastAction: null,
    lastFillPrice: null,
  }
}

export function forcePracticeLiquidation(state: PracticeState): PracticeState {
  return settlePractice({ ...state, xoe: beginDeath(state.xoe) })
}

function settlePractice(state: PracticeState, nowMs = 0): PracticeState {
  if (state.xoe.deathPhase === "dying") {
    const resolved = resolveDeath(state.xoe, nowMs)
    if (resolved.deathPhase === "gameover") {
      return { ...state, xoe: resolved, outcome: "liquidated", position: 0 }
    }
    return {
      ...state,
      cash: state.startCash,
      position: 0,
      xoeStroops: state.startXoeStroops,
      xoe: { ...resolved, deathPhase: "alive", invincibleUntilMs: null, rechargeUntilMs: null },
      outcome: null,
      lastAction: null,
      lastFillPrice: null,
    }
  }
  if (state.xoe.deathPhase === "gameover" || (state.xoe.liquidated && state.xoe.lives <= 0)) {
    return { ...state, outcome: "liquidated" }
  }
  return { ...state, outcome: null }
}

/** Close the session and set paper-up / paper-down from P/L. */
export function finalizePractice(state: PracticeState, price = state.price): PracticeState {
  if (state.outcome === "liquidated" || state.outcome === "paper-exit") return state
  const pnl = paperResult(state, price)
  return { ...state, price: clampXoeSimPrice(price), outcome: pnl > 0 ? "paper-up" : "paper-down" }
}

export function practiceRulesForCosmetic(cosmeticId: string) {
  return cosmeticId.length > 0 ? PAPER_FIXTURE : PAPER_FIXTURE
}

/**
 * Helper for tests: each action fills at prices[i], then the book marks to prices[i+1].
 * Default path makes buy/sell/buy/sell a win and sell/buy/sell/buy a loss.
 */
export const DEFAULT_TEST_PRICES = [10, 10.2, 9.85, 10.4, 10.15] as const

export function runPractice(
  actions: readonly PaperAction[],
  prices: readonly number[] = DEFAULT_TEST_PRICES,
  start?: { unclaimedStroops?: number; price?: number },
): PracticeState {
  let state = initialPractice({ price: prices[0], ...start })
  for (let i = 0; i < actions.length; i += 1) {
    const fill = prices[i] ?? state.price
    state = applyPaperAction(state, actions[i]!, fill)
    const nextPrice = prices[i + 1]
    if (nextPrice != null) state = applyPracticeTick(state, nextPrice)
  }
  if (state.outcome == null) state = finalizePractice(state)
  return state
}

export function formatTradeLine(state: PracticeState): { xoe: string; usd: string; pnl: string } {
  return {
    xoe: formatXoe7(state.xoeStroops),
    usd: `${paperMark(state).toFixed(2)} sim`,
    pnl: `${formatPnlSim(paperResult(state), true)} (${formatXoe7(paperResultStroops(state), true)})`,
  }
}

export const TRADE_DISCLAIMER = `${XOE_SIM_SAFETY}. ${XOE_SIM_LABEL}. Game-only display rate starts at ${SIM_USD_PER_XOE}.00 sim.`
