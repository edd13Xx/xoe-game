/**
 * Detect the Grok Bot / iOS in-chat preview: a sandboxed iframe that often
 * blocks the mic, storage, and outbound fetches (Coinbase, xAI).
 * file:// and a normal Safari tab are not treated as restricted.
 */

export function inRestrictedPreview(): boolean {
  if (typeof window === "undefined") return false
  try {
    const framed = window.self !== window.top
    if (!framed) return false
    try {
      if (window.location.origin === "null") return true
    } catch {
      return true
    }
    try {
      void window.parent.location.href
    } catch {
      return true
    }
    try {
      void window.localStorage.length
    } catch {
      return true
    }
    return false
  } catch {
    return true
  }
}

export const SAFARI_LIVE_HINT = "Open in Safari for live prices"
export const SAFARI_GROK_HINT = "Open in Safari to connect Grok Bot."

export function isNetworkFailure(err: unknown): boolean {
  if (err == null) return false
  const name = err instanceof Error ? err.name : ""
  const msg = err instanceof Error ? err.message : String(err)
  return name === "TypeError" || name === "AbortError" || /failed to fetch|networkerror|load failed/i.test(msg)
}
