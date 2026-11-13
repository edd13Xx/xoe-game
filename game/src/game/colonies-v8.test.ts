import { describe, expect, it } from "vitest"
import { FAQ_SECTIONS } from "./faq.ts"
import { COLONIES, colonyById } from "./colonies.ts"
import { readFileSync } from "node:fs"

// v18.3 (XOE-004): lessons are one short line; the full explanation moved to the in-game FAQ.
const FAQ_TEXT = FAQ_SECTIONS.map((s) => s.lines.join(" ")).join(" ")

describe("v8 seed backup + lesson layout", () => {
  it("adds seed-backup colony after phishing with no real-seed ask", () => {
    expect(COLONIES.length).toBeGreaterThanOrEqual(10)
    const ids = COLONIES.map((c) => c.id)
    expect(ids.indexOf("seed-backup")).toBeGreaterThan(ids.indexOf("phishing"))
    const c = colonyById("seed-backup")!
    const blob = `${c.lesson} ${c.teach} ${FAQ_TEXT}`
    expect(blob).toMatch(/paper|metal|offline/i)
    expect(blob).toMatch(/never.*(photo|cloud|share)|no.*(photo|cloud)/i)
    expect(blob).toMatch(/Testnet XOE|no real money|paper or metal/)
    expect(blob).toMatch(/never ask|never asks|does not ask|never asks for or accepts/i)
    expect(c.gates.some((g) => g.ok)).toBe(true)
  })

  it("compresses in-lesson narration for phone", () => {
    const css = readFileSync("src/index.css", "utf8")
    expect(css).toMatch(/lesson-tight/)
  })
})
