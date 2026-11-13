/**
 * v18: stop hammering Coinbase when the phone is offline.
 * - Offline (navigator.onLine === false): no fetches at all.
 * - After a failed load: only ONE small probe (XLM spot) every 60s, or right away on the "online" event.
 * - A good probe goes back to the normal full load (5 spot prices, then 24h opens).
 */
export const FEED_RETRY_MS = 60_000

export interface FeedBackoff {
  fails: number
  nextAt: number
}

export const FEED_BACKOFF_START: FeedBackoff = { fails: 0, nextAt: 0 }

export type FeedPlan = "skip" | "probe" | "full"

export function feedPlan(b: FeedBackoff, now: number, online: boolean): FeedPlan {
  if (!online) return "skip"
  if (b.fails === 0) return "full"
  return now >= b.nextAt ? "probe" : "skip"
}

export function afterFeedLoad(b: FeedBackoff, ok: boolean, now: number): FeedBackoff {
  if (ok) return FEED_BACKOFF_START
  return { fails: b.fails + 1, nextAt: now + FEED_RETRY_MS }
}
