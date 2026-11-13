/**
 * v15 economy display (Eddie, Nov 9 2026). The ledger stays in XOE stroops (reward-plan.ts).
 * The player sees SIMULATED USD at a fixed game-only rate. This is NOT a price: never fetched,
 * never a real market value, no cash value, testnet. The XOE/USD sim ticker floats around this rate for gameplay only.
 */
export const SIM_USD_PER_XOE = 10
/** One switch: "sim-usd" (default, Eddie's pick) or "xoe". */
export const ECONOMY_DISPLAY_UNIT: "sim-usd" | "xoe" = "sim-usd"
export const STROOPS_PER_XOE = 10_000_000
export const SIM_USD_NOTE = "Simulated USD for gameplay only. Not a price. No cash value. Testnet."
export const SIM_TAG = "sim"

/** Stroops → simulated dollars (exact rational, no float drift until display). */
export const stroopsToSimUsd = (stroops: number) => (stroops * SIM_USD_PER_XOE) / STROOPS_PER_XOE

/**
 * "$0.025 sim", "$44.44 sim", "$1,234.50 sim". Rounded to the nearest $0.001; shows 3 decimals only
 * when there is a sub-cent part, else 2. A tiny non-zero amount shows "<$0.001 sim".
 */
export function formatSimUsd(stroops: number, sign = false): string {
  const neg = stroops < 0
  const abs = Math.abs(stroops)
  const mills = Math.round((abs * SIM_USD_PER_XOE) / 10_000) // 1 mill = $0.001 = 1,000 stroops at $10/XOE
  const pre = neg ? "-" : sign ? "+" : ""
  // Tiny non-zero: "<$0.001 sim" or "-<$0.001 sim" — never "+<" which reads as a typo.
  if (abs > 0 && mills === 0) return `${neg ? "- " : ""}<$0.001 ${SIM_TAG}`
  const dollars = mills / 1000
  const digits = mills % 10 === 0 ? 2 : 3
  return `${pre}$${dollars.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${SIM_TAG}`
}

/** XOE with 7 decimals (smallest unit 0.0000001). */
export function formatXoe7(stroops: number, sign = false): string {
  const neg = stroops < 0
  const abs = Math.abs(Math.trunc(stroops))
  const whole = Math.floor(abs / STROOPS_PER_XOE).toLocaleString("en-US")
  const frac = String(abs % STROOPS_PER_XOE).padStart(7, "0")
  return `${neg ? "-" : sign ? "+" : ""}${whole}.${frac} XOE`
}

/** Player-facing amount in the configured unit. */
export const formatPlay = (stroops: number, sign = false) =>
  ECONOMY_DISPLAY_UNIT === "sim-usd" ? formatSimUsd(stroops, sign) : formatXoe7(stroops, sign)

/** Tight HUD amounts: "$0.00" / "+0.0025000" without the trailing unit, so a chip can show one "sim" (or "XOE") at the end. */
export const formatPlayAmount = (stroops: number, sign = false) =>
  ECONOMY_DISPLAY_UNIT === "sim-usd"
    ? formatPlay(stroops, sign).replace(new RegExp(`\\s+${SIM_TAG}$`), "")
    : formatPlay(stroops, sign).replace(/\s+XOE$/, "")

export const PLAY_UNIT = ECONOMY_DISPLAY_UNIT === "sim-usd" ? SIM_TAG : "XOE"

/** Economy-panel rows: label → ledger source keys. */
export const ECONOMY_SOURCES: { label: string; keys: string[] }[] = [
  { label: "XOE coins", keys: ["coin"] },
  { label: "Colony clears", keys: ["colony_clear"] },
  { label: "Fights", keys: ["fight_win"] },
  { label: "Lessons & practice", keys: ["lesson", "daily_practice"] },
  { label: "Side missions", keys: ["side_mission"] },
  { label: "Trade P/L", keys: ["trade"] },
  { label: "Milestones", keys: ["milestone"] },
]
export const sumSources = (bySource: Record<string, number>, keys: readonly string[]) =>
  keys.reduce((a, k) => a + (bySource[k] ?? 0), 0)

/** Sim $ from a USD amount (trade desk P/L). Same tiny-P/L rule as formatSimUsd. */
export function formatPnlSim(usd: number, sign = true): string {
  const stroops = Math.round((usd * STROOPS_PER_XOE) / SIM_USD_PER_XOE)
  return formatSimUsd(stroops, sign)
}
