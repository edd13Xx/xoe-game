/** Short friendly purchase lines — rotate. Practice only. */
export const SHOP_LINE_INTERVAL_MS = 10000

export const PURCHASE_LINES = [
  "Here you go, pilot.",
  "All set — fly safe.",
  "Pocket topped. Nice pick.",
  "Yours. Don’t spend it twice.",
] as const

let lastShopLineAt = 0
let lastLineIndex = -1

export function nextPurchaseLine(seed = Date.now()): string {
  let i = Math.abs(Math.floor(seed)) % PURCHASE_LINES.length
  if (i === lastLineIndex) i = (i + 1) % PURCHASE_LINES.length
  lastLineIndex = i
  return PURCHASE_LINES[i]!
}

/** On purchase: at most once per SHOP_LINE_INTERVAL_MS while staying in shop. */
export function maybeShopPurchaseLine(nowMs = Date.now(), force = true): string | null {
  if (lastShopLineAt > 0 && nowMs - lastShopLineAt < SHOP_LINE_INTERVAL_MS) return null
  lastShopLineAt = nowMs
  void force
  return nextPurchaseLine(nowMs)
}

export function resetShopLineClock(): void {
  lastShopLineAt = 0
}
