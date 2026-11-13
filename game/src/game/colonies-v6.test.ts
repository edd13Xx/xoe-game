import { describe, expect, it } from "vitest"
import { FAQ_SECTIONS, wordCount } from "./faq.ts"
import { COLONIES, colonyById } from "./colonies.ts"

// v18.3 (XOE-004): lessons are one short line; the full explanation moved to the in-game FAQ.
const FAQ_TEXT = FAQ_SECTIONS.map((s) => s.lines.join(" ")).join(" ")

describe("v6 arcade lessons", () => {
  it("adds trustline, stroops, and volatility colonies (learn-while-flying)", () => {
    expect(COLONIES.length).toBeGreaterThanOrEqual(8)
    for (const id of ["trustline", "stroops", "volatility"] as const) {
      const c = colonyById(id)
      expect(c).toBeTruthy()
      expect(c!.gates.some((g) => g.ok)).toBe(true)
      expect(wordCount(c!.lesson)).toBeLessThanOrEqual(12)
      expect(c!.teach.length).toBeGreaterThan(10)
      expect(c!.lesson + c!.teach).not.toMatch(/TODO|placeholder/i)
      expect(c!.lesson + c!.teach + FAQ_TEXT).toMatch(/[Pp]aper|[Pp]ractice|Stellar/)
    }
    expect(colonyById("trustline")!.lesson).toMatch(/trustline/i)
    expect(colonyById("stroops")!.lesson).toMatch(/stroop/i)
    expect(colonyById("volatility")!.lesson).toMatch(/[Vv]olatility|[Ss]wing/)
  })
})
