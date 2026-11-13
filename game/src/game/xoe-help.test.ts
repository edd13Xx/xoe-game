import { describe, expect, it } from "vitest"
import { helpContextFor, helpPrefill, tipsForHelp } from "./xoe-help.ts"

describe("xoe help", () => {
  it("picks map, fight, trade and recap contexts", () => {
    expect(helpContextFor({ phase: "colony-map" })).toBe("map")
    expect(helpContextFor({ phase: "colony-map", inFight: true })).toBe("fight")
    expect(helpContextFor({ phase: "colony-map", trading: true })).toBe("trade")
    expect(helpContextFor({ phase: "colony-map", justCleared: true })).toBe("recap")
    expect(helpContextFor({ phase: "moon-choice" })).toBe("moon")
    expect(tipsForHelp("fight").length).toBeGreaterThan(0)
    expect(helpPrefill("trade")).toMatch(/trade/i)
  })
})
