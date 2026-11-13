/**
 * v18 test-only switch for XOE QA. Off unless the page URL has ?qa=1.
 * It only opens the moon-power picker (and the Ragnarok gate) without clearing all 10 colonies.
 * It does not add XOE, scores, badges, or colonies, and it is never saved.
 */
export function qaModeFromUrl(search: string | null | undefined): boolean {
  if (!search) return false
  try {
    return new URLSearchParams(search).get("qa") === "1"
  } catch {
    return false
  }
}

export function readQaMode(): boolean {
  try {
    return typeof window !== "undefined" && qaModeFromUrl(window.location.search)
  } catch {
    return false
  }
}

/** Review/debug: ?flare=1 starts a solar-flare red day after the front page. Never saved as a reward. */
export function qaFlareFromUrl(search: string | null | undefined): boolean {
  if (!search) return false
  try {
    const q = new URLSearchParams(search)
    const flare = q.get("flare")
    const qa = q.get("qa")
    return flare === "1" || qa === "flare"
  } catch {
    return false
  }
}

export function readQaFlare(): boolean {
  try {
    return typeof window !== "undefined" && qaFlareFromUrl(window.location.search)
  } catch {
    return false
  }
}

/** Review-only: ?town=harbor-commons or ?town=aurora-port opens that town after the map. Never saved. */
export function qaTownFromUrl(search: string | null | undefined): "harbor-commons" | "aurora-port" | null {
  if (!search) return null
  try {
    const town = new URLSearchParams(search).get("town")
    if (town === "harbor-commons" || town === "aurora-port") return town
    return null
  } catch {
    return null
  }
}

export function readQaTown(): "harbor-commons" | "aurora-port" | null {
  try {
    return typeof window !== "undefined" ? qaTownFromUrl(window.location.search) : null
  } catch {
    return null
  }
}

/** Review-only: ?credits=1 or ?qa=credits jumps to the credits roll. Display-only, never writes the ledger. */
export function qaCreditsFromUrl(search: string | null | undefined): boolean {
  if (!search) return false
  try {
    const q = new URLSearchParams(search)
    return q.get("credits") === "1" || q.get("qa") === "credits"
  } catch {
    return false
  }
}

export function readQaCredits(): boolean {
  try {
    return typeof window !== "undefined" && qaCreditsFromUrl(window.location.search)
  } catch {
    return false
  }
}
