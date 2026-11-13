import { describe, expect, it } from "vitest"
import { FEED_BACKOFF_START, FEED_RETRY_MS, afterFeedLoad, feedPlan } from "./feed-backoff.ts"

describe("v18 Coinbase offline backoff", () => {
  it("never fetches while the device says offline", () => {
    expect(feedPlan(FEED_BACKOFF_START, 0, false)).toBe("skip")
  })

  it("after a failed load only probes once a minute, then resets on success", () => {
    let b = afterFeedLoad(FEED_BACKOFF_START, false, 1_000)
    expect(feedPlan(b, 1_000 + 30_000, true)).toBe("skip")
    expect(feedPlan(b, 1_000 + FEED_RETRY_MS, true)).toBe("probe")
    b = afterFeedLoad(b, false, 61_000)
    expect(b.fails).toBe(2)
    expect(feedPlan(b, 91_000, true)).toBe("skip")
    b = afterFeedLoad(b, true, 121_000)
    expect(feedPlan(b, 121_000, true)).toBe("full")
  })

  it("simulated 5-minute offline run makes at most 10 requests (was 20 in 1 minute)", () => {
    // 5 spot fetches on the first try, then 1 probe each minute.
    let b = FEED_BACKOFF_START
    let requests = 0
    for (let t = 0; t <= 5 * 60_000; t += 30_000) {
      const plan = feedPlan(b, t, true)
      if (plan === "skip") continue
      requests += plan === "full" ? 5 : 1
      b = afterFeedLoad(b, false, t)
    }
    expect(requests).toBeLessThanOrEqual(10)
  })
})
