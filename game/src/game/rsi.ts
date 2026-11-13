/**
 * Simulated RSI(14) from the in-game XOE/USD (or other) sim price history.
 * Local only — not a live market indicator and not financial advice.
 */
export const RSI_PERIOD = 14

export function rsi14(prices: readonly number[], period = RSI_PERIOD): number | null {
  if (period < 1 || prices.length < period + 1) return null
  const start = prices.length - (period + 1)
  let gain = 0
  let loss = 0
  for (let i = start + 1; i <= start + period; i++) {
    const delta = prices[i]! - prices[i - 1]!
    if (delta >= 0) gain += delta
    else loss -= delta
  }
  const avgGain = gain / period
  const avgLoss = loss / period
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100
  const rs = avgGain / avgLoss
  const value = 100 - 100 / (1 + rs)
  if (!Number.isFinite(value)) return null
  return Math.max(0, Math.min(100, value))
}

/** Wilder-style rolling RSI when a previous value and the prior average parts are unknown — uses the simple window. */
export function rsiBand(value: number | null): "low" | "mid" | "high" | "warming" {
  if (value == null) return "warming"
  if (value < 30) return "low"
  if (value > 70) return "high"
  return "mid"
}

export function formatRsi(value: number | null): string {
  if (value == null) return "—"
  return value.toFixed(1)
}

/** Recent-window volatility in price units, used only to ease or intensify the sim defense spawn rate. */
export function priceVolatility(prices: readonly number[], window = 8): number {
  if (prices.length < 2) return 0
  const slice = prices.slice(-Math.max(2, window))
  let sum = 0
  for (let i = 1; i < slice.length; i++) sum += Math.abs(slice[i]! - slice[i - 1]!)
  return sum / (slice.length - 1)
}
