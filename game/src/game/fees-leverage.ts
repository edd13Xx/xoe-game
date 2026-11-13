/**
 * v18 bonus lesson: "Fees and leverage". Arcade style (fly into the right gate), 6 short steps.
 *
 * EDUCATION ONLY · sim and testnet · not financial advice. Every number is an in-game sim
 * example (sim USD on testnet XOE), never a real account. There is NO real leverage trading
 * in the game; the optional preview below is pure math on sim numbers.
 *
 * Optional bonus: not one of the 10 story colonies, not needed for the moons, and it never
 * changes XOE balances or the daily caps (arcade points only).
 */
import type { ArcadeGate, ArcadePickup, ColonyChoice, ColonyLesson } from "./colonies.ts"

export const FEES_LEVERAGE_ID = "fees-leverage"
export const FEES_LEVERAGE_NAME = "Fees and leverage"
export const FEES_LEVERAGE_LABEL = "Education only · sim and testnet · not financial advice"

/** The one sim example every step uses. Numbers are checked in fees-leverage.test.ts. */
export const SIM_EXAMPLE = {
  /** Trade size (position value) in sim USD. v18.3: small friendly numbers (was ten times bigger). */
  position: 100,
  /** Fee per side, in percent of the position. */
  feePct: 0.12,
  /** Leverage for the margin steps. */
  leverage: 5,
  /** Your own money put up at 5X: 100 / 5. */
  margin: 20,
  /** Extra cushion money for the cushion step. */
  cushion: 10,
  /** Smaller trade for the "smaller trades" step. */
  smallPosition: 50,
  /** Price move for the "2% move" step. */
  movePct: 2,
} as const

export interface FeesLeverageStep extends ColonyLesson {
  step: number
}

interface StepDef {
  title: string
  lesson: string
  question: string
  right: string
  wrong: [string, string]
  /** Lane of the right gate (0–2) so the answer is not always in the same spot. */
  rightLane: 0 | 1 | 2
  teach: string
  tip: string
}

const E = SIM_EXAMPLE
const LABEL = `${FEES_LEVERAGE_LABEL}.`

const STEPS: readonly StepDef[] = [
  {
    title: "Fees to open and close",
    lesson: `Every trade pays a fee to open and a fee to close. ${LABEL}`,
    question: "When do you pay a trading fee?",
    right: "To open AND to close",
    wrong: ["Only when you win", "Only to open"],
    rightLane: 1,
    teach: "Fees are paid twice: once to open and once to close. That is the round trip.",
    tip: "XO: Two fees per trade. Count both before you click.",
  },
  {
    title: "Break-even",
    lesson: `Break-even (back to zero) = fees ÷ size: $0.24 ÷ $100 = 0.24%. ${LABEL}`,
    question: "Fees are $0.24 round trip on a $100 sim trade. What move just breaks even?",
    right: "About 0.24%",
    wrong: ["About 0.12%", "0% — fees don't count"],
    rightLane: 0,
    teach: "Break-even = round-trip fees ÷ trade size. $0.24 ÷ $100 ≈ 0.24%.",
    tip: "XO: Perp funding fees while you hold push it a bit higher — about 0.3% is a safer number.",
  },
  {
    title: "Leverage multiplies",
    lesson: `At ${E.leverage}X, leverage (borrowed power, bigger swings) turns 2% into 10%. ${LABEL}`,
    question: "At 5X, price moves 2%. How much does the money you put up change?",
    right: "About 10%, up or down",
    wrong: ["Only 2%", "Only up, never down"],
    rightLane: 2,
    teach: "Leverage multiplies both ways: at 5X, a 2% move is about 10% of your money.",
    tip: "XO: 5X makes a small move feel big. That cuts both ways.",
  },
  {
    title: "Liquidation",
    lesson: `At ${E.leverage}X, about a 20% drop means liquidation (the trade gets closed). ${LABEL}`,
    question: "At 5X, about how big a price drop wipes out your money?",
    right: "About 20%",
    wrong: ["About 50%", "It can't happen"],
    rightLane: 1,
    teach: "At 5X, about a 20% drop can liquidate the trade (100% ÷ 5 = 20%).",
    tip: "XO: Higher leverage means a smaller drop wipes you out. 10X is about 10%.",
  },
  {
    title: "Cushion",
    lesson: `A cushion (extra money behind the trade) pushes the wipe-out further away. ${LABEL}`,
    question: "You add a cushion behind a 5X trade. What changes?",
    right: "Wipe-out is further away",
    wrong: ["Your wins get bigger", "The cushion can't be lost"],
    rightLane: 0,
    teach: "A cushion delays liquidation. It does not raise your gains, and it can be lost too.",
    tip: "XO: A cushion buys time, not profit.",
  },
  {
    title: "Smaller trades",
    lesson: `Smaller trades are safer, not easier. Break-even stays 0.24%. ${LABEL}`,
    question: "You cut your trade size from $100 to $50. What is true?",
    right: "Safer, not easier",
    wrong: ["Fees disappear", "Break-even gets easier"],
    rightLane: 2,
    teach: "Smaller trades are safer, not easier: break-even stays about 0.24% at any size.",
    tip: "XO: Small size limits damage. It doesn't lower the bar to win.",
  },
] as const

export const FEES_LEVERAGE_STEPS = STEPS.length

function gatesFor(def: StepDef): ArcadeGate[] {
  const lanes = [0, 1, 2].filter((l) => l !== def.rightLane)
  return [
    { label: def.right, ok: true, lane: def.rightLane },
    { label: def.wrong[0], ok: false, lane: lanes[0]! },
    { label: def.wrong[1], ok: false, lane: lanes[1]! },
  ]
}

export function feesLeverageStepId(step: number): string {
  return `${FEES_LEVERAGE_ID}:${step}`
}

export function isFeesLeverageId(id: string | null | undefined): boolean {
  return !!id && (id === FEES_LEVERAGE_ID || id.startsWith(`${FEES_LEVERAGE_ID}:`))
}

/** Step index from an id ("fees-leverage" → 0, "fees-leverage:3" → 3); null if not this lesson. */
export function feesLeverageStepOf(id: string | null | undefined): number | null {
  if (!isFeesLeverageId(id)) return null
  const raw = id!.split(":")[1]
  const n = raw == null ? 0 : Number(raw)
  if (!Number.isInteger(n) || n < 0 || n >= STEPS.length) return null
  return n
}

export function buildFeesLeverageStep(step: number): FeesLeverageStep | null {
  const def = STEPS[step]
  if (!def) return null
  const choices: ColonyChoice[] = [
    { text: def.right, ok: true },
    { text: def.wrong[0], ok: false },
    { text: def.wrong[1], ok: false },
  ]
  const pickups: ArcadePickup[] = [{ label: "XO tip", lane: (def.rightLane + 1) % 3, xoeLine: def.tip }]
  return {
    id: feesLeverageStepId(step),
    step,
    name: `${FEES_LEVERAGE_NAME} · ${step + 1}/${STEPS.length} · ${def.title}`,
    lesson: def.lesson,
    question: def.question,
    choices,
    gates: gatesFor(def),
    pickups,
    teach: def.teach,
  }
}

export const FEES_LEVERAGE_DONE =
  "Fees and leverage clear. Fees twice, break-even about 0.24%, 5X makes 2% into 10%, about 20% down wipes out 5X, a cushion buys time, small is safer not easier. " +
  LABEL

// ---------------------------------------------------------------------------
// Optional sim leverage preview (pure math, no trading).
// ---------------------------------------------------------------------------

export interface LeveragePreviewInput {
  /** Your own money (sim USD). */
  margin: number
  leverage: number
  /** Price move in percent (e.g. 2 or -20). */
  movePct: number
  /** Fee per side in percent. */
  feePct?: number
  /** Extra cushion money (sim USD). */
  cushion?: number
}

export interface LeveragePreview {
  position: number
  roundTripFees: number
  breakEvenPct: number
  /** Price change in sim USD before fees. */
  grossPnl: number
  /** After round-trip fees, never below losing everything you put in. */
  netPnl: number
  /** Net result as a percent of your margin. */
  pctOfMargin: number
  /** About how far price can drop before wipe-out (ignores fees). */
  wipeOutDropPct: number
  wipedOut: boolean
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function leveragePreview(input: LeveragePreviewInput): LeveragePreview {
  const feePct = input.feePct ?? SIM_EXAMPLE.feePct
  const cushion = Math.max(0, input.cushion ?? 0)
  const margin = Math.max(0, input.margin)
  const leverage = Math.max(1, input.leverage)
  const position = margin * leverage
  // Taught rule of thumb: fee on the open + fee on the close, both on the trade size.
  const roundTripFees = (position * feePct * 2) / 100
  const breakEvenPct = position > 0 ? (roundTripFees / position) * 100 : 0
  const grossPnl = (position * input.movePct) / 100
  const backing = margin + cushion
  const wipeOutDropPct = position > 0 ? (backing / position) * 100 : 0
  const wipedOut = input.movePct <= -wipeOutDropPct
  const netPnl = wipedOut ? -backing : Math.max(-backing, grossPnl - roundTripFees)
  return {
    position: r2(position),
    roundTripFees: r2(roundTripFees),
    breakEvenPct: r2(breakEvenPct),
    grossPnl: r2(grossPnl),
    netPnl: r2(netPnl),
    pctOfMargin: margin > 0 ? r2((netPnl / margin) * 100) : 0,
    wipeOutDropPct: r2(wipeOutDropPct),
    wipedOut,
  }
}

/** Plain-words line for the preview panel. */
export function leveragePreviewLine(p: LeveragePreview, input: LeveragePreviewInput): string {
  const sign = (n: number) => (n >= 0 ? `+$${n.toFixed(2)}` : `−$${Math.abs(n).toFixed(2)}`)
  const move = `${input.movePct >= 0 ? "+" : ""}${input.movePct}%`
  if (p.wipedOut) {
    return `${input.leverage}X, price ${move}: wiped out (liquidated). You lose ${sign(p.netPnl).slice(1)} sim. Wipe-out was about a ${p.wipeOutDropPct.toFixed(0)}% drop.`
  }
  return `${input.leverage}X on $${p.position.toFixed(0)} sim, price ${move}: ${sign(p.grossPnl)} before fees, ${sign(p.netPnl)} after $${p.roundTripFees.toFixed(2)} fees (${p.pctOfMargin >= 0 ? "+" : ""}${p.pctOfMargin.toFixed(1)}% of your money). Wipe-out ≈ ${p.wipeOutDropPct.toFixed(0)}% drop.`
}
