/**
 * NEAR HACKATHON hook (opt-in, no network, no economy change).
 * When the game runs inside another page (the NEAR demo embeds it in an iframe) it posts a plain
 * message to that parent when the player reaches a milestone. Standalone play sends nothing.
 * The parent decides what to do with it (the demo asks a testnet attester to record it).
 * Nothing here touches the in-game ledger, rewards, caps or Claim (still disabled in the game).
 */
export type XoeAchievementId = "colony_cleared" | "boss_beaten" | "game_finished"

export function announceAchievement(id: XoeAchievementId, detail: string = ""): boolean {
  try {
    if (typeof window === "undefined") return false
    // Same-page DOM event (used by tests and any host script); carries no data off the page.
    if (typeof window.dispatchEvent === "function" && typeof CustomEvent === "function") window.dispatchEvent(new CustomEvent("xoe:achievement", { detail: { id, detail: String(detail).slice(0, 64) } }))
    if (window.parent === window) return false
    window.parent.postMessage({ source: "xoe-game", type: "xoe:achievement", id, detail: String(detail).slice(0, 64) }, "*")
    return true
  } catch {
    return false
  }
}
