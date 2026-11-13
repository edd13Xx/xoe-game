import { describe, expect, it } from "vitest"
import {
  FLARE_BURST_MS,
  FLARE_CME_START,
  FLARE_FLASH_PEAK,
  explosionClock,
  pulse,
} from "./solar-atmosphere.ts"

describe("solar atmosphere explosion clock", () => {
  it("is idle before the burst and done after FLARE_BURST_MS", () => {
    expect(explosionClock(-1).t).toBe(0)
    expect(explosionClock(-1).done).toBe(false)
    expect(explosionClock(0).t).toBe(0)
    expect(explosionClock(FLARE_BURST_MS).done).toBe(true)
    expect(explosionClock(FLARE_BURST_MS).t).toBe(1)
    expect(explosionClock(FLARE_BURST_MS + 400).done).toBe(true)
  })

  it("peaks the white-hot flash near FLARE_FLASH_PEAK and never stays at full brightness", () => {
    const peak = explosionClock(FLARE_FLASH_PEAK * FLARE_BURST_MS)
    expect(peak.flash).toBeGreaterThan(0.9)
    expect(explosionClock(0).flash).toBe(0)
    expect(explosionClock(FLARE_BURST_MS).flash).toBe(0)
    // mid-burst is a fading afterglow, not another full flash
    expect(explosionClock(FLARE_BURST_MS * 0.7).flash).toBeLessThan(0.2)
  })

  it("expands the CME after the flash and keeps a residual glow", () => {
    expect(explosionClock(FLARE_CME_START * FLARE_BURST_MS * 0.5).cme).toBe(0)
    const mid = explosionClock(FLARE_BURST_MS * 0.5)
    expect(mid.cme).toBeGreaterThan(0.4)
    expect(mid.loops).toBeGreaterThan(0.2)
    expect(mid.glow).toBeGreaterThan(0.3)
    expect(explosionClock(FLARE_BURST_MS * 0.95).cme).toBe(1)
  })

  it("is deterministic for a given elapsed time", () => {
    const a = explosionClock(640)
    const b = explosionClock(640)
    expect(a).toEqual(b)
  })

  it("pulse is 0 outside the window and 1 at the peak", () => {
    expect(pulse(0, 0.1, 0.2, 0.4)).toBe(0)
    expect(pulse(0.2, 0.1, 0.2, 0.4)).toBeCloseTo(1, 5)
    expect(pulse(0.5, 0.1, 0.2, 0.4)).toBe(0)
  })
})
