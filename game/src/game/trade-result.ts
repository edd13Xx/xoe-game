/**
 * v18.3 (XOE-004, Eddie's locked spec 11:36 AM CT + 11:38 refinement): the trade result card.
 *
 * Shown ONLY after a sim trade closes. Never during a trade, never blocks a trade.
 * All money math is integer cents (no float drift). Every number on the card adds up:
 *   net = moveAt1x + leverageEffect − roundTripFees − funding
 *
 * Loss tip rules, checked in this order (first match wins):
 *   (1) fees ≥ 50% of the loss              → "Fees ate $X of your $Y loss."
 *   (2) loss mostly from the move, leverage > 1x → "Leverage … made a Z% move cost $Y."
 *   (3) liquidated                          → "Liquidated … the move hit your limit."
 *   (4) no stop loss and loss > 5%          → "A stop loss … could have capped this."
 *   none of the 4 (XO 12:56 PM CT)         → "The price moved against your trade."
 * Win tip (Eddie 11:38 AM CT): names the biggest cause with real numbers:
 *   fees > 0      → "Fees took $X of your $Y win."  (Y = win before fees, net = Y − X)
 *   leverage > 1x → "Leverage … made a Z% move win $Y."
 *   otherwise     → "The price moved your way; this desk has no fees."
 *   net exactly 0 → "No gain, no loss: the price ended where it started."
 * Each tip + "Learn more." is 12 words or fewer; jargon gets a 3–5 word plain explanation.
 * Max 1 tip per trade. Details always lists every number (11:38 "always include everything").
 * Sim money only: Testnet XOE · no real money.
 */
import type { FaqId } from "./faq.ts"
import { wordCount } from "./faq.ts"
import { XOE_SIM_SAFETY } from "./xoe-sim-price.ts"
import type { PracticeState } from "./practice.ts"
import { TRADE_LOT_STROOPS } from "./practice.ts"
import { STROOPS_PER_XOE } from "./economy.ts"

export type LossCause = "fees" | "leverage" | "liquidation" | "stop-loss" | "move"
export type WinCause = "win-fees" | "win-leverage" | "win" | "flat"
export type TipCause = LossCause | WinCause

export interface ClosedTrade {
  /** Long = bought first; short = sold first. The move is signed for the side. */
  side: "long" | "short"
  /** Position value at the open, integer cents (what you bought). */
  entryCents: number
  /** Position value at the close, integer cents (what you sold it for, or the mark at liquidation). */
  exitCents: number
  /** Fee to open, integer cents. */
  openFeeCents: number
  /** Fee to close, integer cents. */
  closeFeeCents: number
  /** Funding paid while holding, integer cents. */
  fundingCents: number
  /** Whole-number leverage, 1 = no leverage. */
  leverage: number
  liquidated: boolean
  hadStopLoss: boolean
  /** Did the stop loss close the trade? (false when there was none) */
  stopLossHit?: boolean
  hadTakeProfit?: boolean
  takeProfitHit?: boolean
  /** Size in XOE (for the details line only), e.g. "0.1". */
  sizeLabel: string
  /** Average fill prices in integer mills ($0.001), the sim price's own precision. */
  entryPriceMills: number
  exitPriceMills: number
}

export interface TradeBreakdown {
  /** Your own money in the trade: entry ÷ leverage (cents, rounded). */
  marginCents: number
  /** Price move on the position (exit − entry), cents. Negative = against you. */
  moveCents: number
  /** The part of the move your own money would see at 1x (cents). */
  moveAt1xCents: number
  /** Extra from leverage: moveCents − moveAt1xCents (cents). */
  leverageEffectCents: number
  roundTripFeeCents: number
  fundingCents: number
  /** All fees: round trip + funding (cents). */
  feesCents: number
  /** Net result (cents). Negative = loss. */
  netCents: number
  /** Price move in basis points (1% = 100), absolute. */
  moveBps: number
  /** Net result as basis points of your own money in (signed). */
  netBps: number
}

export interface TradeTip {
  cause: TipCause
  /** The tip sentence, without "Learn more." */
  text: string
  faq: FaqId
  /** Numbers that must appear unchanged in any reworded tip. */
  numbers: string[]
}

export const LEARN_MORE = "Learn more."
/** Store key for the running fee total (device-local, same storage as the other xoe.* keys). */
export const FEES_SO_FAR_KEY = "xoe.feesSoFar.v1"
export const TIP_MAX_WORDS = 12

const int = (n: number) => (Number.isFinite(n) ? Math.round(n) : 0)

/** "$1.05" from 105 cents (absolute). Exact: integer cents only. */
export function dollars(cents: number): string {
  const c = Math.abs(int(cents))
  return `$${Math.floor(c / 100)}.${String(c % 100).padStart(2, "0")}`
}

/** "$9.950" from integer mills. */
export function price3(mills: number): string {
  const m = Math.abs(int(mills))
  return `$${Math.floor(m / 1000)}.${String(m % 1000).padStart(3, "0")}`
}

/** "2%" / "0.6%" / "1.25%" from basis points. */
export function pct(bps: number): string {
  const b = Math.abs(int(bps))
  const whole = Math.floor(b / 100)
  const frac = String(b % 100).padStart(2, "0").replace(/0+$/, "")
  return `${whole}${frac ? `.${frac}` : ""}%`
}

/** Round a sim price fill to integer cents for one lot (size in XOE as a fraction of 1). */
export function fillCents(price: number, sizeXoe: number): number {
  return int(price * sizeXoe * 100)
}

/** A fill's value in integer 1/10,000ths of a dollar (exact at the sim price's 3-decimal precision for 0.1 XOE lots). */
export function fillUnits(price: number, sizeXoe: number): number {
  return int(price * sizeXoe * 10_000)
}
/** Round a fill-value total (1/10,000 $) to cents ONCE, at the close. */
export const unitsToCents = (units: number) => int(units / 100)

export function breakdown(t: ClosedTrade): TradeBreakdown {
  const lev = Math.max(1, Math.floor(t.leverage) || 1)
  const entry = int(t.entryCents)
  const exit = int(t.exitCents)
  const moveCents = t.side === "short" ? entry - exit : exit - entry
  const moveAt1xCents = int(moveCents / lev)
  const leverageEffectCents = moveCents - moveAt1xCents
  const roundTripFeeCents = int(t.openFeeCents) + int(t.closeFeeCents)
  const fundingCents = int(t.fundingCents)
  const feesCents = roundTripFeeCents + fundingCents
  const netCents = moveCents - feesCents
  const marginCents = int(entry / lev)
  // v18.3 fix: the move % comes from the SAME cent amounts as the card's dollars (not the avg prices),
  // so at 1x with $0 fees the net % equals the move % exactly.
  const moveBps = entry > 0 ? int((Math.abs(exit - entry) * 10_000) / entry) : 0
  const netBps = marginCents > 0 ? int((netCents * 10_000) / marginCents) : 0
  return { marginCents, moveCents, moveAt1xCents, leverageEffectCents, roundTripFeeCents, fundingCents, feesCents, netCents, moveBps, netBps }
}

const TIP_TEXT = {
  fees: (x: string, y: string) => `Fees ate ${x} of your ${y} loss.`,
  leverage: (z: string, y: string) => `Leverage (borrowed, bigger swings) made a ${z} move cost ${y}.`,
  liquidation: () => "Liquidated (the game closed it): the move hit your limit.",
  stopLoss: () => "A stop loss (auto-sells at limit) could have capped this.",
  move: () => "The price moved against your trade.",
  winFees: (x: string, y: string) => `Fees took ${x} of your ${y} win.`,
  winLeverage: (z: string, y: string) => `Leverage (borrowed, bigger swings) made a ${z} move win ${y}.`,
  win: () => "The price moved your way; this desk has no fees.",
  flat: () => "No gain, no loss: the price ended where it started.",
}

/** The one tip for a WIN (or break-even), naming the biggest cause with real numbers. Null for a loss. */
export function winTip(t: ClosedTrade): TradeTip | null {
  const b = breakdown(t)
  if (b.netCents < 0) return null
  const lev = Math.max(1, Math.floor(t.leverage) || 1)
  if (b.feesCents > 0) {
    const x = dollars(b.feesCents)
    const y = dollars(b.moveCents) // the win before fees; net = y − x
    return { cause: "win-fees", text: TIP_TEXT.winFees(x, y), faq: "fees", numbers: [x, y] }
  }
  if (b.netCents === 0) return { cause: "flat", text: TIP_TEXT.flat(), faq: "fees", numbers: [] }
  if (lev > 1) {
    const z = pct(b.moveBps)
    const y = dollars(b.netCents)
    return { cause: "win-leverage", text: TIP_TEXT.winLeverage(z, y), faq: "leverage", numbers: [z, y] }
  }
  return { cause: "win", text: TIP_TEXT.win(), faq: "fees", numbers: [] }
}

/** Exactly one tip for every closed trade: the loss rules, else the win rule. */
export function resultTip(t: ClosedTrade): TradeTip {
  return lossTip(t) ?? winTip(t)!
}

/** The one tip for a closed trade, or null when it was not a loss. Rules in Eddie's order. */
export function lossTip(t: ClosedTrade): TradeTip | null {
  const b = breakdown(t)
  if (b.netCents >= 0) return null
  const loss = -b.netCents
  const lev = Math.max(1, Math.floor(t.leverage) || 1)
  // (1) fees are 50% or more of the loss
  if (b.feesCents * 2 >= loss) {
    const x = dollars(b.feesCents)
    const y = dollars(loss)
    return { cause: "fees", text: TIP_TEXT.fees(x, y), faq: "fees", numbers: [x, y] }
  }
  // (2) mostly the price move, with leverage above 1x
  const moveLoss = Math.max(0, -b.moveCents)
  if (moveLoss * 2 > loss && lev > 1) {
    const z = pct(b.moveBps)
    const y = dollars(loss)
    return { cause: "leverage", text: TIP_TEXT.leverage(z, y), faq: "leverage", numbers: [z, y] }
  }
  // (3) liquidated
  if (t.liquidated) return { cause: "liquidation", text: TIP_TEXT.liquidation(), faq: "liquidation", numbers: [] }
  // (4) no stop loss and the loss is over 5% of your own money (integer test: loss × 20 > margin)
  if (!t.hadStopLoss && loss * 20 > b.marginCents) return { cause: "stop-loss", text: TIP_TEXT.stopLoss(), faq: "stop-loss", numbers: [] }
  // Not covered by the 4 locked rules (small loss, no fees, no leverage): plain built-in line.
  return { cause: "move", text: TIP_TEXT.move(), faq: "stop-loss", numbers: [] }
}

/** Collapsed card: exactly 2 lines. */
export function resultLines(t: ClosedTrade, tip: TradeTip = resultTip(t)): [string, string] {
  const b = breakdown(t)
  const head = b.netCents < 0 ? `You lost ${dollars(b.netCents)}` : b.netCents > 0 ? `You won ${dollars(b.netCents)}` : `You broke even: $0.00`
  return [head, `${tip.text} ${LEARN_MORE}`]
}

/** Signed percent from basis points: "+2.5%" / "−3.03%". */
export function signedPct(bps: number): string {
  return `${bps < 0 ? "−" : "+"}${pct(bps)}`
}

/** Running fee total: previous total + this trade's fees (round trip + funding), integer cents. */
export function nextFeesSoFar(prevCents: number, t: ClosedTrade): number {
  return Math.max(0, int(prevCents)) + breakdown(t).feesCents
}

export function readFeesSoFar(store: { getItem: (k: string) => string | null }): number {
  try {
    const n = Number(JSON.parse(store.getItem(FEES_SO_FAR_KEY) ?? "0"))
    return Number.isFinite(n) && n > 0 ? int(n) : 0
  } catch {
    return 0
  }
}

/** Adds this trade's fees to the stored total and returns the new total (cents). */
export function addFeesSoFar(store: { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void }, t: ClosedTrade): number {
  const total = nextFeesSoFar(readFeesSoFar(store), t)
  try {
    store.setItem(FEES_SO_FAR_KEY, JSON.stringify(total))
  } catch {
    /* storage full / blocked: the card still shows the total for this trade */
  }
  return total
}

/** Expanded "Details": every number, every time (win or loss), exact, and they add up to the net. */
export function detailLines(t: ClosedTrade, feesSoFarCents: number = breakdown(t).feesCents): string[] {
  const b = breakdown(t)
  const sign = (c: number) => (c < 0 ? `−${dollars(c)}` : `+${dollars(c)}`)
  const lev = Math.max(1, Math.floor(t.leverage) || 1)
  const short = t.side === "short"
  const openVerb = short ? "sold" : "bought"
  const closeVerb = t.liquidated ? "closed by liquidation" : short ? "bought back" : "sold"
  const stop = !t.hadStopLoss ? "none" : t.stopLossHit ? "hit" : "set, not hit"
  const take = !t.hadTakeProfit ? "none" : t.takeProfitHit ? "hit" : "set, not hit"
  return [
    `Entry price: ${price3(t.entryPriceMills)} avg (${openVerb} for ${dollars(t.entryCents)}).`,
    `Exit price: ${price3(t.exitPriceMills)} avg (${closeVerb} for ${dollars(t.exitCents)}).`,
    `Price move: ${sign(b.moveCents)} (${pct(b.moveBps)} ${t.exitCents < t.entryCents ? "down" : "up"}).`,
    `Position size: ${t.sizeLabel} XOE ${short ? "short" : "long"}, ${dollars(t.entryCents)} at entry.`,
    `Leverage used (borrowed power, bigger swings): ${lev}x. Your money in: ${dollars(b.marginCents)}.`,
    `Move at 1x: ${sign(b.moveAt1xCents)} · leverage effect: ${sign(b.leverageEffectCents)}.`,
    `Round-trip fees (open + close): −${dollars(b.roundTripFeeCents)}.`,
    `Funding fees (holding fee): −${dollars(b.fundingCents)}.`,
    `Liquidated (the game closed it): ${t.liquidated ? "yes" : "no"}.`,
    `Stop loss (auto-sells at a set loss): ${stop}.`,
    `Take profit (auto-sells at a set win): ${take}.`,
    `Net: ${sign(b.netCents)} (${signedPct(b.netBps)} of your money in) = ${sign(b.moveAt1xCents)} ${sign(b.leverageEffectCents)} −${dollars(b.roundTripFeeCents)} −${dollars(b.fundingCents)}.`,
    `Fees so far: ${dollars(feesSoFarCents)}.`,
    `Totals are rounded once, to the nearest cent.`,
    `${XOE_SIM_SAFETY}.`,
  ]
}

// ---------------------------------------------------------------------------
// Grok Bot rewording (only when connected). Same cause + same numbers, 1 short sentence, else template.
// ---------------------------------------------------------------------------

export function grokTipPrompt(tip: TradeTip): string {
  const nums = tip.numbers.length ? ` Keep these exact numbers: ${tip.numbers.join(", ")}. Add no other numbers.` : " Add no numbers."
  return (
    `The player is new to trading. Explain like they are new, in 1 short sentence of ${TIP_MAX_WORDS - 2} words or fewer. ` +
    `Keep the same cause (${causeWord(tip.cause)}).${nums} It is sim money only. Reply with the sentence only. ` +
    `Reword this sim game tip: "${tip.text}"`
  )
}

const CAUSE_WORD: Record<TipCause, string> = {
  fees: "fees",
  leverage: "leverage",
  liquidation: "liquidation",
  "stop-loss": "stop loss",
  move: "price moved against the trade",
  "win-fees": "fees took part of the win",
  "win-leverage": "leverage",
  win: "price moved their way",
  flat: "no gain, no loss",
}
function causeWord(c: TipCause): string {
  return CAUSE_WORD[c]
}
const CAUSE_RE: Record<TipCause, RegExp> = {
  "win-fees": /\bfees?\b/i,
  "win-leverage": /\bleverage|borrow/i,
  win: /price|your way/i,
  flat: /gain|loss|even|price/i,
  fees: /\bfees?\b/i,
  leverage: /\bleverage|borrow/i,
  liquidation: /liquidat/i,
  "stop-loss": /stop[\s-]?loss/i,
  move: /price/i,
}
const NUM_RE = /\$?\d+(?:\.\d+)?%?/g

/** Accept Grok's reword only if it is 1 sentence, short, same cause, and exactly the same numbers. */
export function validateGrokTip(raw: string | null | undefined, tip: TradeTip): string | null {
  if (!raw) return null
  let s = raw.replace(/\s+/g, " ").trim().replace(/^["'“”]+|["'“”]+$/g, "").replace(/^XO:\s*/i, "").trim()
  s = s.replace(/\s*Learn more\.?$/i, "").trim()
  if (!s) return null
  if (/https?:|www\.|paper\s+(?:trading|only)/i.test(s)) return null
  // one sentence: at most one terminator, and only at the end
  const body = s.replace(/[.!?]+$/, "")
  if (/[.!?]\s/.test(body) || /[.!?]$/.test(body)) return null
  if (!/[.!?]$/.test(s)) s = `${s}.`
  if (wordCount(`${s} ${LEARN_MORE}`) > TIP_MAX_WORDS) return null
  if (!CAUSE_RE[tip.cause].test(s)) return null
  const got = (body.match(NUM_RE) ?? []).slice().sort()
  const want = tip.numbers.slice().sort()
  if (got.length !== want.length || got.some((g, i) => g !== want[i])) return null
  return s
}

// ---------------------------------------------------------------------------
// Close detection for the XOE sim desk (map dock + practice desk). Pure: (tracker, prev, next) → closed?
// The sim desk has no fees, no leverage (1x) and no stop loss; it DOES have Total Liquidation (−4.4%).
// ---------------------------------------------------------------------------

export const LOT_XOE = TRADE_LOT_STROOPS / STROOPS_PER_XOE

export interface TradeTracker {
  lots: number
  lotsBought: number
  lotsSold: number
  /** Fill-value sums in integer 1/10,000 $ (exact); rounded to cents once at the close. */
  entryUnits: number
  exitUnits: number
  /** Sums of fill prices in integer mills, for the average price line (display only). */
  entryMillsSum: number
  exitMillsSum: number
}
export const EMPTY_TRACKER: TradeTracker = { lots: 0, lotsBought: 0, lotsSold: 0, entryUnits: 0, exitUnits: 0, entryMillsSum: 0, exitMillsSum: 0 }

const mills = (price: number) => int(price * 1000)
const avg = (sum: number, n: number) => (n > 0 ? int(sum / n) : 0)

function closeTrade(t: TradeTracker, liquidated: boolean): ClosedTrade {
  return {
    side: "long", // the sim desk only buys first (long); shorts are supported by the math for later
    entryCents: unitsToCents(t.entryUnits),
    exitCents: unitsToCents(t.exitUnits),
    openFeeCents: 0,
    closeFeeCents: 0,
    fundingCents: 0,
    leverage: 1,
    liquidated,
    hadStopLoss: false,
    sizeLabel: String(+(t.lotsBought * LOT_XOE).toFixed(7)),
    entryPriceMills: avg(t.entryMillsSum, t.lotsBought),
    exitPriceMills: avg(t.exitMillsSum, t.lotsSold),
  }
}

/** Advance the tracker for one desk change. `closed` is set exactly once, when the position goes back to 0. */
export function trackDesk(tr: TradeTracker, prev: PracticeState, next: PracticeState): { tracker: TradeTracker; closed: ClosedTrade | null } {
  // A fresh desk (restart / new map session) drops any half-open trade without a card.
  if (next.step < prev.step) return { tracker: EMPTY_TRACKER, closed: null }
  let t = tr
  const acted = next.step > prev.step && next.lastFillPrice != null
  if (acted && next.lastAction === "buy") {
    t = { ...t, lots: t.lots + 1, lotsBought: t.lotsBought + 1, entryUnits: t.entryUnits + fillUnits(next.lastFillPrice!, LOT_XOE), entryMillsSum: t.entryMillsSum + mills(next.lastFillPrice!) }
    return { tracker: t, closed: null }
  }
  if (acted && next.lastAction === "sell" && t.lots > 0) {
    t = { ...t, lots: t.lots - 1, lotsSold: t.lotsSold + 1, exitUnits: t.exitUnits + fillUnits(next.lastFillPrice!, LOT_XOE), exitMillsSum: t.exitMillsSum + mills(next.lastFillPrice!) }
    if (t.lots === 0) return { tracker: EMPTY_TRACKER, closed: closeTrade(t, false) }
    return { tracker: t, closed: null }
  }
  const liquidated =
    t.lots > 0 &&
    (next.xoe.lives < prev.xoe.lives || (next.outcome === "liquidated" && prev.outcome !== "liquidated") || (next.xoe.liquidated && !prev.xoe.liquidated))
  if (liquidated) {
    const mark = fillUnits(next.price, LOT_XOE) * t.lots
    const done = { ...t, exitUnits: t.exitUnits + mark, exitMillsSum: t.exitMillsSum + mills(next.price) * t.lots, lotsSold: t.lotsSold + t.lots, lots: 0 }
    return { tracker: EMPTY_TRACKER, closed: closeTrade(done, true) }
  }
  return { tracker: t, closed: null }
}
