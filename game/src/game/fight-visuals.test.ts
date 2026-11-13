import { describe, expect, it } from "vitest"
import { XO_ANCHOR, beamLine, enemyHpPct, enemyHpTone } from "./fight-visuals.ts"

describe("fight visuals", () => {
  it("clamps and rounds enemy HP percent", () => {
    expect(enemyHpPct(40, 40)).toBe(100)
    expect(enemyHpPct(20, 40)).toBe(50)
    expect(enemyHpPct(1, 3)).toBe(33)
    expect(enemyHpPct(-5, 40)).toBe(0)
    expect(enemyHpPct(90, 40)).toBe(100)
    expect(enemyHpPct(10, 0)).toBe(0)
    expect(enemyHpPct(Number.NaN, 10)).toBe(0)
  })
  it("bands HP into tones", () => {
    expect(enemyHpTone(100)).toBe("ok")
    expect(enemyHpTone(51)).toBe("ok")
    expect(enemyHpTone(50)).toBe("warn")
    expect(enemyHpTone(26)).toBe("warn")
    expect(enemyHpTone(25)).toBe("bad")
    expect(enemyHpTone(0)).toBe("bad")
  })
  it("draws the beam from just ahead of XO to the target", () => {
    expect(beamLine({ x: 60, y: 40 })).toEqual({ x1: XO_ANCHOR.x + 4, y1: XO_ANCHOR.y - 1, x2: 60, y2: 40 })
    expect(beamLine({ x: 50, y: 50 }, { x: 10, y: 10 })).toEqual({ x1: 14, y1: 9, x2: 50, y2: 50 })
  })
})
