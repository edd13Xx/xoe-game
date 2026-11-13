/**
 * Companion class is Sentinel internally.
 * v18.2: XO's class shows as CLASSIFIED everywhere (Unknown Orbital, state of the art), never stat numbers.
 * Player class picks (Sentinel / Striker / Recon) stay gameplay choices.
 */

export const COMPANION_CLASS_INTERNAL = "Sentinel" as const

/** Legacy / non-card display label still used in the header line. */
export const COMPANION_CLASS_DISPLAY = "CLASSIFIED" as const

/** Companion card (first class readout on the XOE roster card). */
export const COMPANION_CARD_CLASS_DISPLAY = "CLASSIFIED" as const

/** v18.2 (Eddie): XO is a state-of-the-art, cutting-edge unknown orbital. No stat numbers are ever shown for XO. */
export const XO_CLASS_LINE = "Class: CLASSIFIED — Unknown Orbital · state of the art"
export const XO_PROFILE_LINE = "State-of-the-art, cutting-edge unknown orbital. Strength and defense: classified."
export const XO_STATS_CLASSIFIED = "Stats: CLASSIFIED"

/** Display label for companion class in general UI (header). Still Unknown. */
export function displayCompanionClass(_internal?: string | null): typeof COMPANION_CLASS_DISPLAY {
  return COMPANION_CLASS_DISPLAY
}

/** Display label for the companion card class line only. */
export function displayCompanionCardClass(_internal?: string | null): typeof COMPANION_CARD_CLASS_DISPLAY {
  return COMPANION_CARD_CLASS_DISPLAY
}

/** True when a roster profile class name should be masked for XOE. */
export function shouldMaskCompanionClass(className: string | null | undefined, characterId?: string | null): boolean {
  if (characterId === "xoe") return true
  if (className === COMPANION_CLASS_INTERNAL && (characterId === "xoe" || characterId == null)) return true
  return characterId === "xoe"
}
