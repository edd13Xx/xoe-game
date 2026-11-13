import { describe, expect, it } from "vitest"
import { initialXoeSim } from "./xoe-sim-price.ts"
import {
  FLARE_DRAWDOWN_MAX,
  FLARE_DRAWDOWN_MIN,
  FLARE_DURATION_TICKS,
  FLARE_FIRST_ELIGIBLE_SESSION,
  FLARE_MIN_GAP,
  applyFlareTick,
  canStartFlare,
  emptyFlareLog,
  flareHash,
  markFlareStarted,
  rollFlare,
  startFlare,
  troughPriceFor,
  wouldRollFlare,
} from "./solar-flare.ts"

function runEvent(startPrice: number, seed: number, session = 4, day = 4) {
  const flare0 = startFlare(startPrice, { seed, session, day })
  let sim = initialXoeSim(0, startPrice)
  let flare = flare0
  const prices = [sim.price]
  for (let i = 0; i < FLARE_DURATION_TICKS + 2; i++) {
    const noise = flareHash(seed, session, day + i) - 0.5
    const out = applyFlareTick(sim, flare, noise, i + 1)
    sim = out.sim
    flare = out.flare
    prices.push(sim.price)
    if (!flare.active) break
  }
  return { flare0, flare, sim, prices }
}

describe("solar flare rarity", () => {
  it("is rare, seeded, and never back-to-back", () => {
    const seed = 42
    const days = 0
    let log = emptyFlareLog(seed)
    const hits: number[] = []
    const seqA: boolean[] = []
    for (let session = 1; session <= 600; session++) {
      log = { ...log, sessionCount: session }
      const rolled = rollFlare(log, seed, session, days)
      seqA.push(rolled)
      if (rolled) {
        hits.push(session)
        log = markFlareStarted(log, session, days)
      }
    }
    expect(hits[0] ?? 0).toBeGreaterThanOrEqual(FLARE_FIRST_ELIGIBLE_SESSION)
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i]! - hits[i - 1]!).toBeGreaterThanOrEqual(FLARE_MIN_GAP)
    }
    // Roughly once every several sessions: 600 * 1/6 ≈ 100, with first skipped and gaps.
    expect(hits.length).toBeGreaterThan(50)
    expect(hits.length).toBeLessThan(130)

    const seqB: boolean[] = []
    let logB = emptyFlareLog(seed)
    for (let session = 1; session <= 600; session++) {
      logB = { ...logB, sessionCount: session }
      const rolled = rollFlare(logB, seed, session, days)
      seqB.push(rolled)
      if (rolled) logB = markFlareStarted(logB, session, days)
    }
    expect(seqB).toEqual(seqA)

    const otherHits: number[] = []
    let logC = emptyFlareLog(99)
    for (let session = 1; session <= 600; session++) {
      logC = { ...logC, sessionCount: session }
      if (rollFlare(logC, 99, session, days)) {
        otherHits.push(session)
        logC = markFlareStarted(logC, session, days)
      }
    }
    expect(otherHits).not.toEqual(hits)
  })

  it("blocks the next session even when the hash would fire", () => {
    // Find a seed where two consecutive eligible sessions would both hash-hit.
    let seed = 0
    let a = 0
    for (let s = 1; s < 4000 && !a; s++) {
      for (let sess = FLARE_FIRST_ELIGIBLE_SESSION; sess < 40; sess++) {
        if (wouldRollFlare(s, sess, 8) && wouldRollFlare(s, sess + 1, 8)) {
          seed = s
          a = sess
          break
        }
      }
    }
    expect(a).toBeGreaterThan(0)
    expect(wouldRollFlare(seed, a, 8)).toBe(true)
    expect(wouldRollFlare(seed, a + 1, 8)).toBe(true)
    let log = emptyFlareLog(seed)
    expect(rollFlare(log, seed, a, 8)).toBe(true)
    log = markFlareStarted(log, a, 8)
    expect(canStartFlare(log, a + 1, 8)).toBe(false)
    expect(rollFlare(log, seed, a + 1, 8)).toBe(false)
    expect(canStartFlare(log, a + FLARE_MIN_GAP, 8 + FLARE_MIN_GAP)).toBe(true)
  })
})

describe("solar flare price path", () => {
  it("draws down 10–15% then returns, stays in the $5–$20 clamp, and is deterministic", () => {
    const a = runEvent(10, 7, 4, 4)
    const b = runEvent(10, 7, 4, 4)
    expect(a.prices).toEqual(b.prices)
    expect(a.flare.active).toBe(false)
    expect(a.sim.regime).toBe("range")
    const min = Math.min(...a.prices)
    const drop = (10 - min) / 10
    expect(drop).toBeGreaterThanOrEqual(FLARE_DRAWDOWN_MIN - 1e-9)
    expect(drop).toBeLessThanOrEqual(FLARE_DRAWDOWN_MAX + 1e-9)
    expect(min).toBeCloseTo(a.flare0.troughPrice, 8)
    expect(a.prices.every((p) => p >= 5 && p <= 20)).toBe(true)
    // Partial bounce: after the trough, price rises before the end.
    const troughAt = a.prices.indexOf(min)
    const after = a.prices.slice(troughAt)
    expect(Math.max(...after)).toBeGreaterThan(min + 0.05)
    expect(a.prices[a.prices.length - 1]!).toBeGreaterThan(min)
  })

  it("clamps a 15% drop that would break the $5 floor", () => {
    const start = 5.2
    const rawTrough = start * (1 - FLARE_DRAWDOWN_MIN)
    expect(rawTrough).toBeLessThan(5)
    const trough = troughPriceFor(start, 3, 5, 5)
    expect(trough).toBe(5)
    const run = runEvent(start, 3, 5, 5)
    expect(Math.min(...run.prices)).toBe(5)
    expect(run.prices.every((p) => p >= 5 && p <= 20)).toBe(true)
  })
})
