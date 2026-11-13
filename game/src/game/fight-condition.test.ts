import { describe, expect, it } from "vitest"
import { conditionFlowSec, radarBlips, xoCondition, XO_ANCHOR } from "./fight-visuals.ts"

describe("xoCondition", () => {
  it("bands hull into stable / strained / critical", () => {
    expect(xoCondition(100, 100).tone).toBe("stable")
    expect(xoCondition(61, 100).tone).toBe("stable")
    expect(xoCondition(60, 100).tone).toBe("strained")
    expect(xoCondition(31, 100).tone).toBe("strained")
    expect(xoCondition(30, 100).tone).toBe("critical")
    expect(xoCondition(0, 100).label).toBe("Critical")
  })
  it("is safe on bad input", () => {
    expect(xoCondition(NaN, 100).tone).toBe("critical")
    expect(xoCondition(5, 0).pct).toBe(0)
  })
  it("flows faster under stress and stops with reduced motion", () => {
    expect(conditionFlowSec("stable", false)).toBeGreaterThan(conditionFlowSec("strained", false))
    expect(conditionFlowSec("strained", false)).toBeGreaterThan(conditionFlowSec("critical", false))
    expect(conditionFlowSec("critical", true)).toBe(0)
  })
})

describe("radarBlips", () => {
  it("drops dead enemies and keeps blips inside the ring", () => {
    const blips = radarBlips([
      { id: "a", x: 90, y: 10, alive: true },
      { id: "b", x: 30, y: 60, alive: true },
      { id: "c", x: 50, y: 50, alive: false },
    ])
    expect(blips.map((b) => b.id)).toEqual(["a", "b"])
    for (const b of blips) expect(Math.hypot(b.x - 50, b.y - 50)).toBeLessThanOrEqual(40.1)
    expect(blips[0]!.x).toBeGreaterThan(50)
    expect(blips[0]!.y).toBeLessThan(50)
    expect(blips[1]!.near).toBe(true)
    expect(blips[0]!.near).toBe(false)
  })
  it("puts an enemy on XO at the center", () => {
    expect(radarBlips([{ id: "z", ...XO_ANCHOR, alive: true }])[0]).toMatchObject({ x: 50, y: 50, near: true })
  })
})
