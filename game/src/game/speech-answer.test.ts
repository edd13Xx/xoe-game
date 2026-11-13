import { describe, expect, it } from "vitest"
import { choicesFromTexts, editDistance, parseSpokenAnswer } from "./speech-answer.ts"

const CHOICES = choicesFromTexts(["Practice", "Live wallet", "Send seed phrase", "Ignore keys"])

describe("spoken answer parser", () => {
  it("matches A/B/C/D and letter words", () => {
    expect(parseSpokenAnswer("A", CHOICES).matchedIndex).toBe(0)
    expect(parseSpokenAnswer("option B", CHOICES).matchedIndex).toBe(1)
    expect(parseSpokenAnswer("bee", CHOICES).matchedIndex).toBe(1)
    expect(parseSpokenAnswer("see", CHOICES).matchedIndex).toBe(2)
    expect(parseSpokenAnswer("choice dee", CHOICES).matchedIndex).toBe(3)
  })

  it("matches option words and fuzzy text", () => {
    expect(parseSpokenAnswer("practice", CHOICES).matchedIndex).toBe(0)
    expect(parseSpokenAnswer("live wallet", CHOICES).matchedIndex).toBe(1)
    expect(parseSpokenAnswer("seed phrase", CHOICES).matchedIndex).toBe(2)
    expect(parseSpokenAnswer("practise", CHOICES).confidence).not.toBe("none")
  })

  it("returns null with confirm line when nothing matches", () => {
    const miss = parseSpokenAnswer("zzzz qqqq", CHOICES)
    expect(miss.matchedIndex).toBeNull()
    expect(miss.confirm).toMatch(/Heard/)
    expect(editDistance("practice", "practise")).toBeLessThanOrEqual(2)
  })
})
