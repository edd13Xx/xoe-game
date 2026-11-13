/**
 * v18.3 (QA fix 1): short dome name for the phone map's Enter chip (Buy/Sell row).
 * "Colony Wallet" -> "Wallet", "Fees and leverage (bonus)" -> "Fees and leverage ★".
 */
export function enterChipName(label: string): string {
  const bonus = /\(bonus\)\s*$/i.test(label)
  const base = label.replace(/^\s*Colony\s+/i, "").replace(/\s*\(bonus\)\s*$/i, "").trim()
  return bonus ? `${base} ★` : base
}

/** Largest share of the phone map the overlays may cover (QA fix 1, measured at 393px wide). */
export const MAP_OVERLAY_MAX_SHARE = 0.35
