/** One overlay/drawer at a time over live play (v10 one-screen). */

export const DRAWER_IDS = [
  "scores",
  "settings",
  "report",
  "tutorial",
  "paper",
  "market",
  "ask-grok",
  "wallet",
  "faq",
] as const

export type DrawerId = (typeof DRAWER_IDS)[number]

/** Opening a drawer replaces any other; null closes. */
export function openDrawer(_current: DrawerId | null, next: DrawerId | null): DrawerId | null {
  // Replacing any open drawer enforces one-at-a-time.
  void _current
  if (next == null) return null
  return next
}

export function isDrawerOpen(current: DrawerId | null, id: DrawerId): boolean {
  return current === id
}

export function drawerLabel(id: DrawerId): string {
  switch (id) {
    case "scores":
      return "High scores"
    case "settings":
      return "Settings"
    case "report":
      return "Report a problem"
    case "tutorial":
      return "Tutorial"
    case "paper":
      return "XOE trade desk"
    case "market":
      return "Market"
    case "ask-grok":
      return "Grok Bot integration"
    case "wallet":
      return "Account & Wallet"
    case "faq":
      return "FAQ"
    default: {
      const _x: never = id
      return _x
    }
  }
}
