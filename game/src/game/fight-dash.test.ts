import { describe, expect, it } from "vitest"
import {
  DASH_AFTERIMAGES,
  DASH_DOUBLE_TAP_MS,
  DASH_SWIPE_MS,
  dashAfterimages,
  dashReadyFrac,
  dashSpeedLines,
  isDoubleTap,
  swipeDashDir,
} from "./fight-visuals.ts"
import { DODGE_COOLDOWN_MS, DODGE_MS, canDodge, playerDodge, startFight } from "./combat.ts"

describe("ZOE-style boost dash (visual feel only)", () => {
  it("detects a quick nearby double-tap and ignores slow or far taps", () => {
    const a = { x: 100, y: 100, t: 1000 }
    expect(isDoubleTap(null, a)).toBe(false)
    expect(isDoubleTap(a, { x: 110, y: 104, t: 1000 + DASH_DOUBLE_TAP_MS - 10 })).toBe(true)
    expect(isDoubleTap(a, { x: 110, y: 104, t: 1000 + DASH_DOUBLE_TAP_MS + 50 })).toBe(false)
    expect(isDoubleTap(a, { x: 260, y: 100, t: 1100 })).toBe(false)
    expect(isDoubleTap(a, { x: 100, y: 100, t: 1000 })).toBe(false)
  })
  it("reads fast horizontal swipes as a dash direction", () => {
    const s = { x: 100, y: 100, t: 0 }
    expect(swipeDashDir(s, { x: 180, y: 110, t: 150 })).toBe(1)
    expect(swipeDashDir(s, { x: 30, y: 95, t: 150 })).toBe(-1)
    expect(swipeDashDir(s, { x: 120, y: 100, t: 150 })).toBeNull()
    expect(swipeDashDir(s, { x: 160, y: 200, t: 150 })).toBeNull()
    expect(swipeDashDir(s, { x: 200, y: 100, t: DASH_SWIPE_MS + 1 })).toBeNull()
    expect(swipeDashDir(null, { x: 200, y: 100, t: 10 })).toBeNull()
  })
  it("fills the cooldown ring from the existing dodge timing and matches canDodge", () => {
    expect(dashReadyFrac(0, 5000, DODGE_MS, DODGE_COOLDOWN_MS)).toBe(1)
    const f0 = startFight("skirmish")
    const f1 = playerDodge(f0, 10_000)
    const until = f1.mech.dodgeUntilMs
    expect(until).toBe(10_000 + DODGE_MS)
    expect(dashReadyFrac(until, 10_000, DODGE_MS, DODGE_COOLDOWN_MS)).toBe(0)
    expect(dashReadyFrac(until, 10_000 + DODGE_COOLDOWN_MS / 2, DODGE_MS, DODGE_COOLDOWN_MS)).toBeCloseTo(0.5)
    expect(canDodge(f1, 10_000 + DODGE_COOLDOWN_MS - 1)).toBe(false)
    expect(dashReadyFrac(until, 10_000 + DODGE_COOLDOWN_MS, DODGE_MS, DODGE_COOLDOWN_MS)).toBe(1)
    expect(canDodge(f1, 10_000 + DODGE_COOLDOWN_MS)).toBe(true)
  })
  it("leaves combat numbers alone (same dodge constants as before)", () => {
    expect(DODGE_MS).toBe(700)
    expect(DODGE_COOLDOWN_MS).toBe(2200)
  })
  it("draws fading afterimages and speed lines, none with reduced motion", () => {
    const g = dashAfterimages(false)
    expect(g).toHaveLength(DASH_AFTERIMAGES)
    for (let i = 1; i < g.length; i++) {
      expect(g[i]!.delayMs).toBeGreaterThan(g[i - 1]!.delayMs)
      expect(g[i]!.opacity).toBeLessThan(g[i - 1]!.opacity)
    }
    expect(dashAfterimages(true)).toEqual([])
    const lines = dashSpeedLines(3, false)
    expect(lines).toHaveLength(7)
    expect(dashSpeedLines(3, false)).toEqual(lines)
    for (const l of lines) {
      expect(l.top).toBeGreaterThanOrEqual(8)
      expect(l.top).toBeLessThanOrEqual(92)
    }
    expect(dashSpeedLines(3, true)).toEqual([])
  })
})
